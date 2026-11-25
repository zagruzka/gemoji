import { z } from "zod";

const SingleLetterSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]$/, "Harus berupa 1 huruf A–Z");

export const WordtrapActionSchema = z.discriminatedUnion("actionType", [
  z.object({
    actionType: z.literal("PICK_LETTER"),
    data: z.object({
      letter: SingleLetterSchema,
    }),
  }),
  z.object({
    actionType: z.literal("USE_TRAP"),
    data: z.object({
      letter: SingleLetterSchema,
      slotIndex: z.number().int().min(0).max(20).optional(),
    }),
  }),
  z.object({
    actionType: z.literal("START_WORD_GUESS"),
    data: z.object({}).default({}),
  }),
  z.object({
    actionType: z.literal("SUBMIT_WORD_GUESS"),
    data: z.object({
      word: z
        .string()
        .trim()
        .min(1, "Jawaban tidak boleh kosong")
        .max(30, "Jawaban terlalu panjang"),
    }),
  }),
  z.object({
    actionType: z.literal("NEXT_ROUND"),
    data: z.object({}).default({}),
  }),
]);

export type WordtrapAction = z.infer<typeof WordtrapActionSchema>;
