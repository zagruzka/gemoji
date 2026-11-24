import { z } from "zod";

export const AVATAR_IDS = [
  "fox",
  "cat",
  "panda",
  "frog",
  "owl",
  "bear",
  "rabbit",
  "penguin",
  "koala",
  "tiger",
  "dog",
  "unicorn",
] as const;

export const AvatarIdSchema = z.enum(AVATAR_IDS);
export type AvatarId = z.infer<typeof AvatarIdSchema>;

export const NicknameSchema = z
  .string()
  .trim()
  .min(2, "Nickname minimal 2 karakter")
  .max(16, "Nickname maksimal 16 karakter");

export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{4,6}$/, "Kode room tidak valid");

export const PlayerSchema = z.object({
  id: z.string(),
  nickname: NicknameSchema,
  avatar: AvatarIdSchema,
  isHost: z.boolean(),
  isConnected: z.boolean(),
  joinedAt: z.number(),
});

export type Player = z.infer<typeof PlayerSchema>;

export const RoomStatusSchema = z.enum(["LOBBY", "PLAYING", "FINISHED"]);
export type RoomStatus = z.infer<typeof RoomStatusSchema>;

export const RoomPublicStateSchema = z.object({
  roomCode: z.string(),
  status: RoomStatusSchema,
  gameId: z.string(),
  config: z.record(z.string(), z.unknown()),
  hostId: z.string(),
  players: z.array(PlayerSchema),
  createdAt: z.number(),
});

export type RoomPublicState = z.infer<typeof RoomPublicStateSchema>;
