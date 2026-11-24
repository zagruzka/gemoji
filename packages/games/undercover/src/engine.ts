import { pickRandom, shuffle, type GameActionResult, type GameInitContext, type GameResult } from "@undercover/game-core";
import type { ChatChannel, Player } from "@undercover/shared";
import type { UndercoverAction } from "./actions";
import {
  SKIP_VOTE_TARGET,
  type CustomWordPoolItem,
  type UndercoverConfig,
  type UndercoverPlayerInternal,
  type UndercoverPlayerView,
  type UndercoverRole,
  type UndercoverSessionData,
  type UndercoverState,
} from "./state";
import { DEFAULT_UNDERCOVER_WORDS } from "./words";

const MR_BLANK_GUESS_DURATION_MS = 60_000;

function normalizeWord(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, " ");
}

function makeLibraryKey(wordA: string, wordB: string): string {
  return `${normalizeWord(wordA)}::${normalizeWord(wordB)}`;
}

function parseSessionData(raw: unknown): UndercoverSessionData {
  if (raw && typeof raw === "object") {
    const data = raw as Partial<UndercoverSessionData>;
    return {
      usedLibraryKeys: Array.isArray(data.usedLibraryKeys) ? [...data.usedLibraryKeys] : [],
      customPool: Array.isArray(data.customPool) ? [...data.customPool] : [],
    };
  }
  return { usedLibraryKeys: [], customPool: [] };
}

function clampRoleCounts(playerCount: number, config: UndercoverConfig) {
  let undercoverCount = config.undercoverCount;
  let mrBlankCount = config.mrBlankCount;

  // Ensure at least 1 infiltrator and strictly more citizens than infiltrators
  if (undercoverCount + mrBlankCount === 0) {
    undercoverCount = 1;
  }
  const maxInfiltrators = Math.max(1, Math.floor((playerCount - 1) / 2));
  while (undercoverCount + mrBlankCount > maxInfiltrators) {
    if (mrBlankCount > 0) {
      mrBlankCount--;
    } else if (undercoverCount > 1) {
      undercoverCount--;
    } else {
      break;
    }
  }
  return { undercoverCount, mrBlankCount };
}

function pickFromDefaultWords(
  usedKeys: Set<string>,
  rng: () => number,
): { wordA: string; wordB: string; resetUsed: boolean } {
  const unused = DEFAULT_UNDERCOVER_WORDS.filter((p) => !usedKeys.has(makeLibraryKey(p.wordA, p.wordB)));
  if (unused.length > 0) {
    const picked = pickRandom(unused, rng);
    return { ...picked, resetUsed: false };
  }
  const picked = pickRandom(DEFAULT_UNDERCOVER_WORDS, rng);
  return { ...picked, resetUsed: true };
}

function assignWordsAndRoles(
  players: UndercoverPlayerInternal[],
  config: UndercoverConfig,
  pair: { wordA: string; wordB: string; authorId: string | null },
  rng: () => number,
): {
  players: UndercoverPlayerInternal[];
  citizenWord: string;
  undercoverWord: string;
} {
  // 50/50 swap so even custom word authors don't automatically know which word belongs to Citizen
  const swap = rng() < 0.5;
  const citizenWord = swap ? pair.wordB : pair.wordA;
  const undercoverWord = swap ? pair.wordA : pair.wordB;

  const { undercoverCount, mrBlankCount } = clampRoleCounts(players.length, config);

  const playerIds = shuffle(
    players.map((p) => p.id),
    rng,
  );

  // Prevent custom word author from becoming Mr. Blank when other players exist
  const mrBlankIds = new Set<string>();
  const nonAuthorIds = pair.authorId ? playerIds.filter((id) => id !== pair.authorId) : playerIds;
  const mrBlankCandidates = nonAuthorIds.length >= mrBlankCount ? nonAuthorIds : playerIds;
  for (let i = 0; i < mrBlankCount; i++) {
    const id = mrBlankCandidates[i];
    if (id) mrBlankIds.add(id);
  }

  const remainingForUndercover = playerIds.filter((id) => !mrBlankIds.has(id));
  const undercoverIds = new Set<string>(remainingForUndercover.slice(0, undercoverCount));

  const assigned = players.map((player): UndercoverPlayerInternal => {
    if (mrBlankIds.has(player.id)) {
      return { ...player, role: "mr_blank", word: null, alive: true, ready: false };
    }
    if (undercoverIds.has(player.id)) {
      return { ...player, role: "undercover", word: undercoverWord, alive: true, ready: false };
    }
    return { ...player, role: "citizen", word: citizenWord, alive: true, ready: false };
  });

  return { players: assigned, citizenWord, undercoverWord };
}

