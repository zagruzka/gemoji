import type { BaseGameState } from "@gemoji/game-core";
import type { ChatMessage, Player, RoomStatus } from "@gemoji/shared";

export interface RoomRecord {
  roomCode: string;
  status: RoomStatus;
  gameId: string;
  config: Record<string, unknown>;
  hostId: string;
  players: Player[];
  gameState: BaseGameState | null;
  sessionDataByGame: Record<string, unknown>;
  chatHistory: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Abstraction layer for active room persistence.
 * Starts with InMemoryRoomStore; can be swapped to Bun.redis later without changing RoomManager.
 */
export interface RoomStore {
  get(roomCode: string): RoomRecord | undefined;
  set(roomCode: string, room: RoomRecord): void;
  delete(roomCode: string): void;
  has(roomCode: string): boolean;
  all(): RoomRecord[];
}

export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, RoomRecord>();

  get(roomCode: string): RoomRecord | undefined {
    return this.rooms.get(roomCode);
  }

  set(roomCode: string, room: RoomRecord): void {
    this.rooms.set(roomCode, room);
  }

  delete(roomCode: string): void {
    this.rooms.delete(roomCode);
  }

  has(roomCode: string): boolean {
    return this.rooms.has(roomCode);
  }

  all(): RoomRecord[] {
    return Array.from(this.rooms.values());
  }
}
