import { z } from "zod";

const UnoColorSchema = z.enum(["red", "yellow", "green", "blue"]);

export const UnoActionSchema = z.discriminatedUnion("actionType", [
  z.object({
    actionType: z.literal("PLAY_CARD"),
    data: z.object({
      cardId: z.string().min(1),
      chosenColor: UnoColorSchema.optional(),
    }),
  }),
  z.object({
    actionType: z.literal("DRAW_CARD"),
    data: z.object({}).default({}),
  }),
  z.object({
    actionType: z.literal("PASS_TURN"),
    data: z.object({}).default({}),
  }),
  z.object({
    actionType: z.literal("CALL_UNO"),
    data: z.object({}).default({}),
  }),
  z.object({
    actionType: z.literal("CATCH_UNO"),
    data: z.object({
      targetPlayerId: z.string().min(1),
    }),
  }),
]);

export type UnoAction = z.infer<typeof UnoActionSchema>;
