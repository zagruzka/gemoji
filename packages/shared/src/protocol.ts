import { z } from "zod";
import { ChatChannelSchema, ChatMessageSchema } from "./chat";
import { AvatarIdSchema, NicknameSchema, RoomCodeSchema, RoomPublicStateSchema } from "./room";

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ROOM_JOIN"),
    payload: z.object({
      roomCode: RoomCodeSchema,
      nickname: NicknameSchema,
      avatar: AvatarIdSchema,
    }),
  }),
  z.object({
    type: z.literal("ROOM_UPDATE_CONFIG"),
    payload: z.object({
      gameId: z.string().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
  z.object({
    type: z.literal("ROOM_KICK_PLAYER"),
    payload: z.object({
      targetPlayerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal("ROOM_START_GAME"),
    payload: z.object({}).default({}),
  }),
  z.object({
    type: z.literal("ROOM_RETURN_LOBBY"),
    payload: z.object({}).default({}),
  }),
  z.object({
    type: z.literal("ROOM_LEAVE"),
    payload: z.object({}).default({}),
  }),
  z.object({
    type: z.literal("GAME_ACTION"),
    payload: z.object({
      actionType: z.string(),
      data: z.unknown(),
    }),
  }),
  z.object({
    type: z.literal("CHAT_SEND"),
    payload: z.object({
      channel: ChatChannelSchema,
      content: z.string().trim().min(1).max(300),
    }),
  }),
  z.object({
    type: z.literal("PING"),
    payload: z.object({}).default({}),
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SESSION_READY"),
    payload: z.object({
      playerId: z.string(),
      sessionToken: z.string(),
      isHost: z.boolean(),
    }),
  }),
  z.object({
    type: z.literal("ROOM_STATE"),
    payload: RoomPublicStateSchema,
  }),
  z.object({
    type: z.literal("GAME_STATE_VIEW"),
    payload: z.object({
      gameId: z.string(),
      phase: z.string(),
      phaseEndsAt: z.number().nullable(),
      allowedChatChannels: z.array(ChatChannelSchema),
      view: z.unknown(),
    }),
  }),
  z.object({
    type: z.literal("CHAT_MESSAGE"),
    payload: ChatMessageSchema,
  }),
  z.object({
    type: z.literal("CHAT_HISTORY"),
    payload: z.object({
      messages: z.array(ChatMessageSchema),
    }),
  }),
  z.object({
    type: z.literal("ERROR"),
    payload: z.object({
      code: z.string(),
      message: z.string(),
    }),
  }),
  z.object({
    type: z.literal("PONG"),
    payload: z.object({
      serverTime: z.number(),
    }),
  }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
