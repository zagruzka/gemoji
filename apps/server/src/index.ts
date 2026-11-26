import { resolve } from "node:path";
import { cors } from "@elysiajs/cors";
import { gameRegistry, type GameMeta } from "@gemoji/game-core";
import { undercoverGameModule } from "@gemoji/game-undercover";
import { unoGameModule } from "@gemoji/game-uno";
import { wordtrapGameModule } from "@gemoji/game-wordtrap";
import { ClientMessageSchema, type ServerMessage } from "@gemoji/shared";
import { Elysia, t } from "elysia";
import { createGuestToken, verifyGuestToken } from "./auth/guest";
import { seedDefaultWordsIfEmpty, seedWordtrapWordsIfEmpty } from "./db";
import { RoomManager } from "./rooms/manager";
import { InMemoryRoomStore } from "./rooms/store";

// Register active game modules
gameRegistry.register(undercoverGameModule);
gameRegistry.register(wordtrapGameModule);
gameRegistry.register(unoGameModule);

// Ensure SQLite word libraries are seeded on startup
const wordCount = seedDefaultWordsIfEmpty();
const wordtrapWordCount = seedWordtrapWordsIfEmpty();

const roomManager = new RoomManager(new InMemoryRoomStore(), gameRegistry);

const UPCOMING_GAMES: GameMeta[] = [
  {
    id: "spaceteam",
    name: "Spaceteam",
    description:
      "Kerja sama di tengah kepanikan, tekan tombol sesuai instruksi teman sebelum pesawatmu meledak!",
    minPlayers: 2,
    maxPlayers: 8,
    status: "coming_soon",
  },
  {
    id: "ludo",
    name: "Ludo",
    description:
      "Lempar dadu dan balap 4 pion sampai garis akhir, lalu singkirkan pion lawan di sepanjang jalur.",
    minPlayers: 2,
    maxPlayers: 4,
    status: "coming_soon",
  },
  {
    id: "werewolf",
    name: "Werewolf",
    description:
      "Bertahan hidup dari Serigala lewat aksi rahasia di malam hari dan diskusi penuh curiga saat siang.",
    minPlayers: 5,
    maxPlayers: 16,
    status: "coming_soon",
  },
];

interface WsClientState {
  playerId: string;
  sessionToken: string;
  roomCode: string | null;
  lastSeenAt: number;
  closeSocket: () => void;
}

const wsStates = new Map<object, WsClientState>();
const WS_STALE_TIMEOUT_MS = 14_000;

setInterval(() => {
  const now = Date.now();
  for (const [raw, state] of wsStates.entries()) {
    if (now - state.lastSeenAt > WS_STALE_TIMEOUT_MS) {
      wsStates.delete(raw);
      if (state.roomCode) {
        roomManager.handleDisconnect(state.roomCode, state.playerId);
      }
      try {
        state.closeSocket();
      } catch {
        // Ignore already-closed socket
      }
    }
  }
}, 5_000);

const WEB_DIST_DIR = resolve(import.meta.dir, "../../web/dist");
const INDEX_HTML_PATH = resolve(WEB_DIST_DIR, "index.html");

async function serveWebAsset(pathname: string): Promise<Response> {
  if (pathname === "/api" || pathname.startsWith("/api/") || pathname === "/ws") {
    return new Response("Not Found", { status: 404 });
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname).replace(/^\/+/, "");
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  if (decoded && !decoded.endsWith("/")) {
    const candidate = resolve(WEB_DIST_DIR, decoded);
    if (!candidate.startsWith(`${WEB_DIST_DIR}/`)) {
      return new Response("Forbidden", { status: 403 });
    }
    const file = Bun.file(candidate);
    if (await file.exists()) {
      const cacheControl = decoded.startsWith("assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600";
      return new Response(file, {
        headers: { "Cache-Control": cacheControl },
      });
    }
  }

  const indexFile = Bun.file(INDEX_HTML_PATH);
  if (await indexFile.exists()) {
    return new Response(indexFile, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }

  return new Response("Frontend belum di-build. Jalankan `bun run build` terlebih dahulu.", {
    status: 404,
  });
}

const app = new Elysia()
  .use(cors())
  .get("/api/health", () => ({
    ok: true,
    runtime: `Bun ${Bun.version}`,
    wordsLoaded: wordCount,
    wordtrapWordsLoaded: wordtrapWordCount,
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
    ({ body, set }) => {
      const gameId = body?.gameId ?? "undercover";
      try {
        const room = roomManager.createRoom(gameId);
        return {
          roomCode: room.roomCode,
          gameId: room.gameId,
        };
      } catch (err) {
        set.status = 400;
        return {
          message: err instanceof Error ? err.message : "Gagal membuat room",
        };
      }
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
    idleTimeout: 20,
    query: t.Object({
      token: t.Optional(t.String()),
    }),
    open(ws) {
      const verifiedId = verifyGuestToken(ws.data.query.token);
      const { playerId, sessionToken } = createGuestToken(verifiedId ?? undefined);
      wsStates.set(ws.raw, {
        playerId,
        sessionToken,
        roomCode: null,
        lastSeenAt: Date.now(),
        closeSocket: () => ws.close(),
      });

      const readyMsg: ServerMessage = {
        type: "SESSION_READY",
        payload: { playerId, sessionToken, isHost: false },
      };
      ws.send(readyMsg);
    },
    message(ws, rawMessage) {
      const state = wsStates.get(ws.raw);
      if (!state) return;
      state.lastSeenAt = Date.now();

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

        case "ROOM_LEAVE": {
          if (state.roomCode) {
            roomManager.leaveRoom(state.roomCode, state.playerId);
            state.roomCode = null;
          }
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
  })
  .get("/", ({ request }) => serveWebAsset(new URL(request.url).pathname))
  .get("/*", ({ request }) => serveWebAsset(new URL(request.url).pathname));

const PORT = Number(process.env.PORT ?? 3001);
const HOSTNAME = process.env.HOST ?? "0.0.0.0";
app.listen({ port: PORT, hostname: HOSTNAME });

console.log(
  `🎮 Gemoji! Server running at http://${HOSTNAME}:${PORT} (${wordCount} pasangan Undercover, ${wordtrapWordCount} kata Wordtrap siap)`,
);

export type App = typeof app;
