import { describe, expect, test } from "bun:test";
import { createSeededRng } from "@gemoji/game-core";
import type { Player } from "@gemoji/shared";
import { SKIP_VOTE_TARGET, undercoverGameModule } from "../src/index";

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `Pemain${i + 1}`,
    avatar: "fox",
    isHost: i === 0,
    isConnected: true,
    joinedAt: i,
  }));
}

describe("undercover game engine", () => {
  test("library mode hides other players' words & roles in getPlayerView", () => {
    const players = makePlayers(4);
    const config = undercoverGameModule.parseConfig({
      wordMode: "library",
      undercoverCount: 1,
      mrBlankCount: 0,
      blindRole: true,
    });

    const state = undercoverGameModule.init(players, config, {
      now: 1000,
      rng: createSeededRng(42),
    });

    expect(state.phase).toBe("REVEAL_WORD");
    const view = undercoverGameModule.getPlayerView(state, "p1");
    expect(view.me.word).not.toBeNull();
    expect(view.me.knownRole).toBeNull(); // blindRole hides citizen/undercover
    expect(view.players.every((p) => p.revealedRole === null && p.revealedWord === null)).toBe(true);
  });

  test("custom word mode collects 1 pair per player, pools them, and reuses until exhausted", () => {
    const players = makePlayers(3);
    const config = undercoverGameModule.parseConfig({
      wordMode: "custom",
      undercoverCount: 1,
      mrBlankCount: 0,
      voteDuration: "unlimited",
      voteMode: "open",
    });

    let state = undercoverGameModule.init(players, config, {
      now: 1000,
      rng: createSeededRng(7),
    });

    expect(state.phase).toBe("SUBMIT_CUSTOM_WORDS");

    for (const [idx, p] of players.entries()) {
      const res = undercoverGameModule.reduce(
        state,
        p.id,
        {
          actionType: "SUBMIT_CUSTOM_WORDS",
          data: {
            pairs: [{ wordA: `KataA${idx}_1`, wordB: `KataB${idx}_1` }],
          },
        },
        2000,
      );
      state = res.state;
    }

    // 3 players * 1 pair = 3 pairs total; 1 consumed for round 1 => 2 left in pool
    expect(state.phase).toBe("REVEAL_WORD");
    expect(state.sessionData.customPool.length).toBe(2);

    // Next round reusing previousSessionData skips SUBMIT_CUSTOM_WORDS
    const round2State = undercoverGameModule.init(players, config, {
      now: 3000,
      rng: createSeededRng(9),
      previousSessionData: state.sessionData,
    });
    expect(round2State.phase).toBe("REVEAL_WORD");
    expect(round2State.sessionData.customPool.length).toBe(1);
  });

  test("secret vs open vote mode respects visibility and unlimited timer has null phaseEndsAt", () => {
    const players = makePlayers(4);
    const config = undercoverGameModule.parseConfig({
      wordMode: "library",
      undercoverCount: 1,
      mrBlankCount: 0,
      voteDuration: "unlimited",
      voteMode: "secret",
    });

    let state = undercoverGameModule.init(players, config, {
      now: 1000,
      rng: createSeededRng(100),
    });

    for (const p of players) {
      state = undercoverGameModule.reduce(state, p.id, { actionType: "MARK_READY", data: {} }, 2000).state;
    }
    expect(state.phase).toBe("CLUE_ROUND");

    for (const turnPlayerId of state.turnOrder) {
      state = undercoverGameModule.reduce(
        state,
        turnPlayerId,
        { actionType: "SUBMIT_CLUE", data: { clue: "Enak" } },
        3000,
      ).state;
    }

    expect(state.phase).toBe("VOTING");
    expect(state.phaseEndsAt).toBeNull(); // unlimited!

    // p1 votes for p2
    state = undercoverGameModule.reduce(
      state,
      "p1",
      { actionType: "CAST_VOTE", data: { targetPlayerId: "p2" } },
      4000,
    ).state;

    const p3View = undercoverGameModule.getPlayerView(state, "p3");
    expect(p3View.liveVotes).toBeNull(); // secret mode hides who p1 voted for
    expect(p3View.votedPlayerIds).toContain("p1");
  });

  test("Mr. Blank wins immediately when guessing the Citizen word correctly", () => {
    const players = makePlayers(4);
    const config = undercoverGameModule.parseConfig({
      wordMode: "library",
      undercoverCount: 0,
      mrBlankCount: 1,
      voteDuration: 60,
      voteMode: "open",
    });

    let state = undercoverGameModule.init(players, config, {
      now: 1000,
      rng: createSeededRng(15),
    });

    const mrBlank = state.players.find((p) => p.role === "mr_blank")!;
    expect(mrBlank).toBeDefined();
    expect(mrBlank.word).toBeNull();

    for (const p of players) {
      state = undercoverGameModule.reduce(state, p.id, { actionType: "MARK_READY", data: {} }, 2000).state;
    }

    // Mr. Blank must never be first in Round 1
    expect(state.turnOrder[0]).not.toBe(mrBlank.id);

    for (const turnPlayerId of state.turnOrder) {
      state = undercoverGameModule.reduce(
        state,
        turnPlayerId,
        { actionType: "SUBMIT_CLUE", data: { clue: "Minuman" } },
        3000,
      ).state;
    }

    // Everyone else votes for Mr. Blank
    for (const p of players) {
      const target = p.id === mrBlank.id ? players.find((x) => x.id !== mrBlank.id)!.id : mrBlank.id;
      state = undercoverGameModule.reduce(
        state,
        p.id,
        { actionType: "CAST_VOTE", data: { targetPlayerId: target } },
        4000,
      ).state;
    }

    expect(state.phase).toBe("MR_BLANK_GUESS");

    state = undercoverGameModule.reduce(
      state,
      mrBlank.id,
      { actionType: "SUBMIT_MR_BLANK_GUESS", data: { guess: `  ${state.citizenWord!.toLowerCase()}  ` } },
      5000,
    ).state;

    expect(state.phase).toBe("GAME_OVER");
    expect(state.winner?.winnerTeam).toBe("mr_blank");

    const finalView = undercoverGameModule.getPlayerView(state, "p1");
    expect(finalView.roleSummary).toEqual({ citizen: 3, undercover: 0, mrBlank: 1 });
    expect(finalView.revealSummary?.citizenWord).not.toBeNull();
    expect(finalView.revealSummary?.undercoverWord).toBeNull();
  });

  test("face-to-face mode (clueDurationSec=0) jumps straight to VOTING and supports skip vote", () => {
    const players = makePlayers(4);
    const config = undercoverGameModule.parseConfig({
      wordMode: "library",
      undercoverCount: 1,
      mrBlankCount: 0,
      clueDurationSec: 0,
      voteDuration: "unlimited",
      voteMode: "open",
    });

    let state = undercoverGameModule.init(players, config, {
      now: 1000,
      rng: createSeededRng(21),
    });

    for (const p of players) {
      state = undercoverGameModule.reduce(state, p.id, { actionType: "MARK_READY", data: {} }, 2000).state;
    }

    // Skips CLUE_ROUND directly to VOTING
    expect(state.phase).toBe("VOTING");
    expect(state.turnOrder.length).toBe(4);

    // Majority votes SKIP -> nobody eliminated, moves directly to Round 2 VOTING
    for (const p of players) {
      expect(
        undercoverGameModule.validateAction(state, p.id, {
          actionType: "CAST_VOTE",
          data: { targetPlayerId: SKIP_VOTE_TARGET },
        }),
      ).toBeNull();
      state = undercoverGameModule.reduce(
        state,
        p.id,
        { actionType: "CAST_VOTE", data: { targetPlayerId: SKIP_VOTE_TARGET } },
        3000,
      ).state;
    }

    expect(state.phase).toBe("VOTING");
    expect(state.round).toBe(2);
    expect(state.lastElimination?.reason).toBe("skipped");
    expect(state.players.every((p) => p.alive)).toBe(true);
  });
});
