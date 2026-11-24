import type { BaseGameState, GameMeta, GameModule } from "./types";

export class GameRegistry {
  private readonly modules = new Map<string, GameModule<BaseGameState, unknown, Record<string, unknown>, unknown>>();

  register<
    TState extends BaseGameState,
    TAction,
    TConfig extends Record<string, unknown>,
    TPlayerView,
  >(module: GameModule<TState, TAction, TConfig, TPlayerView>): void {
    this.modules.set(
      module.meta.id,
      module as unknown as GameModule<BaseGameState, unknown, Record<string, unknown>, unknown>,
    );
  }

  get(gameId: string) {
    return this.modules.get(gameId);
  }

  has(gameId: string): boolean {
    return this.modules.has(gameId);
  }

  listMeta(): GameMeta[] {
    return Array.from(this.modules.values()).map((m) => m.meta);
  }
}

export const gameRegistry = new GameRegistry();