function buildClueTurnOrder(
  players: UndercoverPlayerInternal[],
  round: number,
  rng: () => number,
): string[] {
  const alive = players.filter((p) => p.alive);
  const shuffled = shuffle(alive, rng);

  // In Round 1, Mr. Blank must never go first
  if (round === 1 && shuffled[0]?.role === "mr_blank") {
    const nonBlankIdx = shuffled.findIndex((p) => p.role !== "mr_blank");
    if (nonBlankIdx > 0) {
      const tmp = shuffled[0]!;
      shuffled[0] = shuffled[nonBlankIdx]!;
      shuffled[nonBlankIdx] = tmp;
    }
  }
  return shuffled.map((p) => p.id);
}

function computeVoteEndsAt(config: UndercoverConfig, now: number): number | null {
  if (config.voteDuration === "unlimited") return null;
  return now + config.voteDuration * 1000;
}

function checkWinner(state: UndercoverState): GameResult | null {
  if (state.winner) return state.winner;

  const alive = state.players.filter((p) => p.alive);
  const aliveCitizens = alive.filter((p) => p.role === "citizen");
  const aliveUndercovers = alive.filter((p) => p.role === "undercover");
  const aliveMrBlanks = alive.filter((p) => p.role === "mr_blank");
  const aliveInfiltrators = [...aliveUndercovers, ...aliveMrBlanks];

  if (aliveInfiltrators.length === 0) {
    return {
      winnerTeam: "citizen",
      winnerPlayerIds: state.players.filter((p) => p.role === "citizen").map((p) => p.id),
      reason: "Semua Undercover dan Mr. Blank berhasil dieliminasi!",
    };
  }

  if (aliveInfiltrators.length >= aliveCitizens.length || alive.length <= 2) {
    const team = aliveUndercovers.length > 0 ? "undercover" : "mr_blank";
    return {
      winnerTeam: team,
      winnerPlayerIds: state.players
        .filter((p) => p.role === "undercover" || p.role === "mr_blank")
        .map((p) => p.id),
      reason:
        team === "undercover"
          ? "Tim Undercover berhasil bertahan hingga akhir!"
          : "Mr. Blank berhasil bertahan hingga akhir!",
    };
  }

  return null;
}

function startNextRound(state: UndercoverState, nextRound: number, now: number): UndercoverState {
  const turnOrder = buildClueTurnOrder(state.players, nextRound, Math.random);

  // Jika Timer Clue = 0 (Tatap Muka / Tanpa Timer), lewati fase clue dan langsung ke VOTING
  if (state.config.clueDurationSec === 0) {
    return {
      ...state,
      phase: "VOTING",
      round: nextRound,
      turnOrder,
      currentTurnIndex: 0,
      votes: {},
      phaseEndsAt: computeVoteEndsAt(state.config, now),
    };
  }

  return {
    ...state,
    phase: "CLUE_ROUND",
    round: nextRound,
    turnOrder,
    currentTurnIndex: 0,
    votes: {},
    phaseEndsAt: now + state.config.clueDurationSec * 1000,
  };
}

