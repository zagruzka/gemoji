import { describe, expect, test } from "bun:test";
import { GameRegistry } from "@gemoji/game-core";
import { undercoverGameModule, type UndercoverPlayerView } from "@gemoji/game-undercover";
import type { ServerMessage } from "@gemoji/shared";
import { RoomManager, type ClientSocketSink } from "../src/rooms/manager";
import { InMemoryRoomStore } from "../src/rooms/store";

function createMockSink() {
  const sent: ServerMessage[] = [];
  const sink: ClientSocketSink = {
    send(msg) {
      sent.push(msg);
    },
  };
  return { sink, sent };
}

function getLatestView(sent: ServerMessage[]): UndercoverPlayerView | undefined {
  for (let i = sent.length - 1; i >= 0; i--) {
    const msg = sent[i];
    if (msg?.type === "GAME_STATE_VIEW") {
      return msg.payload.view as UndercoverPlayerView;
    }
  }
  return undefined;
}

describe("RoomManager integration (Lobby + Chat + Undercover)", () => {
  test("full flow: join, chat rate-limit, custom word pool exhaustion, reconnect", () => {
    const registry = new GameRegistry();
    registry.register(undercoverGameModule);
    const manager = new RoomManager(new InMemoryRoomStore(), registry);

    const room = manager.createRoom("undercover");
    const s1 = createMockSink();
    const s2 = createMockSink();
    const s3 = createMockSink();

    expect(manager.joinRoom(room.roomCode, "p1", "Budi", "fox", s1.sink)).toEqual({
      ok: true,
      isHost: true,
    });
    expect(manager.joinRoom(room.roomCode, "p2", "Ani", "cat", s2.sink)).toEqual({
      ok: true,
      isHost: false,
    });
    expect(manager.joinRoom(room.roomCode, "p3", "Cici", "panda", s3.sink)).toEqual({
      ok: true,
      isHost: false,
    });

    // Host configures custom word mode + open voting + unlimited timer
    expect(
      manager.updateConfig(room.roomCode, "p1", {
        config: {
          wordMode: "custom",
          voteDuration: 0,
          voteMode: "open",
          undercoverCount: 1,
          mrBlankCount: 0,
        },
      }),
    ).toBeNull();

    // Non-host cannot update config
    expect(manager.updateConfig(room.roomCode, "p2", { config: { voteMode: "secret" } })).not.toBeNull();

    // Chat works & enforces 5 msgs / 5s rate limit
    for (let i = 0; i < 5; i++) {
      expect(manager.handleChat(room.roomCode, "p1", "lobby", `Halo ${i}`)).toBeNull();
    }
    expect(manager.handleChat(room.roomCode, "p1", "lobby", "Spam!")).not.toBeNull();

    // Start game -> enters SUBMIT_CUSTOM_WORDS
    expect(manager.startGame(room.roomCode, "p1")).toBeNull();
    expect(getLatestView(s1.sent)?.phase).toBe("SUBMIT_CUSTOM_WORDS");

    // Each of the 3 players submits 1 pair (= 3 pairs total in pool)
    for (const pid of ["p1", "p2", "p3"]) {
      expect(
        manager.handleGameAction(room.roomCode, pid, {
          actionType: "SUBMIT_CUSTOM_WORDS",
          data: {
            pairs: [{ wordA: `A1_${pid}`, wordB: `B1_${pid}` }],
          },
        }),
      ).toBeNull();
    }

    // Now in REVEAL_WORD with 2 pairs left in pool
    const v1 = getLatestView(s1.sent)!;
    expect(v1.phase).toBe("REVEAL_WORD");
    expect(v1.customPoolRemaining).toBe(2);

    // Reconnect p2 receives CHAT_HISTORY + current personal GAME_STATE_VIEW
    const s2Reconnect = createMockSink();
    expect(manager.joinRoom(room.roomCode, "p2", "Ani", "cat", s2Reconnect.sink)).toEqual({
      ok: true,
      isHost: false,
    });
    expect(s2Reconnect.sent.some((m) => m.type === "CHAT_HISTORY")).toBe(true);
    const v2Reconnect = getLatestView(s2Reconnect.sent)!;
    expect(v2Reconnect.phase).toBe("REVEAL_WORD");
    expect(v2Reconnect.me.word).not.toBeNull();

    // Play 2 more starts to drain all 2 remaining pairs from pool
    for (let round = 0; round < 2; round++) {
      expect(manager.startGame(room.roomCode, "p1")).toBeNull();
      expect(getLatestView(s1.sent)?.phase).toBe("REVEAL_WORD");
    }
    expect(getLatestView(s1.sent)?.customPoolRemaining).toBe(0);

    // Next start after pool exhausted automatically asks players for 1 new word pair!
    expect(manager.startGame(room.roomCode, "p1")).toBeNull();
    expect(getLatestView(s1.sent)?.phase).toBe("SUBMIT_CUSTOM_WORDS");
  });
});
