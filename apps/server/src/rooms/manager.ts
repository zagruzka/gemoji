import type { GameRegistry } from "@gemoji/game-core";
import type {
  AvatarId,
  ChatChannel,
  ChatMessage,
  RoomPublicState,
  ServerMessage,
} from "@gemoji/shared";
import { pickLibraryWordPairFromDb } from "../db";
import type { RoomRecord, RoomStore } from "./store";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Tanpa 0/O/1/I agar mudah dibaca
const MAX_CHAT_HISTORY = 100;
const CHAT_RATE_LIMIT_MAX = 5;
const CHAT_RATE_LIMIT_WINDOW_MS = 5_000;

export interface ClientSocketSink {
  send(message: ServerMessage): void;
}

export class RoomManager {
  private readonly socketsByRoom = new Map<string, Map<string, ClientSocketSink>>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly chatTimestampsByPlayer = new Map<string, number[]>();

  constructor(
    private readonly store: RoomStore,
    private readonly registry: GameRegistry,
  ) {}

  private generateRoomCode(): string {
    for (let attempt = 0; attempt < 20; attempt++) {
      let code = "";
      for (let i = 0; i < 4; i++) {
        code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
      }
      if (!this.store.has(code)) return code;
    }
    return `R${Date.now().toString(36).toUpperCase().slice(-5)}`;
  }

  createRoom(gameId = "undercover"): RoomRecord {
    const mod = this.registry.get(gameId);
    if (!mod) throw new Error(`Game '${gameId}' tidak ditemukan`);

    const now = Date.now();
    const roomCode = this.generateRoomCode();
    const room: RoomRecord = {
      roomCode,
      status: "LOBBY",
      gameId: mod.meta.id,
      config: { ...mod.defaultConfig },
      hostId: "",
      players: [],
      gameState: null,
      sessionDataByGame: {},
      chatHistory: [],
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(roomCode, room);
    return room;
  }

  getRoom(roomCode: string): RoomRecord | undefined {
    return this.store.get(roomCode.toUpperCase());
  }

  private toPublicState(room: RoomRecord): RoomPublicState {
    return {
      roomCode: room.roomCode,
      status: room.status,
      gameId: room.gameId,
      config: room.config,
      hostId: room.hostId,
      players: room.players,
      createdAt: room.createdAt,
    };
  }

  private getRoomSockets(roomCode: string): Map<string, ClientSocketSink> {
    let map = this.socketsByRoom.get(roomCode);
    if (!map) {
      map = new Map();
      this.socketsByRoom.set(roomCode, map);
    }
    return map;
  }

  private broadcastRoomState(room: RoomRecord): void {
    const sockets = this.socketsByRoom.get(room.roomCode);
    if (!sockets) return;
    const payload = this.toPublicState(room);
    for (const sink of sockets.values()) {
      sink.send({ type: "ROOM_STATE", payload });
    }
  }

  private broadcastGameViews(room: RoomRecord): void {
    if (!room.gameState) return;
    const mod = this.registry.get(room.gameId);
    if (!mod) return;
    const sockets = this.socketsByRoom.get(room.roomCode);
    if (!sockets) return;

    for (const [playerId, sink] of sockets.entries()) {
      sink.send({
        type: "GAME_STATE_VIEW",
        payload: {
          gameId: room.gameId,
          phase: room.gameState.phase,
          phaseEndsAt: room.gameState.phaseEndsAt,
          allowedChatChannels: mod.getAllowedChatChannels(room.gameState, playerId),
          view: mod.getPlayerView(room.gameState, playerId),
        },
      });
    }
  }

  private pushChatMessage(room: RoomRecord, msg: ChatMessage): void {
    room.chatHistory.push(msg);
    if (room.chatHistory.length > MAX_CHAT_HISTORY) {
      room.chatHistory.shift();
    }

    const sockets = this.socketsByRoom.get(room.roomCode);
    if (!sockets) return;
    const mod = this.registry.get(room.gameId);

    for (const [playerId, sink] of sockets.entries()) {
      if (room.status === "LOBBY" || !room.gameState || !mod) {
        if (msg.channel === "lobby" || msg.channel === "public") {
          sink.send({ type: "CHAT_MESSAGE", payload: msg });
        }
        continue;
      }

      const allowed = mod.getAllowedChatChannels(room.gameState, playerId);
      if (allowed.includes(msg.channel)) {
        sink.send({ type: "CHAT_MESSAGE", payload: msg });
      }
    }
  }

  private scheduleTimer(room: RoomRecord): void {
    const existing = this.timers.get(room.roomCode);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(room.roomCode);
    }

    const phaseEndsAt = room.gameState?.phaseEndsAt;
    if (!phaseEndsAt) return;

    const delayMs = Math.max(50, phaseEndsAt - Date.now());
    const timer = setTimeout(() => {
      this.timers.delete(room.roomCode);
      this.handleTimeout(room.roomCode);
    }, delayMs);

    this.timers.set(room.roomCode, timer);
  }