function resolveVoting(state: UndercoverState, now: number): GameActionResult<UndercoverState> {
  const tally = new Map<string, number>();
  for (const targetId of Object.values(state.votes)) {
    tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
  }

  if (tally.size === 0) {
    const nextState: UndercoverState = {
      ...state,
      lastElimination: {
        round: state.round,
        eliminatedPlayerId: null,
        eliminatedRole: null,
        votes: { ...state.votes },
        reason: "no_votes",
      },
    };
    return {
      state: startNextRound(nextState, state.round + 1, now),
      systemMessages: [{ channel: "public", content: "Tidak ada suara masuk. Ronde baru dimulai!" }],
    };
  }

  let topVotes = 0;
  let topCandidates: string[] = [];
  for (const [targetId, count] of tally.entries()) {
    if (count > topVotes) {
      topVotes = count;
      topCandidates = [targetId];
    } else if (count === topVotes) {
      topCandidates.push(targetId);
    }
  }

  if (topCandidates.length > 1) {
    const nextState: UndercoverState = {
      ...state,
      lastElimination: {
        round: state.round,
        eliminatedPlayerId: null,
        eliminatedRole: null,
        votes: { ...state.votes },
        reason: "tie",
      },
    };
    return {
      state: startNextRound(nextState, state.round + 1, now),
      systemMessages: [
        { channel: "public", content: "Hasil voting seri! Tidak ada pemain yang tereliminasi." },
      ],
    };
  }

  const eliminatedId = topCandidates[0]!;
  if (eliminatedId === SKIP_VOTE_TARGET) {
    const nextState: UndercoverState = {
      ...state,
      lastElimination: {
        round: state.round,
        eliminatedPlayerId: null,
        eliminatedRole: null,
        votes: { ...state.votes },
        reason: "skipped",
      },
    };
    return {
      state: startNextRound(nextState, state.round + 1, now),
      systemMessages: [
        { channel: "public", content: "Voting memilih Skip! Tidak ada pemain yang tereliminasi." },
      ],
    };
  }

  const target = state.players.find((p) => p.id === eliminatedId)!;

  const updatedPlayers = state.players.map((p) =>
    p.id === eliminatedId ? { ...p, alive: false } : p,
  );

  const eliminationRecord = {
    round: state.round,
    eliminatedPlayerId: eliminatedId,
    eliminatedRole: target.role,
    votes: { ...state.votes },
    reason: "voted" as const,
  };

  // Mr. Blank gets a final chance to guess the Citizen word
  if (target.role === "mr_blank") {
    return {
      state: {
        ...state,
        players: updatedPlayers,
        phase: "MR_BLANK_GUESS",
        phaseEndsAt: now + MR_BLANK_GUESS_DURATION_MS,
        lastElimination: eliminationRecord,
        mrBlankGuessPlayerId: eliminatedId,
        mrBlankLastGuess: null,
      },
      systemMessages: [
        {
          channel: "public",
          content: `${target.nickname} tereliminasi dan ternyata adalah Mr. Blank! Ia punya 1 menit untuk menebak kata Citizen.`,
        },
      ],
    };
  }

  const nextState: UndercoverState = {
    ...state,
    players: updatedPlayers,
    lastElimination: eliminationRecord,
  };

  const winner = checkWinner(nextState);
  if (winner) {
    return {
      state: {
        ...nextState,
        phase: "GAME_OVER",
        phaseEndsAt: null,
        winner,
      },
      systemMessages: [{ channel: "public", content: winner.reason }],
    };
  }

  const roleLabel = target.role === "undercover" ? "Undercover" : "Citizen";
  return {
    state: startNextRound(nextState, state.round + 1, now),
    systemMessages: [
      {
        channel: "public",
        content: `${target.nickname} tereliminasi (${roleLabel}). Lanjut ke ronde berikutnya!`,
      },
    ],
  };
}

