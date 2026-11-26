import {
  pickRandom,
  shuffle,
  type GameActionResult,
  type GameInitContext,
  type GameResult,
} from "@gemoji/game-core";
import type { ChatChannel, Player } from "@gemoji/shared";
import type { WordtrapAction } from "./actions";
import {
  ALPHABET,
  type ActiveTrap,
  type LetterStatus,
  type WordtrapConfig,
  type WordtrapLogEntry,
  type WordtrapPlayerInternal,
  type WordtrapPlayerView,
  type WordtrapSessionData,
  type WordtrapState,
} from "./state";
import { DEFAULT_WORDTRAP_WORDS } from "./words";

export const WORD_GUESS_DURATION_MS = 30_000;
export const ROUND_END_DURATION_MS = 6_000;
const MAX_LOGS = 40;

function normalizeWord(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function parseSessionData(raw: unknown): WordtrapSessionData {
  if (raw && typeof raw === "object") {
    const data = raw as Partial<WordtrapSessionData>;
    return {
      usedWords: Array.isArray(data.usedWords)
        ? data.usedWords.filter((w): w is string => typeof w === "string")
        : [],
    };
  }
  return { usedWords: [] };
}

function computeTurnEndsAt(config: WordtrapConfig, now: number): number | null {
  if (config.turnDurationSec === 0) return null;
  return now + config.turnDurationSec * 1000;
}

function pickNextSecretWord(
  wordPool: string[],
  usedWords: string[],
  rng: () => number,
): { secretWord: string; nextUsedWords: string[] } {
  const pool = wordPool.length > 0 ? wordPool : [...DEFAULT_WORDTRAP_WORDS];
  const usedSet = new Set(usedWords);
  const unused = pool.filter((w) => !usedSet.has(w));
  if (unused.length > 0) {
    const picked = pickRandom(unused, rng);
    return { secretWord: picked, nextUsedWords: [...usedWords, picked] };
  }
  const picked = pickRandom(pool, rng);
  return { secretWord: picked, nextUsedWords: [picked] };
}

function makeLog(
  round: number,
  type: WordtrapLogEntry["type"],
  message: string,
  now: number,
  seq = 0,
): WordtrapLogEntry {
  return {
    id: `wt_${now}_${seq}_${Math.random().toString(36).slice(2, 6)}`,
    round,
    type,
    message,
    timestamp: now,
  };
}

function appendLogs(existing: WordtrapLogEntry[], added: WordtrapLogEntry[]): WordtrapLogEntry[] {
  const combined = [...existing, ...added];
  return combined.length > MAX_LOGS ? combined.slice(combined.length - MAX_LOGS) : combined;
}

function getAlivePlayers(players: WordtrapPlayerInternal[]): WordtrapPlayerInternal[] {
  return players.filter((p) => !p.eliminatedInRound);
}

function findNextAliveTurnIndex(
  turnOrder: string[],
  players: WordtrapPlayerInternal[],
  fromIndex: number,
): number {
  const aliveSet = new Set(players.filter((p) => !p.eliminatedInRound).map((p) => p.id));
  if (aliveSet.size === 0 || turnOrder.length === 0) return 0;
  for (let step = 1; step <= turnOrder.length; step++) {
    const idx = (fromIndex + step) % turnOrder.length;
    const pid = turnOrder[idx];
    if (pid && aliveSet.has(pid)) return idx;
  }
  return 0;
}

function isSlotGenuinelyRevealed(
  secretWord: string,
  guessedLetters: Record<string, "correct" | "wrong">,
  slotIndex: number,
): boolean {
  const ch = secretWord[slotIndex];
  if (!ch) return true;
  return guessedLetters[ch] === "correct";
}

function getPlayerNickname(players: WordtrapPlayerInternal[], playerId: string): string {
  return players.find((p) => p.id === playerId)?.nickname ?? "Pemain";
}

function startNewRoundState(
  prevState: WordtrapState,
  nextRound: number,
  now: number,
  rng: () => number,
): WordtrapState {
  const { secretWord, nextUsedWords } = pickNextSecretWord(
    prevState.wordPool,
    prevState.sessionData.usedWords,
    rng,
  );
  const resetPlayers: WordtrapPlayerInternal[] = prevState.players.map((p) => ({
    ...p,
    eliminatedInRound: false,
    trapsUsedInRound: 0,
  }));
  const turnOrder = shuffle(
    resetPlayers.map((p) => p.id),
    rng,
  );

  return {
    ...prevState,
    phase: "PLAYING",
    phaseEndsAt: computeTurnEndsAt(prevState.config, now),
    round: nextRound,
    secretWord,
    players: resetPlayers,
    turnOrder,
    currentTurnIndex: 0,
    guessedLetters: {},
    activeTraps: [],
    activeGuesserId: null,
    pausedTurnRemainingMs: null,
    lastRoundResult: null,
    logs: appendLogs(prevState.logs, [
      makeLog(
        nextRound,
        "round_end",
        `Ronde ${nextRound} dimulai! Kata baru terdiri dari ${secretWord.length} huruf.`,
        now,
        0,
      ),
    ]),
    sessionData: { usedWords: nextUsedWords },
  };
}

/**
 * Maju ke giliran pemain hidup berikutnya dan menurunkan counter semua trap aktif
 * (kecuali trap yang baru saja dipasang di giliran ini).
 * Trap yang habis 1 putarannya (turnsRemaining <= 0 atau giliran kembali ke pemilik trap)
 * otomatis berakhir, mencetak log trap, dan mengembalikan warna huruf sesuai aslinya.
 */
function advanceTurnAndTickTraps(
  state: WordtrapState,
  now: number,
  newlyCreatedTrapId: string | null,
  extraLogs: WordtrapLogEntry[],
  extraSysMsgs: Array<{ channel: ChatChannel; content: string }>,
): GameActionResult<WordtrapState> {
  const nextTurnIndex = findNextAliveTurnIndex(
    state.turnOrder,
    state.players,
    state.currentTurnIndex,
  );
  const nextTurnPlayerId = state.turnOrder[nextTurnIndex] ?? null;

  const nextGuessedLetters = { ...state.guessedLetters };
  const survivingTraps: ActiveTrap[] = [];
  const addedLogs: WordtrapLogEntry[] = [...extraLogs];
  const systemMessages: Array<{ channel: ChatChannel; content: string }> = [...extraSysMsgs];
  let seq = extraLogs.length;

  for (const trap of state.activeTraps) {
    if (trap.id === newlyCreatedTrapId) {
      survivingTraps.push(trap);
      continue;
    }

    const remaining = trap.turnsRemaining - 1;
    const expired = remaining <= 0 || nextTurnPlayerId === trap.ownerId;

    if (!expired) {
      survivingTraps.push({ ...trap, turnsRemaining: remaining });
      continue;
    }

    // Trap berakhir: ungkap status & warna asli huruf tersebut!
    const wasAlreadyGuessed = Boolean(nextGuessedLetters[trap.letter]);
    if (!wasAlreadyGuessed) {
      nextGuessedLetters[trap.letter] = trap.actualInWord ? "correct" : "wrong";
    }

    const ownerName = getPlayerNickname(state.players, trap.ownerId);
    let msg: string;
    if (trap.mode === "hidden") {
      msg = trap.actualInWord
        ? `Trap berakhir! Huruf "${trap.letter}" dari ${ownerName} adalah TRAP, namun memang ada di kata rahasia (tetap Hijau).`
        : `Trap berakhir! Huruf "${trap.letter}" dari ${ownerName} ternyata adalah TRAP, berubah menjadi Merah!`;
    } else {
      const slotNum = (trap.slotIndex ?? 0) + 1;
      if (wasAlreadyGuessed) {
        msg = `Trap berakhir! Huruf palsu "${trap.letter}" di slot #${slotNum} dari ${ownerName} adalah TRAP dan kini menghilang.`;
      } else if (trap.actualInWord) {
        msg = `Trap berakhir! Huruf "${trap.letter}" di slot #${slotNum} dari ${ownerName} adalah TRAP. Huruf aslinya kini terbuka di posisi sebenarnya (Hijau).`;
      } else {
        msg = `Trap berakhir! Huruf palsu "${trap.letter}" di slot #${slotNum} dari ${ownerName} adalah TRAP, berubah menjadi Merah!`;
      }
    }

    addedLogs.push(makeLog(state.round, "trap_expired", msg, now, seq++));
    systemMessages.push({ channel: "public", content: msg });
  }

  // Cegah soft-lock jika seluruh 26 huruf A–Z sudah habis terungkap tanpa ada yang menebak kata
  const allAlphabetUsed = ALPHABET.every((ch) => Boolean(nextGuessedLetters[ch]));
  if (allAlphabetUsed && survivingTraps.length === 0) {
    const endMsg = `Semua huruf A–Z sudah terbuka! Kata rahasianya adalah "${state.secretWord}".`;
    addedLogs.push(makeLog(state.round, "round_end", endMsg, now, seq++));
    systemMessages.push({ channel: "public", content: endMsg });
    return {
      state: {
        ...state,
        phase: "ROUND_END",
        phaseEndsAt: now + ROUND_END_DURATION_MS,
        guessedLetters: nextGuessedLetters,
        activeTraps: [],
        activeGuesserId: null,
        pausedTurnRemainingMs: null,
        lastRoundResult: {
          round: state.round,
          secretWord: state.secretWord,
          winnerPlayerId: null,
          reason: "letters_exhausted",
        },
        logs: appendLogs(state.logs, addedLogs),
      },
      systemMessages,
    };
  }

  return {
    state: {
      ...state,
      phase: "PLAYING",
      currentTurnIndex: nextTurnIndex,
      phaseEndsAt: computeTurnEndsAt(state.config, now),
      guessedLetters: nextGuessedLetters,
      activeTraps: survivingTraps,
      pausedTurnRemainingMs: null,
      logs: appendLogs(state.logs, addedLogs),
    },
    systemMessages: systemMessages.length > 0 ? systemMessages : undefined,
  };
}

export function initWordtrap(
  players: Player[],
  config: WordtrapConfig,
  context: GameInitContext,
): WordtrapState {
  const rng = context.rng ?? Math.random;
  const sessionData = parseSessionData(context.previousSessionData);

  const sanitizedPool = (context.libraryWords ?? [...DEFAULT_WORDTRAP_WORDS])
    .map(normalizeWord)
    .filter((w) => w.length >= 4 && w.length <= 12);
  const wordPool = sanitizedPool.length > 0 ? sanitizedPool : [...DEFAULT_WORDTRAP_WORDS];

  const { secretWord, nextUsedWords } = pickNextSecretWord(wordPool, sessionData.usedWords, rng);

  const internalPlayers: WordtrapPlayerInternal[] = players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    avatar: p.avatar,
    score: 0,
    eliminatedInRound: false,
    trapsUsedInRound: 0,
  }));

  const turnOrder = shuffle(
    internalPlayers.map((p) => p.id),
    rng,
  );

  return {
    phase: "PLAYING",
    phaseEndsAt: computeTurnEndsAt(config, context.now),
    config,
    round: 1,
    secretWord,
    wordPool,
    players: internalPlayers,
    turnOrder,
    currentTurnIndex: 0,
    guessedLetters: {},
    activeTraps: [],
    activeGuesserId: null,
    pausedTurnRemainingMs: null,
    lastRoundResult: null,
    logs: [
      makeLog(
        1,
        "round_end",
        `Ronde 1 dimulai! Tebak kata rahasia (${secretWord.length} huruf), Mode ${config.mode === "reveal" ? "Reveal" : "Hidden"}.`,
        context.now,
        0,
      ),
    ],
    winner: null,
    sessionData: { usedWords: nextUsedWords },
  };
}

