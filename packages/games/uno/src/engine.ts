import {
  shuffle,
  type GameActionResult,
  type GameInitContext,
  type GameResult,
} from "@gemoji/game-core";
import type { ChatChannel, Player } from "@gemoji/shared";
import type { UnoAction } from "./actions";
import {
  UNO_COLORS,
  type UnoCard,
  type UnoCardValue,
  type UnoColor,
  type UnoConfig,
  type UnoDirection,
  type UnoLogEntry,
  type UnoPlayerInternal,
  type UnoPlayerView,
  type UnoState,
} from "./state";

const MAX_LOGS = 30;
export const UNO_CATCH_DELAY_MS = 1000;
const NUMBER_VALUES: readonly UnoCardValue[] = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
];

const COLOR_LABELS: Record<UnoColor, string> = {
  red: "Merah",
  yellow: "Kuning",
  green: "Hijau",
  blue: "Biru",
};

export function createStandardUnoDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  let idx = 0;

  for (const color of UNO_COLORS) {
    deck.push({ id: `c_${idx++}`, color, value: "0" });
    const doubled: UnoCardValue[] = [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "skip",
      "reverse",
      "draw2",
    ];
    for (const value of doubled) {
      deck.push({ id: `c_${idx++}`, color, value });
      deck.push({ id: `c_${idx++}`, color, value });
    }
  }

  for (let i = 0; i < 4; i++) {
    deck.push({ id: `c_${idx++}`, color: "wild", value: "wild" });
    deck.push({ id: `c_${idx++}`, color: "wild", value: "wild4" });
  }

  return deck; // 108 kartu standar
}

function formatCardLabel(card: UnoCard, chosenColor?: UnoColor): string {
  const valMap: Record<UnoCardValue, string> = {
    "0": "0",
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",
    skip: "Skip",
    reverse: "Reverse",
    draw2: "+2",
    wild: "Wild",
    wild4: "Wild +4",
  };
  if (card.color === "wild") {
    return chosenColor ? `${valMap[card.value]} (${COLOR_LABELS[chosenColor]})` : valMap[card.value];
  }
  return `${COLOR_LABELS[card.color]} ${valMap[card.value]}`;
}

