import type { GameModule } from "@gemoji/game-core";
import { UndercoverActionSchema, type UndercoverAction } from "./actions";
import {
  getUndercoverChatChannels,
  getUndercoverPlayerView,
  initUndercover,
  onUndercoverTimeout,
  reduceUndercover,
  validateUndercoverAction,
} from "./engine";
import {
  UndercoverConfigSchema,
  type UndercoverConfig,
  type UndercoverPlayerView,
  type UndercoverState,
} from "./state";

export * from "./state";
export * from "./actions";
export * from "./words";

export const undercoverGameModule: GameModule<
  UndercoverState,
  UndercoverAction,
  UndercoverConfig,
  UndercoverPlayerView
> = {
  meta: {
    id: "undercover",
    name: "Undercover",
    description:
      "Cari tahu siapa penyusup di antara temanmu lewat petunjuk singkat. Bisa pakai kata acak atau buat kata sendiri!",
    minPlayers: 3,
    maxPlayers: 12,
    status: "available",
  },
  defaultConfig: UndercoverConfigSchema.parse({}),

  parseConfig(raw) {
    return UndercoverConfigSchema.parse(raw ?? {});
  },

  parseAction(raw) {
    return UndercoverActionSchema.parse(raw);
  },

  init: initUndercover,
  validateAction: validateUndercoverAction,
  reduce: (state, playerId, action, now) => reduceUndercover(state, playerId, action, now),
  onTimeout: onUndercoverTimeout,
  getPlayerView: getUndercoverPlayerView,
  getAllowedChatChannels: getUndercoverChatChannels,
  getWinner: (state) => state.winner,
};