  private handleTimeout(roomCode: string): void {
    const room = this.store.get(roomCode);
    if (!room || !room.gameState) return;
    const mod = this.registry.get(room.gameId);
    if (!mod) return;

    const result = mod.onTimeout(room.gameState, Date.now());
    this.applyGameTransition(room, result.state, result.systemMessages);
  }

  private applyGameTransition(
    room: RoomRecord,
    nextState: RoomRecord["gameState"],
    systemMessages?: Array<{ channel: ChatChannel; content: string }>,
  ): void {
    room.gameState = nextState;
    room.updatedAt = Date.now();

    if (nextState?.sessionData !== undefined) {
      room.sessionDataByGame[room.gameId] = nextState.sessionData;
    }

    const mod = this.registry.get(room.gameId);
    const winner = nextState && mod ? mod.getWinner(nextState) : null;
    if (winner) {
      room.status = "FINISHED";
    }

    this.scheduleTimer(room);
    this.broadcastRoomState(room);
    this.broadcastGameViews(room);

    if (systemMessages) {
      for (const sm of systemMessages) {
        this.pushChatMessage(room, {
          id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          channel: sm.channel,
          senderId: null,
          senderName: "Sistem",
          content: sm.content,
          timestamp: Date.now(),
          isSystem: true,
        });
      }
    }
  }

  joinRoom(
    roomCode: string,
    playerId: string,
    nickname: string,
    avatar: AvatarId,
    sink: ClientSocketSink,
  ): { ok: true; isHost: boolean } | { ok: false; error: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { ok: false, error: "Room tidak ditemukan" };

    const mod = this.registry.get(room.gameId);
    const existing = room.players.find((p) => p.id === playerId);

    if (!existing) {
      if (room.status !== "LOBBY") {
        return { ok: false, error: "Game sedang berjalan, tunggu ronde selesai" };
      }
      if (mod && room.players.length >= mod.meta.maxPlayers) {
        return { ok: false, error: `Room penuh (maksimal ${mod.meta.maxPlayers} pemain)` };
      }
      const isHost = room.players.length === 0;
      if (isHost) room.hostId = playerId;

      room.players.push({
        id: playerId,
        nickname,
        avatar,
        isHost,
        isConnected: true,
        joinedAt: Date.now(),
      });
    } else {
      existing.isConnected = true;
      existing.nickname = nickname;
      existing.avatar = avatar;
    }

    this.getRoomSockets(room.roomCode).set(playerId, sink);
    room.updatedAt = Date.now();
    this.broadcastRoomState(room);

    // Send filtered chat history so reconnected players keep conversation context
    const allowedChannels: ChatChannel[] =
      room.status === "PLAYING" && room.gameState && mod
        ? mod.getAllowedChatChannels(room.gameState, playerId)
        : ["lobby", "public"];
    const visibleHistory = room.chatHistory.filter((m) => allowedChannels.includes(m.channel));
    sink.send({
      type: "CHAT_HISTORY",
      payload: { messages: visibleHistory },
    });

    if (room.gameState && mod) {
      sink.send({
        type: "GAME_STATE_VIEW",
        payload: {
          gameId: room.gameId,
          phase: room.gameState.phase,
          phaseEndsAt: room.gameState.phaseEndsAt,
          allowedChatChannels: mod.getAllowedChatChannels(room.gameState, playerId),
          view: mod.getPlayerView(room.gameState, playerId),
        },
      });
    }

    return { ok: true, isHost: room.hostId === playerId };
  }

  handleDisconnect(roomCode: string, playerId: string): void {
    const room = this.getRoom(roomCode);
    if (!room) return;
    this.socketsByRoom.get(room.roomCode)?.delete(playerId);

    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.isConnected = false;
    }

    // Host migration if host disconnects in LOBBY and another connected player exists
    if (room.status === "LOBBY" && room.hostId === playerId) {
      const nextHost = room.players.find((p) => p.id !== playerId && p.isConnected);
      if (nextHost) {
        room.players.forEach((p) => {
          p.isHost = p.id === nextHost.id;
        });
        room.hostId = nextHost.id;
      }
    }

