import { describe, expect, test } from "bun:test";
import { GameRegistry } from "@gemoji/game-core";
import { spaceteamGameModule, type SpaceteamPlayerView } from "@gemoji/game-spaceteam";
import { undercoverGameModule, type UndercoverPlayerView } from "@gemoji/game-undercover";
import { unoGameModule, type UnoPlayerView } from "@gemoji/game-uno";
import { wordtrapGameModule, type WordtrapPlayerView } from "@gemoji/game-wordtrap";
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

  test("Wordtrap room flow: create, configure Hidden mode, Skill Trap & buzz word guess", () => {
    const registry = new GameRegistry();
    registry.register(undercoverGameModule);
    registry.register(wordtrapGameModule);
    const manager = new RoomManager(new InMemoryRoomStore(), registry);

    const room = manager.createRoom("wordtrap");
    const s1 = createMockSink();
    const s2 = createMockSink();

    expect(manager.joinRoom(room.roomCode, "p1", "Budi", "fox", s1.sink)).toEqual({
      ok: true,
      isHost: true,
    });
    expect(manager.joinRoom(room.roomCode, "p2", "Ani", "cat", s2.sink)).toEqual({
      ok: true,
      isHost: false,
    });

    expect(
      manager.updateConfig(room.roomCode, "p1", {
        config: { mode: "hidden", targetPoints: 2, turnDurationSec: 0 },
      }),
    ).toBeNull();

    expect(manager.startGame(room.roomCode, "p1")).toBeNull();

    const getLatestWt = (sent: ServerMessage[]): WordtrapPlayerView | undefined => {
      for (let i = sent.length - 1; i >= 0; i--) {
        const msg = sent[i];
        if (msg?.type === "GAME_STATE_VIEW" && msg.payload.gameId === "wordtrap") {
          return msg.payload.view as WordtrapPlayerView;
        }
      }
      return undefined;
    };

    const v1 = getLatestWt(s1.sent)!;
    expect(v1.phase).toBe("PLAYING");
    expect(v1.revealedSecretWord).toBeNull();
    expect(v1.wordLength).toBeGreaterThanOrEqual(5);

    const firstId = v1.currentTurnPlayerId!;
    const secondId = firstId === "p1" ? "p2" : "p1";

    // First player uses Skill Trap on letter 'Z'
    expect(
      manager.handleGameAction(room.roomCode, firstId, {
        actionType: "USE_TRAP",
        data: { letter: "Z" },
      }),
    ).toBeNull();

    const v2 = getLatestWt(secondId === "p1" ? s1.sent : s2.sent)!;
    expect(v2.keyboard["Z"]).toBe("correct");

    // Second player buzzes "Tebak Kata" -> pauses game for 30s!
    expect(
      manager.handleGameAction(room.roomCode, secondId, {
        actionType: "START_WORD_GUESS",
        data: {},
      }),
    ).toBeNull();

    const vGuess = getLatestWt(s1.sent)!;
    expect(vGuess.phase).toBe("GUESSING_WORD");
    expect(vGuess.activeGuesserId).toBe(secondId);
  });

  test("auto-shuts down room after emptyRoomTtlMs when all players offline/left, and cancels if someone rejoins", async () => {
    const registry = new GameRegistry();
    registry.register(undercoverGameModule);
    const manager = new RoomManager(new InMemoryRoomStore(), registry, {
      emptyRoomTtlMs: 60,
      disconnectGraceMs: 0,
    });

    const room = manager.createRoom("undercover");
    const s1 = createMockSink();
    expect(manager.joinRoom(room.roomCode, "p1", "Budi", "fox", s1.sink)).toEqual({
      ok: true,
      isHost: true,
    });

    // Disconnect -> starts 60ms shutdown timer, then reconnect at 25ms -> cancels shutdown!
    manager.handleDisconnect(room.roomCode, "p1");
    await Bun.sleep(25);
    expect(manager.getRoom(room.roomCode)).toBeDefined();

    const s1Re = createMockSink();
    expect(manager.joinRoom(room.roomCode, "p1", "Budi", "fox", s1Re.sink)).toEqual({
      ok: true,
      isHost: true,
    });
    await Bun.sleep(60);
    expect(manager.getRoom(room.roomCode)).toBeDefined(); // Still alive!

    // Now leave room permanently -> after 60ms room is deleted
    manager.leaveRoom(room.roomCode, "p1");
    await Bun.sleep(85);
    expect(manager.getRoom(room.roomCode)).toBeUndefined();
  });

  test("UNO room flow: create, start 2-player match, and draw card", () => {
    const registry = new GameRegistry();
    registry.register(unoGameModule);
    const manager = new RoomManager(new InMemoryRoomStore(), registry);

    const room = manager.createRoom("uno");
    const s1 = createMockSink();
    const s2 = createMockSink();
    expect(manager.joinRoom(room.roomCode, "p1", "Budi", "fox", s1.sink)).toEqual({
      ok: true,
      isHost: true,
    });
    expect(manager.joinRoom(room.roomCode, "p2", "Ani", "cat", s2.sink)).toEqual({
      ok: true,
      isHost: false,
    });
    expect(
      manager.updateConfig(room.roomCode, "p1", {
        config: { stacking: true, turnDurationSec: 20, startingHandSize: 7 },
      }),
    ).toBeNull();
    expect(manager.startGame(room.roomCode, "p1")).toBeNull();

    const getLatestUno = (sent: ServerMessage[]): UnoPlayerView | undefined => {
      for (let i = sent.length - 1; i >= 0; i--) {
        const msg = sent[i];
        if (msg?.type === "GAME_STATE_VIEW" && msg.payload.gameId === "uno") {
          return msg.payload.view as UnoPlayerView;
        }
      }
      return undefined;
    };

    const v1 = getLatestUno(s1.sent)!;
    expect(v1.phase).toBe("PLAYING");
    expect(v1.me.hand.length).toBe(7);
    const activeId = v1.currentTurnPlayerId!;
    expect(
      manager.handleGameAction(room.roomCode, activeId, {
        actionType: "DRAW_CARD",
        data: {},
      }),
    ).toBeNull();
    const vAfter = getLatestUno(activeId === "p1" ? s1.sent : s2.sent)!;
    expect(vAfter.me.hand.length).toBe(8);
  });

  test("Spaceteam room flow: create, configure, start 2-player mission with 6 modules each", () => {
    const registry = new GameRegistry();
    registry.register(spaceteamGameModule);
    const manager = new RoomManager(new InMemoryRoomStore(), registry);

    const room = manager.createRoom("spaceteam");
    const s1 = createMockSink();
    const s2 = createMockSink();
    expect(manager.joinRoom(room.roomCode, "p1", "Kapten", "fox", s1.sink)).toEqual({
      ok: true,
      isHost: true,
    });
    expect(manager.joinRoom(room.roomCode, "p2", "Teknisi", "cat", s2.sink)).toEqual({
      ok: true,
      isHost: false,
    });
    expect(
      manager.updateConfig(room.roomCode, "p1", {
        config: { difficulty: "normal", totalSectors: 3 },
      }),
    ).toBeNull();
    expect(manager.startGame(room.roomCode, "p1")).toBeNull();

    const getLatestSpace = (sent: ServerMessage[]): SpaceteamPlayerView | undefined => {
      for (let i = sent.length - 1; i >= 0; i--) {
        const msg = sent[i];
        if (msg?.type === "GAME_STATE_VIEW" && msg.payload.gameId === "spaceteam") {
          return msg.payload.view as SpaceteamPlayerView;
        }
      }
      return undefined;
    };

    const v1 = getLatestSpace(s1.sent)!;
    const v2 = getLatestSpace(s2.sent)!;
    expect(v1.phase).toBe("READY_CHECK");
    expect(v1.hullHp).toBe(100);
    expect(v1.totalSectors).toBe(3);
    expect(v1.me.modules.length).toBe(6);
    expect(v2.me.modules.length).toBe(6);
    expect(v1.me.parameter).not.toBeNull();

    // Kedua pemain tekan Ready -> langsung masuk fase countdown SECTOR_PREP
    expect(manager.handleGameAction(room.roomCode, "p1", { actionType: "PLAYER_READY", data: {} })).toBeNull();
    expect(getLatestSpace(s1.sent)?.phase).toBe("READY_CHECK");
    expect(manager.handleGameAction(room.roomCode, "p2", { actionType: "PLAYER_READY", data: {} })).toBeNull();
    expect(getLatestSpace(s1.sent)?.phase).toBe("SECTOR_PREP");
  });

  test("page refresh within disconnectGraceMs does NOT mark player offline, migrate host, or spam offline/online chat", async () => {
    const registry = new GameRegistry();
    registry.register(undercoverGameModule);
    const manager = new RoomManager(new InMemoryRoomStore(), registry, {
      disconnectGraceMs: 60,
    });

    const room = manager.createRoom("undercover");
    const s1 = createMockSink();
    const s2 = createMockSink();
    expect(manager.joinRoom(room.roomCode, "p1", "Budi", "fox", s1.sink)).toEqual({
      ok: true,
      isHost: true,
    });
    expect(manager.joinRoom(room.roomCode, "p2", "Ani", "cat", s2.sink)).toEqual({
      ok: true,
      isHost: false,
    });

    // Simulasi Host (p1) refresh halaman: disconnect lalu join lagi dalam 20ms (< 60ms grace)
    manager.handleDisconnect(room.roomCode, "p1", s1.sink);
    expect(room.players.find((p) => p.id === "p1")?.isConnected).toBe(true);
    expect(room.hostId).toBe("p1");

    await Bun.sleep(20);
    const s1Refreshed = createMockSink();
    expect(manager.joinRoom(room.roomCode, "p1", "Budi", "fox", s1Refreshed.sink)).toEqual({
      ok: true,
      isHost: true,
    });

    // Stale close dari socket lama setelah socket baru terpasang harus diabaikan
    manager.handleDisconnect(room.roomCode, "p1", s1.sink);

    await Bun.sleep(75);
    expect(room.players.find((p) => p.id === "p1")?.isConnected).toBe(true);
    expect(room.hostId).toBe("p1");
    expect(
      room.chatHistory.some(
        (m) => m.content.includes("sedang offline") || m.content.includes("kembali online"),
      ),
    ).toBe(false);

    // Jika benar-benar putus > 60ms, barulah ditandai offline & host berpindah ke p2
    manager.handleDisconnect(room.roomCode, "p1", s1Refreshed.sink);
    await Bun.sleep(75);
    expect(room.players.find((p) => p.id === "p1")?.isConnected).toBe(false);
    expect(room.hostId).toBe("p2");
    expect(room.chatHistory.some((m) => m.content.includes("sedang offline"))).toBe(true);
  });
});
