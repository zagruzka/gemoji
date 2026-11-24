import { z } from "zod";

const WordTextSchema = z
  .string()
  .trim()
  .min(1, "Kata tidak boleh kosong")
  .max(40, "Kata maksimal 40 karakter");

export const CustomWordPairSchema = z
  .object({
    wordA: WordTextSchema,
    wordB: WordTextSchema,
  })
  .refine(
    (pair) => pair.wordA.toLowerCase() !== pair.wordB.toLowerCase(),
    "Kedua kata dalam satu pasangan tidak boleh sama",
  );

export const UndercoverActionSchema = z.discriminatedUnion("actionType", [
  z.object({
    actionType: z.literal("SUBMIT_CUSTOM_WORDS"),
    data: z.object({
      pairs: z.tuple([CustomWordPairSchema]),
    }),
  }),
  z.object({
    actionType: z.literal("MARK_READY"),
    data: z.object({}).default({}),
  }),
  z.object({
    actionType: z.literal("SUBMIT_CLUE"),
    data: z.object({
      clue: z.string().trim().min(1, "Clue tidak boleh kosong").max(120, "Clue maksimal 120 karakter"),
    }),
  }),
  z.object({
    actionType: z.literal("CAST_VOTE"),
    data: z.object({
      targetPlayerId: z.string(),
    }),
  }),
  z.object({
    actionType: z.literal("SUBMIT_MR_BLANK_GUESS"),
    data: z.object({
      guess: z.string().trim().min(1, "Tebakan tidak boleh kosong").max(60),
    }),
  }),
]);

export type UndercoverAction = z.infer<typeof UndercoverActionSchema>;