export function initUndercover(
  players: Player[],
  config: UndercoverConfig,
  context: GameInitContext,
): UndercoverState {
  const rng = context.rng ?? Math.random;
  const sessionData = parseSessionData(context.previousSessionData);

  const internalPlayers: UndercoverPlayerInternal[] = players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    avatar: p.avatar,
    role: null,
    word: null,
    alive: true,
    ready: false,
  }));

  // Mode Custom Word: if pool is empty, collect 2 word pairs from every player first
  if (config.wordMode === "custom" && sessionData.customPool.length === 0) {
    return {
      phase: "SUBMIT_CUSTOM_WORDS",
      phaseEndsAt: null,
      config,
      round: 1,
      players: internalPlayers,
      citizenWord: null,
      undercoverWord: null,
      wordAuthorId: null,
      submittedCustomWords: {},
      turnOrder: [],
      currentTurnIndex: 0,
      clues: [],
      votes: {},
      lastElimination: null,
      mrBlankGuessPlayerId: null,
      mrBlankLastGuess: null,
      winner: null,
      sessionData,
    };
  }

  let selectedPair: { wordA: string; wordB: string; authorId: string | null };
  let nextSessionData = sessionData;

  if (config.wordMode === "custom") {
    const [nextItem, ...rest] = sessionData.customPool;
    selectedPair = {
      wordA: nextItem!.wordA,
      wordB: nextItem!.wordB,
      authorId: nextItem!.authorId,
    };
    nextSessionData = {
      ...sessionData,
      customPool: rest,
    };
  } else {
    const usedSet = new Set(sessionData.usedLibraryKeys);
    const externalPick = context.pickLibraryWordPair?.(usedSet) ?? null;
    if (externalPick) {
      selectedPair = { ...externalPick, authorId: null };
      nextSessionData = {
        ...sessionData,
        usedLibraryKeys: [...sessionData.usedLibraryKeys, makeLibraryKey(externalPick.wordA, externalPick.wordB)],
      };
    } else {
      const picked = pickFromDefaultWords(usedSet, rng);
      selectedPair = { wordA: picked.wordA, wordB: picked.wordB, authorId: null };
      nextSessionData = {
        ...sessionData,
        usedLibraryKeys: picked.resetUsed
          ? [makeLibraryKey(picked.wordA, picked.wordB)]
          : [...sessionData.usedLibraryKeys, makeLibraryKey(picked.wordA, picked.wordB)],
      };
    }
  }

  const assigned = assignWordsAndRoles(internalPlayers, config, selectedPair, rng);

  return {
    phase: "REVEAL_WORD",
    phaseEndsAt: null,
    config,
    round: 1,
    players: assigned.players,
    citizenWord: assigned.citizenWord,
    undercoverWord: assigned.undercoverWord,
    wordAuthorId: selectedPair.authorId,
    submittedCustomWords: {},
    turnOrder: [],
    currentTurnIndex: 0,
    clues: [],
    votes: {},
    lastElimination: null,
    mrBlankGuessPlayerId: null,
    mrBlankLastGuess: null,
    winner: null,
    sessionData: nextSessionData,
  };
}

export function validateUndercoverAction(
  state: UndercoverState,
  playerId: string,
  action: UndercoverAction,
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Pemain tidak ditemukan di game ini";

  switch (action.actionType) {
    case "SUBMIT_CUSTOM_WORDS":
      if (state.phase !== "SUBMIT_CUSTOM_WORDS") return "Bukan fase pengisian kata custom";
      if (state.submittedCustomWords[playerId]) return "Kamu sudah mengirim 1 pasang kata";
      return null;

    case "MARK_READY":
      if (state.phase !== "REVEAL_WORD") return "Bukan fase melihat kata";
      return null;

    case "SUBMIT_CLUE": {
      if (state.phase !== "CLUE_ROUND") return "Bukan fase memberi clue";
      if (!player.alive) return "Pemain yang tereliminasi tidak bisa memberi clue";
      const currentPlayerId = state.turnOrder[state.currentTurnIndex];
      if (currentPlayerId !== playerId) return "Belum giliranmu memberi clue";
      return null;
    }

    case "CAST_VOTE": {
      if (state.phase !== "VOTING") return "Bukan fase voting";
      if (!player.alive) return "Pemain yang tereliminasi tidak bisa voting";
      if (action.data.targetPlayerId === SKIP_VOTE_TARGET) return null;
      if (action.data.targetPlayerId === playerId) return "Tidak bisa memilih diri sendiri";
      const target = state.players.find((p) => p.id === action.data.targetPlayerId && p.alive);
      if (!target) return "Target vote tidak valid atau sudah tereliminasi";
      return null;
    }

    case "SUBMIT_MR_BLANK_GUESS":
      if (state.phase !== "MR_BLANK_GUESS") return "Bukan fase tebakan Mr. Blank";
      if (state.mrBlankGuessPlayerId !== playerId) return "Hanya Mr. Blank yang bisa menebak";
      return null;
  }
}