export function validateWordtrapAction(
  state: WordtrapState,
  playerId: string,
  action: WordtrapAction,
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Pemain tidak ditemukan di game ini";

  switch (action.actionType) {
    case "PICK_LETTER": {
      if (state.phase !== "PLAYING") return "Bukan fase memilih huruf";
      if (player.eliminatedInRound) return "Kamu sudah tereliminasi di ronde ini";
      const currentPlayerId = state.turnOrder[state.currentTurnIndex];
      if (currentPlayerId !== playerId) return "Belum giliranmu memilih huruf";
      const letter = action.data.letter;
      if (state.guessedLetters[letter]) return `Huruf ${letter} sudah pernah dipilih`;
      if (state.activeTraps.some((t) => t.letter === letter)) {
        return `Huruf ${letter} sudah dipilih`;
      }
      return null;
    }

    case "USE_TRAP": {
      if (state.phase !== "PLAYING") return "Skill Trap hanya bisa dipakai saat giliran bermain";
      if (player.eliminatedInRound) return "Kamu sudah tereliminasi di ronde ini";
      const currentPlayerId = state.turnOrder[state.currentTurnIndex];
      if (currentPlayerId !== playerId) return "Skill Trap hanya bisa dipakai saat giliranmu";
      if (player.trapsUsedInRound >= state.config.trapLimit) {
        return `Skill Trap maksimal ${state.config.trapLimit}x per ronde`;
      }

      const { letter, slotIndex } = action.data;

      if (state.config.mode === "hidden") {
        if (state.guessedLetters[letter] || state.activeTraps.some((t) => t.letter === letter)) {
          return `Huruf ${letter} sudah terbuka di keyboard`;
        }
        return null;
      }

      // Mode Reveal: wajib pilih slot kosong
      if (slotIndex === undefined) {
        return "Pilih 1 slot kosong untuk memasang huruf palsu";
      }
      if (slotIndex < 0 || slotIndex >= state.secretWord.length) {
        return "Posisi slot tidak valid";
      }
      if (isSlotGenuinelyRevealed(state.secretWord, state.guessedLetters, slotIndex)) {
        return "Slot tersebut sudah terisi huruf asli";
      }
      if (state.activeTraps.some((t) => t.slotIndex === slotIndex)) {
        return "Slot tersebut sudah terisi";
      }
      if (state.guessedLetters[letter] === "wrong") {
        return `Huruf ${letter} sudah berwarna Merah, pilih huruf lain agar meyakinkan`;
      }
      return null;
    }

    case "START_WORD_GUESS": {
      if (state.phase !== "PLAYING") return "Pemain lain sedang menebak kata atau ronde sudah selesai";
      if (player.eliminatedInRound) return "Kamu tereliminasi hingga ronde berikutnya";
      return null;
    }

    case "SUBMIT_WORD_GUESS": {
      if (state.phase !== "GUESSING_WORD") return "Bukan fase tebak kata utuh";
      if (state.activeGuesserId !== playerId) return "Bukan kamu yang menekan tombol Tebak Kata";
      return null;
    }

    case "NEXT_ROUND": {
      if (state.phase !== "ROUND_END") return "Ronde saat ini belum selesai";
      return null;
    }
  }
}

