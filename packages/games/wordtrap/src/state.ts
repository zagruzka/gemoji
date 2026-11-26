import type { BaseGameState, GameResult } from "@gemoji/game-core";
import type { AvatarId } from "@gemoji/shared";
import { z } from "zod";

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as readonly string[];

export type WordtrapMode = "reveal" | "hidden";
export type WordtrapPhase = "PLAYING" | "GUESSING_WORD" | "ROUND_END" | "GAME_OVER";
export type LetterStatus = "unused" | "correct" | "wrong";

export const WordtrapConfigSchema = z.object({
  /** Mode Reveal: huruf benar muncul di slot kata. Mode Hidden: hanya hijau di keyboard (anagram). */
  mode: z.enum(["reveal", "hidden"]).default("reveal"),
  /** Target poin untuk memenangkan match */
  targetPoints: z.union([z.literal(2), z.literal(3), z.literal(5)]).default(3),
  /** Durasi giliran per aksi dalam detik (0 = tanpa batas waktu) */
  turnDurationSec: z
    .union([z.literal(0), z.literal(15), z.literal(20), z.literal(30)])
    .default(20),
  /** Batas pemakaian Skill Trap per pemain tiap ronde */
  trapLimit: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
});

export type WordtrapConfig = z.infer<typeof WordtrapConfigSchema>;

export interface WordtrapPlayerInternal {
  id: string;
  nickname: string;
  avatar: AvatarId;
  score: number;
  eliminatedInRound: boolean;
  trapsUsedInRound: number;
}

export interface ActiveTrap {
  id: string;
  ownerId: string;
  mode: WordtrapMode;
  letter: string;
  /** Di Mode Reveal: index slot kosong tempat huruf palsu dipasang. Di Mode Hidden: null. */
  slotIndex: number | null;
  /** Apakah huruf tersebut sebenarnya ada di secretWord */
  actualInWord: boolean;
  /** Sisa giliran sebelum 1 putaran penuh berakhir */
  turnsRemaining: number;
}

export interface WordtrapLogEntry {
  id: string;
  round: number;
  type:
    | "letter"
    | "trap_expired"
    | "trap_busted"
    | "guess_start"
    | "guess_correct"
    | "guess_wrong"
    | "timeout"
    | "round_end";
  message: string;
  timestamp: number;
}

export interface WordtrapRoundResult {
  round: number;
  secretWord: string;
  winnerPlayerId: string | null;
  reason: "guessed" | "all_eliminated" | "letters_exhausted";
}

export interface WordtrapSessionData {
  usedWords: string[];
}

export interface WordtrapState extends BaseGameState {
  phase: WordtrapPhase;
  config: WordtrapConfig;
  round: number;
  secretWord: string;
  wordPool: string[];
  players: WordtrapPlayerInternal[];
  turnOrder: string[];
  currentTurnIndex: number;
  /** Hanya berisi huruf yang sudah terungkap secara ASLI (bukan trap aktif) */
  guessedLetters: Record<string, "correct" | "wrong">;
  activeTraps: ActiveTrap[];
  activeGuesserId: string | null;
  pausedTurnRemainingMs: number | null;
  lastRoundResult: WordtrapRoundResult | null;
  logs: WordtrapLogEntry[];
  winner: GameResult | null;
  sessionData: WordtrapSessionData;
}

export interface WordtrapPublicPlayer {
  id: string;
  nickname: string;
  avatar: AvatarId;
  score: number;
  eliminatedInRound: boolean;
}

export interface WordtrapPlayerView {
  phase: WordtrapPhase;
  round: number;
  config: WordtrapConfig;
  wordLength: number;
  /**
   * Di Mode Reveal: berisi huruf yang terbuka (termasuk huruf palsu dari trap aktif, tanpa flag bocor).
   * Di Mode Hidden: semua null selama PLAYING/GUESSING_WORD.
   * Di ROUND_END / GAME_OVER: seluruh huruf kata rahasia terbuka.
   */
  slots: Array<string | null>;
  /** Status tiap huruf A–Z (trap aktif tampil sebagai "correct" / Hijau) */
  keyboard: Record<string, LetterStatus>;
  me: {
    id: string;
    score: number;
    eliminatedInRound: boolean;
    trapUsedInRound: boolean;
    trapsUsedInRound: number;
    trapsRemainingInRound: number;
    isMyTurn: boolean;
    canUseTrap: boolean;
    canGuessWord: boolean;
    myActiveTrap: {
      letter: string;
      slotIndex: number | null;
      turnsRemaining: number;
    } | null;
  };
  players: WordtrapPublicPlayer[];
  turnOrder: string[];
  currentTurnPlayerId: string | null;
  activeGuesserId: string | null;
  lastRoundResult: WordtrapRoundResult | null;
  logs: WordtrapLogEntry[];
  winner: GameResult | null;
  /** Hanya terisi saat ROUND_END atau GAME_OVER */
  revealedSecretWord: string | null;
}
