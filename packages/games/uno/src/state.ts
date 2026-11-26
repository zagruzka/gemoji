import type { BaseGameState, GameResult } from "@gemoji/game-core";
import type { AvatarId } from "@gemoji/shared";
import { z } from "zod";

export const UNO_COLORS = ["red", "yellow", "green", "blue"] as const;
export type UnoColor = (typeof UNO_COLORS)[number];
export type UnoCardColor = UnoColor | "wild";

export type UnoCardValue =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "skip"
  | "reverse"
  | "draw2"
  | "wild"
  | "wild4";

export interface UnoCard {
  id: string;
  color: UnoCardColor;
  value: UnoCardValue;
}

export type UnoPhase = "PLAYING" | "GAME_OVER";
export type UnoDirection = 1 | -1;

export const UnoConfigSchema = z.object({
  /** Durasi timer per giliran dalam detik (0 = unlimited) */
  turnDurationSec: z
    .union([z.literal(0), z.literal(15), z.literal(20), z.literal(30)])
    .default(20),
  /** Stacking ON: +2 bisa ditumpuk +2/+4, dan +4 bisa ditumpuk +4 */
  stacking: z.boolean().default(true),
  /** Jumlah kartu awal tiap pemain */
  startingHandSize: z.union([z.literal(5), z.literal(7)]).default(7),
});

export type UnoConfig = z.infer<typeof UnoConfigSchema>;

export interface UnoPlayerInternal {
  id: string;
  nickname: string;
  avatar: AvatarId;
  hand: UnoCard[];
  unoDeclared: boolean;
}

export interface UnoLogEntry {
  id: string;
  type: "play" | "draw" | "uno" | "catch" | "timeout" | "system";
  message: string;
  timestamp: number;
}

export interface UnoState extends BaseGameState {
  phase: UnoPhase;
  config: UnoConfig;
  players: UnoPlayerInternal[];
  turnOrder: string[];
  currentTurnIndex: number;
  direction: UnoDirection;
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  activeColor: UnoColor;
  /** Akumulasi kartu penalti saat stacking ON */
  pendingDraw: number;
  pendingDrawType: "draw2" | "wild4" | null;
  /** Jika pemain baru ambil 1 kartu dan valid, ia boleh mainkan kartu itu atau Lewati */
  drawnPlayableCardId: string | null;
  /** Pemain dengan 1 kartu yang lupa menekan tombol UNO! (bisa ditangkap untuk +2) */
  unoVulnerablePlayerId: string | null;
  /** Timestamp (ms) mulai kapan pemain lain boleh menangkap pemain yang lupa UNO! (delay 1 detik) */
  unoCatchableAt: number | null;
  logs: UnoLogEntry[];
  winner: GameResult | null;
}

export interface UnoPublicPlayer {
  id: string;
  nickname: string;
  avatar: AvatarId;
  cardCount: number;
  unoDeclared: boolean;
  isUnoVulnerable: boolean;
}

export interface UnoPlayerView {
  phase: UnoPhase;
  config: UnoConfig;
  direction: UnoDirection;
  activeColor: UnoColor;
  topDiscard: UnoCard;
  drawPileCount: number;
  pendingDraw: number;
  pendingDrawType: "draw2" | "wild4" | null;
  turnOrder: string[];
  currentTurnPlayerId: string | null;
  unoVulnerablePlayerId: string | null;
  unoCatchableAt: number | null;
  me: {
    id: string;
    hand: UnoCard[];
    playableCardIds: string[];
    isMyTurn: boolean;
    canDraw: boolean;
    canPass: boolean;
    canCallUno: boolean;
    drawnPlayableCardId: string | null;
    unoDeclared: boolean;
  };
  players: UnoPublicPlayer[];
  logs: UnoLogEntry[];
  winner: GameResult | null;
}