function handleFailedWordGuess(
  state: WordtrapState,
  guesserId: string,
  reasonMessage: string,
  now: number,
): GameActionResult<WordtrapState> {
  const updatedPlayers = state.players.map((p) =>
    p.id === guesserId ? { ...p, eliminatedInRound: true } : p,
  );
  const aliveRemaining = getAlivePlayers(updatedPlayers);
  const failLog = makeLog(state.round, "guess_wrong", reasonMessage, now, 0);

  if (aliveRemaining.length === 0) {
    const endMsg = `Semua pemain tereliminasi! Kata rahasianya adalah "${state.secretWord}".`;
    const endLog = makeLog(state.round, "round_end", endMsg, now, 1);
    return {
      state: {
        ...state,
        phase: "ROUND_END",
        phaseEndsAt: now + ROUND_END_DURATION_MS,
        players: updatedPlayers,
        activeGuesserId: null,
        pausedTurnRemainingMs: null,
        lastRoundResult: {
          round: state.round,
          secretWord: state.secretWord,
          winnerPlayerId: null,
          reason: "all_eliminated",
        },
        logs: appendLogs(state.logs, [failLog, endLog]),
      },
      systemMessages: [
        { channel: "public", content: reasonMessage },
        { channel: "public", content: endMsg },
      ],
    };
  }

  const stateWithElim: WordtrapState = {
    ...state,
    players: updatedPlayers,
    activeGuesserId: null,
  };

  const currentTurnPlayerId = state.turnOrder[state.currentTurnIndex];
  if (currentTurnPlayerId === guesserId) {
    // Penebak yang tereliminasi kebetulan sedang gilirannya -> lanjut ke pemain aktif berikutnya
    return advanceTurnAndTickTraps(
      stateWithElim,
      now,
      null,
      [failLog],
      [{ channel: "public", content: reasonMessage }],
    );
  }

  // Kembalikan permainan ke pemain yang sedang giliran dengan sisa waktu sebelumnya
  const resumedEndsAt =
    state.config.turnDurationSec === 0
      ? null
      : now + (state.pausedTurnRemainingMs ?? state.config.turnDurationSec * 1000);

  return {
    state: {
      ...stateWithElim,
      phase: "PLAYING",
      phaseEndsAt: resumedEndsAt,
      pausedTurnRemainingMs: null,
      logs: appendLogs(state.logs, [failLog]),
    },
    systemMessages: [{ channel: "public", content: reasonMessage }],
  };
}