    this.broadcastRoomState(room);
  }

  updateConfig(
    roomCode: string,
    playerId: string,
    input: { gameId?: string; config?: Record<string, unknown> },
  ): string | null {
    const room = this.getRoom(roomCode);
    if (!room) return "Room tidak ditemukan";
    if (room.hostId !== playerId) return "Hanya Host yang dapat mengubah pengaturan";
    if (room.status !== "LOBBY") return "Pengaturan hanya bisa diubah di Lobby";

    const nextGameId = input.gameId ?? room.gameId;
    const mod = this.registry.get(nextGameId);
    if (!mod) return `Game '${nextGameId}' tidak tersedia`;

    const mergedRaw =
      nextGameId !== room.gameId
        ? { ...mod.defaultConfig, ...(input.config ?? {}) }
        : { ...room.config, ...(input.config ?? {}) };

    room.gameId = nextGameId;
    room.config = mod.parseConfig(mergedRaw);
    room.updatedAt = Date.now();
    this.broadcastRoomState(room);
    return null;
  }

  kickPlayer(roomCode: string, hostId: string, targetPlayerId: string): string | null {
    const room = this.getRoom(roomCode);
    if (!room) return "Room tidak ditemukan";
    if (room.hostId !== hostId) return "Hanya Host yang bisa mengeluarkan pemain";
    if (hostId === targetPlayerId) return "Host tidak bisa mengeluarkan diri sendiri";
    if (room.status !== "LOBBY") return "Pemain hanya bisa dikeluarkan saat di Lobby";

    room.players = room.players.filter((p) => p.id !== targetPlayerId);
    const sink = this.socketsByRoom.get(room.roomCode)?.get(targetPlayerId);
    sink?.send({ type: "ERROR", payload: { code: "KICKED", message: "Kamu dikeluarkan oleh Host" } });
    this.socketsByRoom.get(room.roomCode)?.delete(targetPlayerId);
    this.broadcastRoomState(room);
    return null;
  }

  startGame(roomCode: string, hostId: string): string | null {
    const room = this.getRoom(roomCode);
    if (!room) return "Room tidak ditemukan";
    if (room.hostId !== hostId) return "Hanya Host yang dapat memulai permainan";

    const mod = this.registry.get(room.gameId);
    if (!mod) return "Game tidak ditemukan";
    if (room.players.length < mod.meta.minPlayers) {
      return `Minimal ${mod.meta.minPlayers} pemain untuk memulai ${mod.meta.name}`;
    }

    const config = mod.parseConfig(room.config);
    const state = mod.init(room.players, config, {
      now: Date.now(),
      pickLibraryWordPair: pickLibraryWordPairFromDb,
      previousSessionData: room.sessionDataByGame[room.gameId],
    });

    room.status = "PLAYING";
    this.applyGameTransition(room, state);
    return null;
  }

  returnToLobby(roomCode: string, hostId: string): string | null {
    const room = this.getRoom(roomCode);
    if (!room) return "Room tidak ditemukan";
    if (room.hostId !== hostId) return "Hanya Host yang dapat kembali ke Lobby";

    const existingTimer = this.timers.get(room.roomCode);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(room.roomCode);
    }

    room.status = "LOBBY";
    room.gameState = null;
    room.updatedAt = Date.now();
    this.broadcastRoomState(room);
    return null;
  }

  handleGameAction(
    roomCode: string,
    playerId: string,
    rawAction: { actionType: string; data?: unknown },
  ): string | null {
    const room = this.getRoom(roomCode);
    if (!room || !room.gameState) return "Game belum dimulai";
    const mod = this.registry.get(room.gameId);
    if (!mod) return "Modul game tidak ditemukan";

    let parsedAction: unknown;
    try {
      parsedAction = mod.parseAction(rawAction);
    } catch {
      return "Format aksi tidak valid";
    }

    const validationError = mod.validateAction(room.gameState, playerId, parsedAction);
    if (validationError) return validationError;

    const result = mod.reduce(room.gameState, playerId, parsedAction, Date.now());
    this.applyGameTransition(room, result.state, result.systemMessages);
    return null;
  }

  handleChat(
    roomCode: string,
    playerId: string,
    channel: ChatChannel,
    content: string,
  ): string | null {
    const room = this.getRoom(roomCode);
    if (!room) return "Room tidak ditemukan";
    const sender = room.players.find((p) => p.id === playerId);
    if (!sender) return "Kamu tidak terdaftar di room ini";

    // Rate limit: max 5 messages per 5 seconds per player
    const now = Date.now();
    const recent = (this.chatTimestampsByPlayer.get(playerId) ?? []).filter(
      (ts) => now - ts < CHAT_RATE_LIMIT_WINDOW_MS,
    );
    if (recent.length >= CHAT_RATE_LIMIT_MAX) {
      return "Terlalu cepat! Tunggu sebentar sebelum mengirim pesan lagi.";
    }
    recent.push(now);
    this.chatTimestampsByPlayer.set(playerId, recent);

    if (room.status === "PLAYING" && room.gameState) {
      const mod = this.registry.get(room.gameId);
      const allowed = mod?.getAllowedChatChannels(room.gameState, playerId) ?? [];
      if (!allowed.includes(channel)) {
        return "Kamu tidak memiliki izin menulis di channel ini";
      }
    }

    this.pushChatMessage(room, {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      channel,
      senderId: playerId,
      senderName: sender.nickname,
      content,
      timestamp: Date.now(),
      isSystem: false,
    });
    return null;
  }
}
