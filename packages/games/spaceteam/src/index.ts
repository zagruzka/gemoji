import type { GameModule } from "@gemoji/game-core";
import { SpaceteamActionSchema, type SpaceteamAction } from "./actions";
import {
  SECTOR_PREP_DURATION_MS,
  WARP_JUMP_DURATION_MS,
  calculateInstructionDurationMs,
  calculateSectorTarget,
  getSpaceteamChatChannels,
  getSpaceteamPlayerView,
  initSpaceteam,
  modulesPerPlayerCount,
  onSpaceteamTimeout,
  reduceSpaceteam,
  validateSpaceteamAction,
} from "./engine";
import {
  SpaceteamConfigSchema,
  type SpaceteamConfig,
  type SpaceteamPlayerView,
  type SpaceteamState,
} from "./state";

export * from "./state";
export * from "./actions";
export {
  ALL_PARAMETER_TYPES,
  BASIC_MODULE_TYPES,
  MODULE_DEFINITIONS,
  MODULE_NAME_POOL,
  PARAMETER_LABELS,
} from "./catalog";
export {
  SECTOR_PREP_DURATION_MS,
  WARP_JUMP_DURATION_MS,
  calculateInstructionDurationMs,
  calculateSectorTarget,
  modulesPerPlayerCount,
};

export const spaceteamGameModule: GameModule<
  SpaceteamState,
  SpaceteamAction,
  SpaceteamConfig,
  SpaceteamPlayerView
> = {
  meta: {
    id: "spaceteam",
    name: "Spaceteam",
    description:
      "Kerja sama di tengah kepanikan, tekan tombol sesuai instruksi teman sebelum pesawatmu meledak!",
    minPlayers: 2,
    maxPlayers: 8,
    status: "available",
  },
  defaultConfig: SpaceteamConfigSchema.parse({}),

  parseConfig(raw) {
    return SpaceteamConfigSchema.parse(raw ?? {});
  },

  parseAction(raw) {
    return SpaceteamActionSchema.parse(raw);
  },

  init: initSpaceteam,
  validateAction: validateSpaceteamAction,
  reduce: (state, playerId, action, now) => reduceSpaceteam(state, playerId, action, now),
  onTimeout: onSpaceteamTimeout,
  getPlayerView: (state, playerId) => getSpaceteamPlayerView(state, playerId),
  getAllowedChatChannels: getSpaceteamChatChannels,
  getWinner: (state) => state.winner,
};