export function reduceWordtrap(
  state: WordtrapState,
  playerId: string,
  action: WordtrapAction,
  now: number,
  rng: () => number = Math.random,
): GameActionResult<WordtrapState> {
  const actorName = getPlayerNickname(state.players, playerId);

  switch (action.actionType) {
    case "PICK_LETTER": {
      const letter = action.data.letter;
      const isHit = state.secretWord.includes(letter);
      const nextGuessedLetters: Record<string, "correct" | "wrong"> = {
        ...state.guessedLetters,
        [letter]: isHit ? "correct" : "wrong",
      };

      const extraLogs: WordtrapLogEntry[] = [
        makeLog(
          state.round,
          "letter",
          `${actorName} memilih huruf "${letter}" (${isHit ? "Hijau: ada di kata!" : "Merah: tidak ada"}).`,
          now,
          0,
        ),
      ];
      const extraSysMsgs: Array<{ channel: ChatChannel; content: string }> = [];

      // Mode Reveal: jika huruf benar mengisi slot yang sedang dipasangi trap palsu -> trap otomatis batal & hilang!
      let remainingTraps = state.activeTraps;
      if (state.config.mode === "reveal" && isHit) {
        const kept: ActiveTrap[] = [];
        let seq = 1;
        for (const trap of state.activeTraps) {
          if (trap.slotIndex !== null && state.secretWord[trap.slotIndex] === letter) {
            const ownerName = getPlayerNickname(state.players, trap.ownerId);
            if (!nextGuessedLetters[trap.letter]) {
              nextGuessedLetters[trap.letter] = trap.actualInWord ? "correct" : "wrong";
            }
            const bustedMsg = `Trap terbongkar! Huruf palsu "${trap.letter}" di slot #${trap.slotIndex + 1} dari ${ownerName} adalah TRAP dan digantikan huruf asli "${letter}".`;
            extraLogs.push(makeLog(state.round, "trap_busted", bustedMsg, now, seq++));
            extraSysMsgs.push({ channel: "public", content: bustedMsg });
          } else {
            kept.push(trap);
          }
        }
        remainingTraps = kept;
      }

      return advanceTurnAndTickTraps(
        {
          ...state,
          guessedLetters: nextGuessedLetters,
          activeTraps: remainingTraps,
        },
        now,
        null,
        extraLogs,
        extraSysMsgs,
      );
    }

    case "USE_TRAP": {
      const { letter, slotIndex } = action.data;
      const aliveCount = getAlivePlayers(state.players).length;
      const turnsRemaining = Math.max(1, aliveCount - 1);
      const actualInWord = state.secretWord.includes(letter);

      const newTrap: ActiveTrap = {
        id: `trap_${now}_${Math.random().toString(36).slice(2, 6)}`,
        ownerId: playerId,
        mode: state.config.mode,
        letter,
        slotIndex: state.config.mode === "reveal" ? (slotIndex ?? 0) : null,
        actualInWord,
        turnsRemaining,
      };

      const updatedPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, trapsUsedInRound: p.trapsUsedInRound + 1 } : p,
      );

      // Log publik sengaja tampil seperti pilihan huruf hijau biasa agar trap tidak langsung ketahuan!
      const disguiseLog = makeLog(
        state.round,
        "letter",
        `${actorName} memilih huruf "${letter}" (Hijau: ada di kata!).`,
        now,
        0,
      );

      return advanceTurnAndTickTraps(
        {
          ...state,
          players: updatedPlayers,
          activeTraps: [...state.activeTraps, newTrap],
        },
        now,
        newTrap.id,
        [disguiseLog],
        [],
      );
    }

    case "START_WORD_GUESS": {
      const pausedRemaining =
        state.phaseEndsAt !== null ? Math.max(1000, state.phaseEndsAt - now) : null;
      const msg = `${actorName} menekan Tebak Kata! Punya 30 detik untuk menjawab.`;
      return {
        state: {
          ...state,
          phase: "GUESSING_WORD",
          phaseEndsAt: now + WORD_GUESS_DURATION_MS,
          activeGuesserId: playerId,
          pausedTurnRemainingMs: pausedRemaining,
          logs: appendLogs(state.logs, [makeLog(state.round, "guess_start", msg, now, 0)]),
        },
        systemMessages: [{ channel: "public", content: msg }],
      };
    }

    case "SUBMIT_WORD_GUESS": {
      const normalizedGuess = normalizeWord(action.data.word);
      const isCorrect = normalizedGuess === state.secretWord;

      if (!isCorrect) {
        const failMsg = `Tebakan ${actorName} ("${action.data.word.trim()}") salah! ${actorName} tereliminasi hingga ronde berikutnya.`;
        return handleFailedWordGuess(state, playerId, failMsg, now);
      }

      const updatedPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, score: p.score + 1 } : p,
      );
      const winnerPlayer = updatedPlayers.find((p) => p.id === playerId)!;
      const winRoundMsg = `${actorName} berhasil menebak kata "${state.secretWord}"! (+1 poin → ${winnerPlayer.score}/${state.config.targetPoints})`;
      const winLog = makeLog(state.round, "guess_correct", winRoundMsg, now, 0);

      const roundResult = {
        round: state.round,
        secretWord: state.secretWord,
        winnerPlayerId: playerId,
        reason: "guessed" as const,
      };

      if (winnerPlayer.score >= state.config.targetPoints) {
        const winner: GameResult = {
          winnerTeam: playerId,
          winnerPlayerIds: [playerId],
          reason: `${actorName} mencapai ${state.config.targetPoints} poin dan memenangkan Wordtrap!`,
        };
        return {
          state: {
            ...state,
            phase: "GAME_OVER",
            phaseEndsAt: null,
            players: updatedPlayers,
            activeGuesserId: null,
            pausedTurnRemainingMs: null,
            lastRoundResult: roundResult,
            winner,
            logs: appendLogs(state.logs, [winLog]),
          },
          systemMessages: [
            { channel: "public", content: winRoundMsg },
            { channel: "public", content: winner.reason },
          ],
        };
      }

      return {
        state: {
          ...state,
          phase: "ROUND_END",
          phaseEndsAt: now + ROUND_END_DURATION_MS,
          players: updatedPlayers,
          activeGuesserId: null,
          pausedTurnRemainingMs: null,
          lastRoundResult: roundResult,
          logs: appendLogs(state.logs, [winLog]),
        },
        systemMessages: [{ channel: "public", content: winRoundMsg }],
      };
    }

    case "NEXT_ROUND": {
      const nextState = startNewRoundState(state, state.round + 1, now, rng);
      return {
        state: nextState,
        systemMessages: [
          {
            channel: "public",
            content: `Ronde ${nextState.round} dimulai! Kata rahasia baru (${nextState.secretWord.length} huruf).`,
          },
        ],
      };
    }
  }
}

