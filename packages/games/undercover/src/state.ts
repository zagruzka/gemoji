import { z } from "zod";
import type { BaseGameState, GameResult, VoteDurationOption, VoteMode } from "@undercover/game-core";
import type { AvatarId } from "@undercover/shared";

export type UndercoverRole = "citizen" | "undercover" | "mr_blank";
export type WordMode = "library" | "custom";

export type UndercoverPhase =
  | "SUBMIT_CUSTOM_WORDS"
  | "REVEAL_WORD"
  | "CLUE_ROUND"
  | "VOTING"
  | "MR_BLANK_GUESS"
  | "GAME_OVER";

export const SKIP_VOTE_TARGET = "__SKIP__" as const;

export const UndercoverConfigSchema = z.object({
  wordMode: z.enum(["library", "custom"]).default("library"),
  undercoverCount: z.number().int().min(0).max(5).default(1),
  mrBlankCount: z.number().int().min(0).max(3).default(0),
  /** 0 = tanpa fase clue (langsung voting, cocok untuk main tatap muka) */
  clueDurationSec: z
    .union([z.literal(0), z.literal(30), z.literal(45), z.literal(60)])
    .default(45),
  voteDuration: z
    .union([z.literal("unlimited"), z.literal(30), z.literal(60), z.literal(120)])
    .default(60),
  voteMode: z.enum(["open", "secret"]).default("secret"),
  blindRole: z.boolean().default(true),
});

export type UndercoverConfig = z.infer<typeof UndercoverConfigSchema>;

export interface CustomWordPoolItem {
  id: string;
  wordA: string;
  wordB: string;
  authorId: string;
}

export interface UndercoverSessionData {
  usedLibraryKeys: string[];
  customPool: CustomWordPoolItem[];
}

export interface UndercoverPlayerInternal {
  id: string;
  nickname: string;
  avatar: AvatarId;
  role: UndercoverRole | null;
  word: string | null;
  alive: boolean;
  ready: boolean;
}

export interface ClueEntry {
  round: number;
  playerId: string;
  clue: string;
}

export interface EliminationRecord {
  round: number;
  eliminatedPlayerId: string | null;
  eliminatedRole: UndercoverRole | null;
  votes: Record<string, string>;
  reason: "voted" | "tie" | "skipped" | "no_votes";
}

export interface UndercoverState extends BaseGameState {
  phase: UndercoverPhase;
  config: UndercoverConfig;
  round: number;
  players: UndercoverPlayerInternal[];
  citizenWord: string | null;
  undercoverWord: string | null;
  wordAuthorId: string | null;
  submittedCustomWords: Record<string, Array<{ wordA: string; wordB: string }>>;
  turnOrder: string[];
  currentTurnIndex: number;
  clues: ClueEntry[];
  votes: Record<string, string>;
  lastElimination: EliminationRecord | null;
  mrBlankGuessPlayerId: string | null;
  mrBlankLastGuess: string | null;
  winner: GameResult | null;
  sessionData: UndercoverSessionData;
}

export interface UndercoverPublicPlayer {
  id: string;
  nickname: string;
  avatar: AvatarId;
  alive: boolean;
  ready: boolean;
  /** Only revealed when eliminated or at GAME_OVER */
  revealedRole: UndercoverRole | null;
  /** Only revealed at GAME_OVER */
  revealedWord: string | null;
}

export interface UndercoverPlayerView {
  phase: UndercoverPhase;
  round: number;
  config: UndercoverConfig;
  me: {
    id: string;
    alive: boolean;
    ready: boolean;
    word: string | null;
    /** Null if blindRole=true and player is citizen/undercover during active game */
    knownRole: UndercoverRole | null;
    hasSubmittedCustomWords: boolean;
    myVote: string | null;
  };
  players: UndercoverPublicPlayer[];
  roleSummary: {
    citizen: number;
    undercover: number;
    mrBlank: number;
  };
  submittedCustomWordPlayerIds: string[];
  customPoolRemaining: number;
  turnOrder: string[];
  currentTurnPlayerId: string | null;
  clues: ClueEntry[];
  /** Live map only populated when voteMode === "open" during VOTING */
  liveVotes: Record<string, string> | null;
  votedPlayerIds: string[];
  lastElimination: EliminationRecord | null;
  mrBlankGuessPlayerId: string | null;
  mrBlankLastGuess: string | null;
  winner: GameResult | null;
  revealSummary: {
    citizenWord: string | null;
    undercoverWord: string | null;
  } | null;
}

export type { VoteDurationOption, VoteMode };
