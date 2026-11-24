import { cors } from "@elysiajs/cors";
import { gameRegistry, type GameMeta } from "@undercover/game-core";
import { undercoverGameModule } from "@undercover/game-undercover";
import { ClientMessageSchema, type ServerMessage } from "@undercover/shared";
import { Elysia, t } from "elysia";
import { createGuestToken, verifyGuestToken } from "./auth/guest";
import { seedDefaultWordsIfEmpty } from "./db";
import { RoomManager } from "./rooms/manager";
import { InMemoryRoomStore } from "./rooms/store";

// Register active game modules
gameRegistry.register(undercoverGameModule);

// Ensure SQLite word library is seeded on startup
const wordCount = seedDefaultWordsIfEmpty();

const roomManager = new RoomManager(new InMemoryRoomStore(), gameRegistry);

const UPCOMING_GAMES: GameMeta[] = [
  {
    id: "werewolf",
    name: "Werewolf",
    description: "Bertahan hidup dari Serigala lewat fase Malam penuh intrik & diskusi Siang!",
    minPlayers: 5,
    maxPlayers: 16,
    status: "coming_soon",
  },
  {
    id: "uno",
    name: "UNO",
    description: "Adu cepat habiskan kartu di tangan, pakai +2/+4, dan jangan lupa teriak UNO!",
    minPlayers: 2,
    maxPlayers: 10,
    status: "coming_soon",
  },
];

interface WsClientState {
  playerId: string;
  sessionToken: string;
  roomCode: string | null;
}

const wsStates = new WeakMap<object, WsClientState>();

const app = new Elysia()
  .use(cors())
  .get("/api/health", () => ({
    ok: true,
    runtime: `Bun ${Bun.version}`,
    wordsLoaded: wordCount,
    games: gameRegistry.listMeta().map((g) => g.id),
  }))
  .get("/api/games", () => ({
    games: [...gameRegistry.listMeta(), ...UPCOMING_GAMES],
  }))
  .get("/api/rooms/:code", ({ params, set }) => {
    const room = roomManager.getRoom(params.code);
    if (!room) {
      set.status = 404;
      return { exists: false, message: "Room tidak ditemukan" };
    }
    return {
      exists: true,
      roomCode: room.roomCode,
      gameId: room.gameId,
      status: room.status,
      playerCount: room.players.length,
    };
  })
  .post(
    "/api/rooms",
    ({ body }) => {
      const gameId = body?.gameId ?? "undercover";
      const room = roomManager.createRoom(gameId);
      return {
        roomCode: room.roomCode,
        gameId: room.gameId,
      };
    },
    {
      body: t.Optional(
        t.Object({
          gameId: t.Optional(t.String()),
        }),
      ),
    },
  )
  .ws("/ws", {
    query: t.Object({
      token: t.Optional(t.String()),
    }),
    open(ws) {
      const verifiedId = verifyGuestToken(ws.data.query.token);
      const { playerId, sessionToken } = createGuestToken(verifiedId ?? undefined);
      wsStates.set(ws.raw, { playerId, sessionToken, roomCode: null });

      const readyMsg: ServerMessage = {
        type: "SESSION_READY",
        payload: { playerId, sessionToken, isHost: false },
      };
      ws.send(readyMsg);
    },
    message(ws, rawMessage) {
      const state = wsStates.get(ws.raw);
      if (!state) return;

      const parsed = ClientMessageSchema.safeParse(rawMessage);
      if (!parsed.success) {
        ws.send({
          type: "ERROR",
          payload: { code: "INVALID_MESSAGE", message: "Format pesan tidak valid" },
        } satisfies ServerMessage);
        return;
      }

      const msg = parsed.data;
      const sendError = (code: string, message: string) =>
        ws.send({ type: "ERROR", payload: { code, message } } satisfies ServerMessage);

      switch (msg.type) {
        case "PING":
          ws.send({ type: "PONG", payload: { serverTime: Date.now() } } satisfies ServerMessage);
          break;

        case "ROOM_JOIN": {
          const result = roomManager.joinRoom(
            msg.payload.roomCode,
            state.playerId,
            msg.payload.nickname,
            msg.payload.avatar,
            { send: (m) => ws.send(m) },
          );
          if (!result.ok) {
            sendError("JOIN_FAILED", result.error);
            return;
          }
          state.roomCode = msg.payload.roomCode.toUpperCase();
          ws.send({
            type: "SESSION_READY",
            payload: {
              playerId: state.playerId,
              sessionToken: state.sessionToken,
              isHost: result.isHost,
            },
          } satisfies ServerMessage);
          break;
        }

        case "ROOM_UPDATE_CONFIG": {
          if (!state.roomCode) return sendError("NO_ROOM", "Belum bergabung ke room");
          const err = roomManager.updateConfig(state.roomCode, state.playerId, msg.payload);
          if (err) sendError("CONFIG_FAILED", err);
          break;
        }

        case "ROOM_KICK_PLAYER": {
          if (!state.roomCode) return sendError("NO_ROOM", "Belum bergabung ke room");
          const err = roomManager.kickPlayer(state.roomCode, state.playerId, msg.payload.targetPlayerId);
          if (err) sendError("KICK_FAILED", err);
          break;
        }

        case "ROOM_START_GAME": {
          if (!state.roomCode) return sendError("NO_ROOM", "Belum bergabung ke room");
          const err = roomManager.startGame(state.roomCode, state.playerId);
          if (err) sendError("START_FAILED", err);
          break;
        }

        case "ROOM_RETURN_LOBBY": {
          if (!state.roomCode) return sendError("NO_ROOM", "Belum bergabung ke room");
          const err = roomManager.returnToLobby(state.roomCode, state.playerId);
          if (err) sendError("RETURN_LOBBY_FAILED", err);
          break;
        }

        case "GAME_ACTION": {
          if (!state.roomCode) return sendError("NO_ROOM", "Belum bergabung ke room");
          const err = roomManager.handleGameAction(state.roomCode, state.playerId, msg.payload);
          if (err) sendError("ACTION_FAILED", err);
          break;
        }

        case "CHAT_SEND": {
          if (!state.roomCode) return sendError("NO_ROOM", "Belum bergabung ke room");
          const err = roomManager.handleChat(
            state.roomCode,
            state.playerId,
            msg.payload.channel,
            msg.payload.content,
          );
          if (err) sendError("CHAT_FAILED", err);
          break;
        }
      }
    },
    close(ws) {
      const state = wsStates.get(ws.raw);
      if (state?.roomCode) {
        roomManager.handleDisconnect(state.roomCode, state.playerId);
      }
      wsStates.delete(ws.raw);
    },
  });

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT);

console.log(`🎮 Gemoji! Server running at http://localhost:${PORT} (${wordCount} kata siap)`);

export type App = typeof app;