export function reduceUndercover(
  state: UndercoverState,
  playerId: string,
  action: UndercoverAction,
  now: number,
  rng: () => number = Math.random,
): GameActionResult<UndercoverState> {
  switch (action.actionType) {
    case "SUBMIT_CUSTOM_WORDS": {
      const nextSubmitted = {
        ...state.submittedCustomWords,
        [playerId]: [...action.data.pairs],
      };

      const allSubmitted = state.players.every((p) => Boolean(nextSubmitted[p.id]));
      if (!allSubmitted) {
        return {
          state: { ...state, submittedCustomWords: nextSubmitted },
        };
      }

      const pool: CustomWordPoolItem[] = [];
      let idx = 0;
      for (const [authorId, pairs] of Object.entries(nextSubmitted)) {
        for (const pair of pairs) {
          pool.push({
            id: `cw_${now}_${idx++}`,
            wordA: pair.wordA,
            wordB: pair.wordB,
            authorId,
          });
        }
      }

      const shuffledPool = shuffle(pool, rng);
      const [firstPair, ...remainingPool] = shuffledPool;
      const assigned = assignWordsAndRoles(
        state.players,
        state.config,
        { wordA: firstPair!.wordA, wordB: firstPair!.wordB, authorId: firstPair!.authorId },
        rng,
      );

      return {
        state: {
          ...state,
          phase: "REVEAL_WORD",
          players: assigned.players,
          citizenWord: assigned.citizenWord,
          undercoverWord: assigned.undercoverWord,
          wordAuthorId: firstPair!.authorId,
          submittedCustomWords: nextSubmitted,
          sessionData: {
            ...state.sessionData,
            customPool: remainingPool,
          },
        },
        systemMessages: [
          {
            channel: "public",
            content: `Semua pemain selesai mengirim kata! Total ${shuffledPool.length} pasang kata siap dimainkan.`,
          },
        ],
      };
    }

    case "MARK_READY": {
      const updatedPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, ready: true } : p,
      );
      const allReady = updatedPlayers.every((p) => p.ready);
      if (!allReady) {
        return { state: { ...state, players: updatedPlayers } };
      }
      const nextState = startNextRound({ ...state, players: updatedPlayers }, 1, now);
      return {
        state: nextState,
        systemMessages: [
          {
            channel: "public",
            content:
              state.config.clueDurationSec === 0
                ? "Semua siap! Silakan ucapkan clue tatap muka lalu langsung voting."
                : "Semua siap! Ronde 1 memberi clue dimulai.",
          },
        ],
      };
    }

    case "SUBMIT_CLUE": {
      const nextClues = [
        ...state.clues,
        { round: state.round, playerId, clue: action.data.clue },
      ];
      const nextIndex = state.currentTurnIndex + 1;

      if (nextIndex >= state.turnOrder.length) {
        return {
          state: {
            ...state,
            clues: nextClues,
            phase: "VOTING",
            votes: {},
            phaseEndsAt: computeVoteEndsAt(state.config, now),
          },
          systemMessages: [
            {
              channel: "public",
              content:
                state.config.voteDuration === "unlimited"
                  ? "Semua clue sudah terkumpul! Saatnya berdiskusi & voting (tanpa batas waktu)."
                  : `Semua clue sudah terkumpul! Voting dibuka selama ${state.config.voteDuration} detik.`,
            },
          ],
        };
      }

      return {
        state: {
          ...state,
          clues: nextClues,
          currentTurnIndex: nextIndex,
          phaseEndsAt: now + state.config.clueDurationSec * 1000,
        },
      };
    }

    case "CAST_VOTE": {
      const nextVotes = { ...state.votes, [playerId]: action.data.targetPlayerId };
      const nextState = { ...state, votes: nextVotes };
      const alivePlayers = state.players.filter((p) => p.alive);
      const allVoted = alivePlayers.every((p) => Boolean(nextVotes[p.id]));

      if (allVoted) {
        return resolveVoting(nextState, now);
      }
      return { state: nextState };
    }

    case "SUBMIT_MR_BLANK_GUESS": {
      const isCorrect =
        state.citizenWord !== null &&
        normalizeWord(action.data.guess) === normalizeWord(state.citizenWord);

      if (isCorrect) {
        const winner: GameResult = {
          winnerTeam: "mr_blank",
          winnerPlayerIds: [playerId],
          reason: `Mr. Blank berhasil menebak kata Citizen ("${state.citizenWord}") dan langsung menang!`,
        };
        return {
          state: {
            ...state,
            phase: "GAME_OVER",
            phaseEndsAt: null,
            mrBlankLastGuess: action.data.guess,
            winner,
          },
          systemMessages: [{ channel: "public", content: winner.reason }],
        };
      }

      const nextState: UndercoverState = {
        ...state,
        mrBlankGuessPlayerId: null,
        mrBlankLastGuess: action.data.guess,
      };

      const winner = checkWinner(nextState);
      if (winner) {
        return {
          state: {
            ...nextState,
            phase: "GAME_OVER",
            phaseEndsAt: null,
            winner,
          },
          systemMessages: [
            { channel: "public", content: `Tebakan Mr. Blank ("${action.data.guess}") salah! ${winner.reason}` },
          ],
        };
      }

      return {
        state: startNextRound(nextState, state.round + 1, now),
        systemMessages: [
          {
            channel: "public",
            content: `Tebakan Mr. Blank ("${action.data.guess}") salah! Permainan berlanjut.`,
          },
        ],
      };
    }
  }
}

