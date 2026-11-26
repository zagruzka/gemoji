import type { GameModule } from "@gemoji/game-core";
import { WordtrapActionSchema, type WordtrapAction } from "./actions";
import {
  getWordtrapChatChannels,
  getWordtrapPlayerView,
  initWordtrap,
  onWordtrapTimeout,
  reduceWordtrap,
  validateWordtrapAction,
} from "./engine";
import {
  WordtrapConfigSchema,
  type WordtrapConfig,
  type WordtrapPlayerView,
  type WordtrapState,
} from "./state";

export * from "./state";
export * from "./actions";
export * from "./words";

export const wordtrapGameModule: GameModule<
  WordtrapState,
  WordtrapAction,
  WordtrapConfig,
  WordtrapPlayerView
> = {
  meta: {
    id: "wordtrap",
    name: "Wordtrap",
    description:
      "Tebak kata rahasia dari huruf yang terbuka, rebut kesempatan menjawab, dan kecoh lawan dengan huruf jebakan.",
    minPlayers: 2,
    maxPlayers: 8,
    status: "available",
  },
  defaultConfig: WordtrapConfigSchema.parse({}),

  parseConfig(raw) {
    return WordtrapConfigSchema.parse(raw ?? {});
  },

  parseAction(raw) {
    return WordtrapActionSchema.parse(raw);
  },

  init: initWordtrap,
  validateAction: validateWordtrapAction,
  reduce: (state, playerId, action, now) => reduceWordtrap(state, playerId, action, now),
  onTimeout: onWordtrapTimeout,
  getPlayerView: getWordtrapPlayerView,
  getAllowedChatChannels: getWordtrapChatChannels,
  getWinner: (state) => state.winner,
};