function makeLog(
  type: UnoLogEntry["type"],
  message: string,
  now: number,
  seq = 0,
): UnoLogEntry {
  return {
    id: `uno_${now}_${seq}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    message,
    timestamp: now,
  };
}

function appendLogs(existing: UnoLogEntry[], added: UnoLogEntry[]): UnoLogEntry[] {
  const combined = [...existing, ...added];
  return combined.length > MAX_LOGS ? combined.slice(combined.length - MAX_LOGS) : combined;
}

function computeTurnEndsAt(config: UnoConfig, now: number): number | null {
  if (config.turnDurationSec === 0) return null;
  return now + config.turnDurationSec * 1000;
}

function getPlayerNickname(players: UnoPlayerInternal[], playerId: string): string {
  return players.find((p) => p.id === playerId)?.nickname ?? "Pemain";
}

function nextIndex(currentIndex: number, direction: UnoDirection, count: number, steps = 1): number {
  return (((currentIndex + direction * steps) % count) + count) % count;
}

/**
 * Mengambil `count` kartu dari drawPile; otomatis mengocok ulang discardPile
 * (kecuali kartu paling atas) jika drawPile habis.
 */
function drawCards(
  drawPile: UnoCard[],
  discardPile: UnoCard[],
  count: number,
  rng: () => number,
): {
  drawn: UnoCard[];
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  reshuffled: boolean;
} {
  let currentDraw = [...drawPile];
  let currentDiscard = [...discardPile];
  const drawn: UnoCard[] = [];
  let reshuffled = false;

  for (let i = 0; i < count; i++) {
    if (currentDraw.length === 0) {
      if (currentDiscard.length <= 1) break;
      const top = currentDiscard[currentDiscard.length - 1]!;
      const recyclable = currentDiscard.slice(0, -1);
      currentDraw = shuffle(recyclable, rng);
      currentDiscard = [top];
      reshuffled = true;
    }
    const card = currentDraw.pop();
    if (card) drawn.push(card);
  }

  return { drawn, drawPile: currentDraw, discardPile: currentDiscard, reshuffled };
}

export function isCardPlayable(state: UnoState, card: UnoCard): boolean {
  const top = state.discardPile[state.discardPile.length - 1]!;

  // Jika sedang dalam rantai stacking (+2 / +4)
  if (state.pendingDraw > 0 && state.config.stacking) {
    if (state.pendingDrawType === "draw2") {
      return card.value === "draw2" || card.value === "wild4";
    }
    if (state.pendingDrawType === "wild4") {
      return card.value === "wild4";
    }
  }

  if (card.color === "wild") return true;
  if (card.color === state.activeColor) return true;
  if (card.value === top.value) return true;
  return false;
}

export function initUno(
  players: Player[],
  config: UnoConfig,
  context: GameInitContext,
): UnoState {
  const rng = context.rng ?? Math.random;
  let deck = shuffle(createStandardUnoDeck(), rng);

  const internalPlayers: UnoPlayerInternal[] = players.map((p) => {
    const hand = deck.splice(0, config.startingHandSize);
    return {
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      hand,
      unoDeclared: false,
    };
  });

  // Pilih 1 kartu angka sebagai kartu pembuka Discard Pile
  let starterIdx = deck.findIndex(
    (c) => c.color !== "wild" && NUMBER_VALUES.includes(c.value),
  );
  if (starterIdx === -1) starterIdx = 0;
  const [starterCard] = deck.splice(starterIdx, 1);
  const activeColor: UnoColor =
    starterCard && starterCard.color !== "wild" ? starterCard.color : "red";

  const turnOrder = shuffle(
    internalPlayers.map((p) => p.id),
    rng,
  );

  return {
    phase: "PLAYING",
    phaseEndsAt: computeTurnEndsAt(config, context.now),
    config,
    players: internalPlayers,
    turnOrder,
    currentTurnIndex: 0,
    direction: 1,
    drawPile: deck,
    discardPile: [starterCard!],
    activeColor,
    pendingDraw: 0,
    pendingDrawType: null,
    drawnPlayableCardId: null,
    unoVulnerablePlayerId: null,
    unoCatchableAt: null,
    logs: [
      makeLog(
        "system",
        `Permainan UNO dimulai! Kartu pembuka: ${formatCardLabel(starterCard!)}.`,
        context.now,
        0,
      ),
    ],
    winner: null,
  };
}

export function validateUnoAction(
  state: UnoState,
  playerId: string,
  action: UnoAction,
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Pemain tidak ditemukan di game ini";
  if (state.phase !== "PLAYING") return "Permainan sudah selesai";

  const currentPlayerId = state.turnOrder[state.currentTurnIndex];

  switch (action.actionType) {
    case "PLAY_CARD": {
      if (currentPlayerId !== playerId) return "Belum giliranmu bermain";
      const card = player.hand.find((c) => c.id === action.data.cardId);
      if (!card) return "Kartu tidak ada di tanganmu";
      if (!isCardPlayable(state, card)) {
        if (state.pendingDraw > 0) {
          return state.pendingDrawType === "wild4"
            ? "Hanya bisa menumpuk dengan Wild +4 atau ambil kartu penalti"
            : "Hanya bisa menumpuk dengan +2 / Wild +4 atau ambil kartu penalti";
        }
        return "Kartu tersebut tidak cocok dengan kartu teratas";
      }
      if (card.color === "wild" && !action.data.chosenColor) {
        return "Pilih warna baru untuk kartu Wild";
      }
      return null;
    }

    case "DRAW_CARD": {
      if (currentPlayerId !== playerId) return "Belum giliranmu bermain";
      if (state.drawnPlayableCardId !== null) {
        return "Kamu sudah mengambil kartu. Mainkan kartu yang cocok atau klik Skip";
      }
      return null;
    }

    case "PASS_TURN": {
      if (currentPlayerId !== playerId) return "Belum giliranmu bermain";
      if (state.drawnPlayableCardId === null) {
        return "Ambil kartu terlebih dahulu sebelum melewati giliran";
      }
      return null;
    }

    case "CALL_UNO": {
      const canSaveSelf =
        player.hand.length === 1 &&
        state.unoVulnerablePlayerId === playerId &&
        !player.unoDeclared;
      if (!canSaveSelf) {
        return "Tombol UNO! hanya bisa ditekan saat kartu tersisa 1";
      }
      return null;
    }

    case "CATCH_UNO": {
      if (action.data.targetPlayerId === playerId) {
        return "Tidak bisa menangkap diri sendiri";
      }
      if (state.unoVulnerablePlayerId !== action.data.targetPlayerId) {
        return "Pemain tersebut sudah aman atau tidak dalam status lupa UNO";
      }
      return null;
    }
  }
}

export function reduceUno(
  state: UnoState,
  playerId: string,
  action: UnoAction,
  now: number,
  rng: () => number = Math.random,
): GameActionResult<UnoState> {
  const actorName = getPlayerNickname(state.players, playerId);

  switch (action.actionType) {
    case "CALL_UNO": {
      const updatedPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, unoDeclared: true } : p,
      );
      const nextVulnerable =
        state.unoVulnerablePlayerId === playerId ? null : state.unoVulnerablePlayerId;
      const nextCatchableAt =
        nextVulnerable === null ? null : state.unoCatchableAt;
      const msg = `${actorName} berteriak "UNO!"`;
      return {
        state: {
          ...state,
          players: updatedPlayers,
          unoVulnerablePlayerId: nextVulnerable,
          unoCatchableAt: nextCatchableAt,
          logs: appendLogs(state.logs, [makeLog("uno", msg, now, 0)]),
        },
        systemMessages: [{ channel: "public", content: msg }],
      };
    }

    case "CATCH_UNO": {
      if (state.unoCatchableAt !== null && now < state.unoCatchableAt) {
        return { state };
      }
      const targetId = action.data.targetPlayerId;
      const targetName = getPlayerNickname(state.players, targetId);
      const drawRes = drawCards(state.drawPile, state.discardPile, 2, rng);
      const updatedPlayers = state.players.map((p) =>
        p.id === targetId
          ? { ...p, hand: [...p.hand, ...drawRes.drawn], unoDeclared: false }
          : p,
      );
      const msg = `${actorName} menangkap ${targetName} lupa teriak UNO! (+${drawRes.drawn.length} kartu)`;
      return {
        state: {
          ...state,
          players: updatedPlayers,
          drawPile: drawRes.drawPile,
          discardPile: drawRes.discardPile,
          unoVulnerablePlayerId: null,
          unoCatchableAt: null,
          logs: appendLogs(state.logs, [makeLog("catch", msg, now, 0)]),
        },
        systemMessages: [{ channel: "public", content: msg }],
      };
    }

    case "PASS_TURN": {
      const nextIdx = nextIndex(state.currentTurnIndex, state.direction, state.turnOrder.length, 1);
      const msg = `${actorName} menyimpan kartu dan melewati giliran.`;
      return {
        state: {
          ...state,
          currentTurnIndex: nextIdx,
          phaseEndsAt: computeTurnEndsAt(state.config, now),
          drawnPlayableCardId: null,
          logs: appendLogs(state.logs, [makeLog("draw", msg, now, 0)]),
        },
      };
    }

    case "DRAW_CARD": {
      const logs: UnoLogEntry[] = [];
      const sysMsgs: Array<{ channel: ChatChannel; content: string }> = [];
      let seq = 0;

      // Kasus 1: Mengambil akumulasi penalti +2 / +4
      if (state.pendingDraw > 0) {
        const penaltyCount = state.pendingDraw;
        const drawRes = drawCards(state.drawPile, state.discardPile, penaltyCount, rng);
        const updatedPlayers = state.players.map((p) =>
          p.id === playerId
            ? { ...p, hand: [...p.hand, ...drawRes.drawn], unoDeclared: false }
            : p,
        );
        const nextIdx = nextIndex(
          state.currentTurnIndex,
          state.direction,
          state.turnOrder.length,
          1,
        );
        const msg = `${actorName} mengambil penalti +${drawRes.drawn.length} kartu!`;
        logs.push(makeLog("draw", msg, now, seq++));
        sysMsgs.push({ channel: "public", content: msg });

        const clearVulnerable = state.unoVulnerablePlayerId === playerId;
        return {
          state: {
            ...state,
            players: updatedPlayers,
            drawPile: drawRes.drawPile,
            discardPile: drawRes.discardPile,
            currentTurnIndex: nextIdx,
            phaseEndsAt: computeTurnEndsAt(state.config, now),
            pendingDraw: 0,
            pendingDrawType: null,
            drawnPlayableCardId: null,
            unoVulnerablePlayerId: clearVulnerable ? null : state.unoVulnerablePlayerId,
            unoCatchableAt: clearVulnerable ? null : state.unoCatchableAt,
            logs: appendLogs(state.logs, logs),
          },
          systemMessages: sysMsgs,
        };
      }

      // Kasus 2: Ambil 1 kartu normal
      const drawRes = drawCards(state.drawPile, state.discardPile, 1, rng);
      const drawnCard = drawRes.drawn[0];
      const updatedPlayers = state.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              hand: drawnCard ? [...p.hand, drawnCard] : p.hand,
              unoDeclared: false,
            }
          : p,
      );

      if (drawRes.reshuffled) {
        logs.push(makeLog("system", "Deck habis, tumpukan buang dikocok ulang!", now, seq++));
      }

      const clearVulnerable = state.unoVulnerablePlayerId === playerId;
      const tempState: UnoState = {
        ...state,
        players: updatedPlayers,
        drawPile: drawRes.drawPile,
        discardPile: drawRes.discardPile,
        drawnPlayableCardId: null,
        unoVulnerablePlayerId: clearVulnerable ? null : state.unoVulnerablePlayerId,
        unoCatchableAt: clearVulnerable ? null : state.unoCatchableAt,
      };

      // Selalu tetap di giliran pemain setelah ambil 1 kartu agar lawan tidak bisa menebak
      // apakah pemain punya kartu yang cocok atau tidak (pemain klik Lewati Giliran atau mainkan kartu).
      const msg = `${actorName} mengambil 1 kartu dari deck.`;
      logs.push(makeLog("draw", msg, now, seq++));
      return {
        state: {
          ...tempState,
          drawnPlayableCardId: drawnCard?.id ?? "__DRAWN__",
          phaseEndsAt: computeTurnEndsAt(state.config, now),
          logs: appendLogs(state.logs, logs),
        },
      };
    }

    case "PLAY_CARD": {
      const player = state.players.find((p) => p.id === playerId)!;
      const card = player.hand.find((c) => c.id === action.data.cardId)!;
      const remainingHand = player.hand.filter((c) => c.id !== card.id);
      const nextColor: UnoColor =
        card.color === "wild" ? action.data.chosenColor! : card.color;

      const logs: UnoLogEntry[] = [];
      const sysMsgs: Array<{ channel: ChatChannel; content: string }> = [];
      let seq = 0;

      const cardLabel = formatCardLabel(card, card.color === "wild" ? nextColor : undefined);
      const playMsg = `${actorName} memainkan ${cardLabel}.`;
      logs.push(makeLog("play", playMsg, now, seq++));

      let nextDrawPile = state.drawPile;
      let nextDiscardPile = [...state.discardPile, card];
      let nextDirection: UnoDirection = state.direction;
      let nextPendingDraw = state.pendingDraw;
      let nextPendingDrawType = state.pendingDrawType;
      let nextTurnIdx = state.currentTurnIndex;

      // Update tangan pemain yang baru main
      let updatedPlayers = state.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              hand: remainingHand,
              unoDeclared: remainingHand.length === 1 ? p.unoDeclared : false,
            }
          : p,
      );

      // Cek kondisi MENANG (0 kartu)!
      if (remainingHand.length === 0) {
        const winner: GameResult = {
          winnerTeam: playerId,
          winnerPlayerIds: [playerId],
          reason: `${actorName} menghabiskan seluruh kartunya dan memenangkan UNO!`,
        };
        sysMsgs.push({ channel: "public", content: winner.reason });
        return {
          state: {
            ...state,
            phase: "GAME_OVER",
            phaseEndsAt: null,
            players: updatedPlayers,
            discardPile: nextDiscardPile,
            activeColor: nextColor,
            pendingDraw: 0,
            pendingDrawType: null,
            drawnPlayableCardId: null,
            unoVulnerablePlayerId: null,
            unoCatchableAt: null,
            winner,
            logs: appendLogs(state.logs, logs),
          },
          systemMessages: sysMsgs,
        };
      }

      // Efek kartu spesial
      const playerCount = state.turnOrder.length;
      if (card.value === "reverse") {
        if (playerCount === 2) {
          // Mode 2 pemain: Reverse berfungsi sebagai Skip (giliran tetap di pemain ini)
          nextTurnIdx = state.currentTurnIndex;
          logs.push(makeLog("system", "Reverse (2 pemain) → lawan dilewati!", now, seq++));
        } else {
          nextDirection = (state.direction * -1) as UnoDirection;
          nextTurnIdx = nextIndex(state.currentTurnIndex, nextDirection, playerCount, 1);
          logs.push(makeLog("system", "Arah giliran dibalik!", now, seq++));
        }
      } else if (card.value === "skip") {
        const skippedId = state.turnOrder[nextIndex(state.currentTurnIndex, nextDirection, playerCount, 1)]!;
        const skippedName = getPlayerNickname(updatedPlayers, skippedId);
        nextTurnIdx = nextIndex(state.currentTurnIndex, nextDirection, playerCount, 2);
        logs.push(makeLog("system", `Giliran ${skippedName} dilewati!`, now, seq++));
      } else if (card.value === "draw2" || card.value === "wild4") {
        const addCount = card.value === "draw2" ? 2 : 4;
        if (state.config.stacking) {
          nextPendingDraw = state.pendingDraw + addCount;
          nextPendingDrawType = card.value;
          nextTurnIdx = nextIndex(state.currentTurnIndex, nextDirection, playerCount, 1);
          const stackMsg = `Akumulasi penalti menjadi +${nextPendingDraw} kartu!`;
          logs.push(makeLog("system", stackMsg, now, seq++));
          sysMsgs.push({ channel: "public", content: `${playMsg} ${stackMsg}` });
        } else {
          // Tanpa stacking: korban langsung ambil kartu & gilirannya dilewati
          const victimIdx = nextIndex(state.currentTurnIndex, nextDirection, playerCount, 1);
          const victimId = state.turnOrder[victimIdx]!;
          const victimName = getPlayerNickname(updatedPlayers, victimId);
          const drawRes = drawCards(nextDrawPile, nextDiscardPile, addCount, rng);
          nextDrawPile = drawRes.drawPile;
          nextDiscardPile = drawRes.discardPile;
          updatedPlayers = updatedPlayers.map((p) =>
            p.id === victimId
              ? { ...p, hand: [...p.hand, ...drawRes.drawn], unoDeclared: false }
              : p,
          );
          nextTurnIdx = nextIndex(state.currentTurnIndex, nextDirection, playerCount, 2);
          const hitMsg = `${victimName} langsung mengambil +${drawRes.drawn.length} kartu dan dilewati!`;
          logs.push(makeLog("draw", hitMsg, now, seq++));
          sysMsgs.push({ channel: "public", content: hitMsg });
        }
      } else {
        nextTurnIdx = nextIndex(state.currentTurnIndex, nextDirection, playerCount, 1);
      }

      // Cek status lupa teriak UNO (hanya aktif setelah kartu tersisa 1; lawan boleh tangkap setelah 2 detik)
      let nextUnoVulnerable: string | null = null;
      let nextUnoCatchableAt: number | null = null;
      if (remainingHand.length === 1) {
        nextUnoVulnerable = playerId;
        nextUnoCatchableAt = now + UNO_CATCH_DELAY_MS;
      } else if (state.unoVulnerablePlayerId) {
        const existingVuln = updatedPlayers.find((p) => p.id === state.unoVulnerablePlayerId);
        if (existingVuln && existingVuln.hand.length === 1 && !existingVuln.unoDeclared) {
          nextUnoVulnerable = existingVuln.id;
          nextUnoCatchableAt = state.unoCatchableAt;
        }
      }

      return {
        state: {
          ...state,
          players: updatedPlayers,
          drawPile: nextDrawPile,
          discardPile: nextDiscardPile,
          activeColor: nextColor,
          direction: nextDirection,
          currentTurnIndex: nextTurnIdx,
          phaseEndsAt: computeTurnEndsAt(state.config, now),
          pendingDraw: nextPendingDraw,
          pendingDrawType: nextPendingDrawType,
          drawnPlayableCardId: null,
          unoVulnerablePlayerId: nextUnoVulnerable,
          unoCatchableAt: nextUnoCatchableAt,
          logs: appendLogs(state.logs, logs),
        },
        systemMessages: sysMsgs.length > 0 ? sysMsgs : undefined,
      };
    }
  }
}

export function onUnoTimeout(
  state: UnoState,
  now: number,
  rng: () => number = Math.random,
): GameActionResult<UnoState> {
  if (state.phase !== "PLAYING") return { state };
  const currentPlayerId = state.turnOrder[state.currentTurnIndex];
  if (!currentPlayerId) return { state };

  const actorName = getPlayerNickname(state.players, currentPlayerId);

  // Jika sebelumnya sudah draw kartu valid lalu AFK -> langsung pass turn
  if (state.drawnPlayableCardId !== null) {
    const nextIdx = nextIndex(state.currentTurnIndex, state.direction, state.turnOrder.length, 1);
    const msg = `Waktu ${actorName} habis, giliran dilewati.`;
    return {
      state: {
        ...state,
        currentTurnIndex: nextIdx,
        phaseEndsAt: computeTurnEndsAt(state.config, now),
        drawnPlayableCardId: null,
        logs: appendLogs(state.logs, [makeLog("timeout", msg, now, 0)]),
      },
      systemMessages: [{ channel: "public", content: msg }],
    };
  }

  // Ambil penalti (jika ada) atau 1 kartu otomatis lalu langsung lanjut ke pemain berikutnya
  const drawCount = state.pendingDraw > 0 ? state.pendingDraw : 1;
  const drawRes = drawCards(state.drawPile, state.discardPile, drawCount, rng);
  const updatedPlayers = state.players.map((p) =>
    p.id === currentPlayerId
      ? { ...p, hand: [...p.hand, ...drawRes.drawn], unoDeclared: false }
      : p,
  );
  const nextIdx = nextIndex(state.currentTurnIndex, state.direction, state.turnOrder.length, 1);
  const msg = `Waktu ${actorName} habis, otomatis ambil +${drawRes.drawn.length} kartu.`;

  const clearVulnerable = state.unoVulnerablePlayerId === currentPlayerId;
  return {
    state: {
      ...state,
      players: updatedPlayers,
      drawPile: drawRes.drawPile,
      discardPile: drawRes.discardPile,
      currentTurnIndex: nextIdx,
      phaseEndsAt: computeTurnEndsAt(state.config, now),
      pendingDraw: 0,
      pendingDrawType: null,
      drawnPlayableCardId: null,
      unoVulnerablePlayerId: clearVulnerable ? null : state.unoVulnerablePlayerId,
      unoCatchableAt: clearVulnerable ? null : state.unoCatchableAt,
      logs: appendLogs(state.logs, [makeLog("timeout", msg, now, 0)]),
    },
    systemMessages: [{ channel: "public", content: msg }],
  };
}

export function getUnoPlayerView(state: UnoState, playerId: string): UnoPlayerView {
  const me = state.players.find((p) => p.id === playerId);
  const currentTurnPlayerId =
    state.phase === "PLAYING" ? (state.turnOrder[state.currentTurnIndex] ?? null) : null;
  const isMyTurn = state.phase === "PLAYING" && currentTurnPlayerId === playerId;
  const myHand = me?.hand ?? [];

  const playableCardIds = isMyTurn
    ? myHand.filter((c) => isCardPlayable(state, c)).map((c) => c.id)
    : [];

  // Tombol UNO! hanya muncul setelah kartu tersisa 1
  const canCallUno =
    state.phase === "PLAYING" &&
    Boolean(me) &&
    myHand.length === 1 &&
    state.unoVulnerablePlayerId === playerId &&
    !me!.unoDeclared;

  return {
    phase: state.phase,
    config: state.config,
    direction: state.direction,
    activeColor: state.activeColor,
    topDiscard: state.discardPile[state.discardPile.length - 1]!,
    drawPileCount: state.drawPile.length,
    pendingDraw: state.pendingDraw,
    pendingDrawType: state.pendingDrawType,
    turnOrder: state.turnOrder,
    currentTurnPlayerId,
    unoVulnerablePlayerId: state.unoVulnerablePlayerId,
    unoCatchableAt: state.unoCatchableAt,
    me: {
      id: playerId,
      hand: myHand,
      playableCardIds,
      isMyTurn,
      canDraw: isMyTurn && state.drawnPlayableCardId === null,
      canPass: isMyTurn && state.drawnPlayableCardId !== null,
      canCallUno,
      drawnPlayableCardId: isMyTurn ? state.drawnPlayableCardId : null,
      unoDeclared: me?.unoDeclared ?? false,
    },
    players: state.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      cardCount: p.hand.length,
      unoDeclared: p.unoDeclared,
      isUnoVulnerable: state.unoVulnerablePlayerId === p.id,
    })),
    logs: state.logs,
    winner: state.winner,
  };
}

export function getUnoChatChannels(state: UnoState, playerId: string): ChatChannel[] {
  if (state.phase === "GAME_OVER") return ["public", "lobby"];
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  return ["public"];
}