export function onUndercoverTimeout(
  state: UndercoverState,
  now: number,
): GameActionResult<UndercoverState> {
  if (state.phase === "CLUE_ROUND") {
    const currentPlayerId = state.turnOrder[state.currentTurnIndex];
    if (!currentPlayerId) return { state };
    return reduceUndercover(
      state,
      currentPlayerId,
      { actionType: "SUBMIT_CLUE", data: { clue: "(Waktu habis)" } },
      now,
    );
  }

  if (state.phase === "VOTING") {
    return resolveVoting(state, now);
  }

  if (state.phase === "MR_BLANK_GUESS" && state.mrBlankGuessPlayerId) {
    return reduceUndercover(
      state,
      state.mrBlankGuessPlayerId,
      { actionType: "SUBMIT_MR_BLANK_GUESS", data: { guess: "-" } },
      now,
    );
  }

  return { state };
}

export function getUndercoverPlayerView(
  state: UndercoverState,
  playerId: string,
): UndercoverPlayerView {
  const me = state.players.find((p) => p.id === playerId);
  const isGameOver = state.phase === "GAME_OVER";

  let knownRole: UndercoverRole | null = null;
  if (me?.role) {
    if (isGameOver || !me.alive || me.role === "mr_blank" || !state.config.blindRole) {
      knownRole = me.role;
    }
  }

  const hasAssignedRoles = state.players.some((p) => p.role !== null);
  const roleSummary = hasAssignedRoles
    ? {
        citizen: state.players.filter((p) => p.role === "citizen").length,
        undercover: state.players.filter((p) => p.role === "undercover").length,
        mrBlank: state.players.filter((p) => p.role === "mr_blank").length,
      }
    : (() => {
        const clamped = clampRoleCounts(state.players.length, state.config);
        return {
          citizen: Math.max(0, state.players.length - clamped.undercoverCount - clamped.mrBlankCount),
          undercover: clamped.undercoverCount,
          mrBlank: clamped.mrBlankCount,
        };
      })();

  return {
    phase: state.phase,
    round: state.round,
    config: state.config,
    me: {
      id: playerId,
      alive: me?.alive ?? false,
      ready: me?.ready ?? false,
      word: me?.word ?? null,
      knownRole,
      hasSubmittedCustomWords: Boolean(state.submittedCustomWords[playerId]),
      myVote: state.votes[playerId] ?? null,
    },
    players: state.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      alive: p.alive,
      ready: p.ready,
      revealedRole: isGameOver || !p.alive ? p.role : null,
      revealedWord: isGameOver ? p.word : null,
    })),
    roleSummary,
    submittedCustomWordPlayerIds: Object.keys(state.submittedCustomWords),
    customPoolRemaining: state.sessionData.customPool.length,
    turnOrder: state.turnOrder,
    currentTurnPlayerId:
      state.phase === "CLUE_ROUND" ? (state.turnOrder[state.currentTurnIndex] ?? null) : null,
    clues: state.clues,
    liveVotes:
      state.phase === "VOTING" && state.config.voteMode === "open" ? { ...state.votes } : null,
    votedPlayerIds: Object.keys(state.votes),
    lastElimination: state.lastElimination,
    mrBlankGuessPlayerId: state.mrBlankGuessPlayerId,
    mrBlankLastGuess: state.mrBlankLastGuess,
    winner: state.winner,
    revealSummary: isGameOver
      ? {
          citizenWord: state.citizenWord,
          undercoverWord: roleSummary.undercover > 0 ? state.undercoverWord : null,
        }
      : null,
  };
}

export function getUndercoverChatChannels(state: UndercoverState, playerId: string): ChatChannel[] {
  if (state.phase === "GAME_OVER") return ["public", "lobby"];
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  if (!player.alive) return ["dead"];
  return ["public"];
}
