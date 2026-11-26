import type { GameModule } from "@gemoji/game-core";
import { UnoActionSchema, type UnoAction } from "./actions";
import {
  getUnoChatChannels,
  getUnoPlayerView,
  initUno,
  onUnoTimeout,
  reduceUno,
  validateUnoAction,
} from "./engine";
import {
  UnoConfigSchema,
  type UnoConfig,
  type UnoPlayerView,
  type UnoState,
} from "./state";

export * from "./state";
export * from "./actions";
export { createStandardUnoDeck, isCardPlayable } from "./engine";

export const unoGameModule: GameModule<UnoState, UnoAction, UnoConfig, UnoPlayerView> = {
  meta: {
    id: "uno",
    name: "UNO",
    description:
      "Adu cepat menghabiskan kartu dengan kombinasi warna, aksi Skip dan Reverse, tumpuk +2/+4, serta teriak UNO!",
    minPlayers: 2,
    maxPlayers: 10,
    status: "available",
  },
  defaultConfig: UnoConfigSchema.parse({}),

  parseConfig(raw) {
    return UnoConfigSchema.parse(raw ?? {});
  },

  parseAction(raw) {
    return UnoActionSchema.parse(raw);
  },

  init: initUno,
  validateAction: validateUnoAction,
  reduce: (state, playerId, action, now) => reduceUno(state, playerId, action, now),
  onTimeout: onUnoTimeout,
  getPlayerView: getUnoPlayerView,
  getAllowedChatChannels: getUnoChatChannels,
  getWinner: (state) => state.winner,
};
