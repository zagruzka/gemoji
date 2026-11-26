import { z } from "zod";
import { SELECTOR_LEVELS } from "./state";

export const ModuleValueSchema = z.union([
  z.string().regex(/^[1-4]{4}$/),
  z.number().int().min(1).max(10),
  z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean(), z.boolean()]),
  z.enum(SELECTOR_LEVELS),
]);

export const SpaceteamActionSchema = z.discriminatedUnion("actionType", [
  z.object({
    actionType: z.literal("PLAYER_READY"),
    data: z.object({}).default({}),
  }),
  z.object({
    actionType: z.literal("SUBMIT_MODULE"),
    data: z.object({
      moduleId: z.string().min(1),
      value: ModuleValueSchema,
    }),
  }),
]);

export type SpaceteamAction = z.infer<typeof SpaceteamActionSchema>;
