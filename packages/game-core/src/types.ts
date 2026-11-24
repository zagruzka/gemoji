import type { ChatChannel, Player } from "@gemoji/shared";

export type VoteDurationOption = "unlimited" | 30 | 60 | 120;
export type VoteMode = "open" | "secret";

export interface GameMeta {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  status: "available" | "coming_soon";
}

export interface GameResult {
  winnerTeam: string;
  winnerPlayerIds: string[];
  reason: string;
  summary?: Record<string, unknown>;
}

export interface GameInitContext {
  now: number;
  rng?: () => number;
  /** Optional external word pair fetcher (e.g. from bun:sqlite) */
  pickLibraryWordPair?: (usedKeys: Set<string>) => { wordA: string; wordB: string } | null;
  /** Optional state persisted across rounds in the same room session (e.g. custom word pool) */
  previousSessionData?: unknown;
}

export interface BaseGameState {
  phase: string;
  phaseEndsAt: number | null;
  sessionData?: unknown;
}

export interface GameActionResult<TState extends BaseGameState> {
  state: TState;
  systemMessages?: Array<{ channel: ChatChannel; content: string }>;
}

export interface GameModule<
  TState extends BaseGameState = BaseGameState,
  TAction = unknown,
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TPlayerView = unknown,
> {
  meta: GameMeta;
  defaultConfig: TConfig;

  parseConfig(raw: unknown): TConfig;
  parseAction(raw: unknown): TAction;

  init(players: Player[], config: TConfig, context: GameInitContext): TState;
  validateAction(state: TState, playerId: string, action: TAction): string | null;
  reduce(
    state: TState,
    playerId: string,
    action: TAction,
    now: number,
  ): GameActionResult<TState>;
  onTimeout(state: TState, now: number): GameActionResult<TState>;

  getPlayerView(state: TState, playerId: string): TPlayerView;
  getAllowedChatChannels(state: TState, playerId: string): ChatChannel[];
  getWinner(state: TState): GameResult | null;
}
