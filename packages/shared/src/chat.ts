import { z } from "zod";

export const ChatChannelSchema = z.union([
  z.literal("lobby"),
  z.literal("public"),
  z.literal("dead"),
  z.string().regex(/^secret:[a-z0-9_-]+$/),
]);

export type ChatChannel = z.infer<typeof ChatChannelSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  channel: ChatChannelSchema,
  senderId: z.string().nullable(),
  senderName: z.string(),
  content: z.string().min(1).max(300),
  timestamp: z.number(),
  isSystem: z.boolean(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