export function onWordtrapTimeout(
  state: WordtrapState,
  now: number,
  rng: () => number = Math.random,
): GameActionResult<WordtrapState> {
  if (state.phase === "PLAYING") {
    const currentPlayerId = state.turnOrder[state.currentTurnIndex];
    const name = currentPlayerId ? getPlayerNickname(state.players, currentPlayerId) : "Pemain";
    const msg = `Waktu giliran ${name} habis, giliran dilewati.`;
    return advanceTurnAndTickTraps(
      state,
      now,
      null,
      [makeLog(state.round, "timeout", msg, now, 0)],
      [{ channel: "public", content: msg }],
    );
  }

  if (state.phase === "GUESSING_WORD" && state.activeGuesserId) {
    const name = getPlayerNickname(state.players, state.activeGuesserId);
    const msg = `Waktu 30 detik ${name} habis! ${name} tereliminasi hingga ronde berikutnya.`;
    return handleFailedWordGuess(state, state.activeGuesserId, msg, now);
  }

  if (state.phase === "ROUND_END") {
    const nextState = startNewRoundState(state, state.round + 1, now, rng);
    return {
      state: nextState,
      systemMessages: [
        {
          channel: "public",
          content: `Ronde ${nextState.round} dimulai! Kata rahasia baru (${nextState.secretWord.length} huruf).`,
        },
      ],
    };
  }

  return { state };
}

export function getWordtrapPlayerView(
  state: WordtrapState,
  playerId: string,
): WordtrapPlayerView {
  const me = state.players.find((p) => p.id === playerId);
  const revealAll = state.phase === "ROUND_END" || state.phase === "GAME_OVER";

  // Susun tampilan slot kata tanpa membocorkan huruf rahasia maupun status trap lawan
  const slots: Array<string | null> = Array.from({ length: state.secretWord.length }, (_, idx) => {
    const actualChar = state.secretWord[idx]!;
    if (revealAll) return actualChar;
    if (state.config.mode === "hidden") return null;

    // Mode Reveal: tampilkan huruf asli jika sudah ditebak benar
    if (state.guessedLetters[actualChar] === "correct") {
      return actualChar;
    }
    // Atau tampilkan huruf palsu jika ada trap aktif di slot ini
    const trapAtSlot = state.activeTraps.find((t) => t.slotIndex === idx);
    if (trapAtSlot) {
      return trapAtSlot.letter;
    }
    return null;
  });

  // Susun status keyboard A–Z: trap aktif tampil sebagai "correct" (Hijau)
  const keyboard: Record<string, LetterStatus> = {};
  for (const ch of ALPHABET) {
    const genuine = state.guessedLetters[ch];
    if (genuine) {
      keyboard[ch] = genuine;
    } else if (!revealAll && state.activeTraps.some((t) => t.letter === ch)) {
      keyboard[ch] = "correct";
    } else {
      keyboard[ch] = "unused";
    }
  }

  const currentTurnPlayerId =
    state.phase === "PLAYING" || state.phase === "GUESSING_WORD"
      ? (state.turnOrder[state.currentTurnIndex] ?? null)
      : null;

  const isMyTurn = state.phase === "PLAYING" && currentTurnPlayerId === playerId && !(me?.eliminatedInRound ?? true);
  const hasEmptyRevealSlot =
    state.config.mode === "reveal"
      ? slots.some((s) => s === null)
      : ALPHABET.some((ch) => keyboard[ch] === "unused");

  const myActiveTrapRaw = !revealAll
    ? state.activeTraps.find((t) => t.ownerId === playerId) ?? null
    : null;
  const trapsUsedInRound = me?.trapsUsedInRound ?? state.config.trapLimit;
  const trapsRemainingInRound = Math.max(0, state.config.trapLimit - trapsUsedInRound);

  return {
    phase: state.phase,
    round: state.round,
    config: state.config,
    wordLength: state.secretWord.length,
    slots,
    keyboard,
    me: {
      id: playerId,
      score: me?.score ?? 0,
      eliminatedInRound: me?.eliminatedInRound ?? true,
      trapUsedInRound: trapsRemainingInRound <= 0,
      trapsUsedInRound,
      trapsRemainingInRound,
      isMyTurn,
      canUseTrap: isMyTurn && trapsRemainingInRound > 0 && hasEmptyRevealSlot,
      canGuessWord: state.phase === "PLAYING" && !(me?.eliminatedInRound ?? true),
      myActiveTrap: myActiveTrapRaw
        ? {
            letter: myActiveTrapRaw.letter,
            slotIndex: myActiveTrapRaw.slotIndex,
            turnsRemaining: myActiveTrapRaw.turnsRemaining,
          }
        : null,
    },
    players: state.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      score: p.score,
      eliminatedInRound: p.eliminatedInRound,
    })),
    turnOrder: state.turnOrder,
    currentTurnPlayerId,
    activeGuesserId: state.activeGuesserId,
    lastRoundResult: state.lastRoundResult,
    logs: state.logs,
    winner: state.winner,
    revealedSecretWord: revealAll ? state.secretWord : null,
  };
}

export function getWordtrapChatChannels(state: WordtrapState, playerId: string): ChatChannel[] {
  if (state.phase === "GAME_OVER") return ["public", "lobby"];
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  return ["public"];
}
