import { describe, expect, test } from "bun:test";
import { createSeededRng } from "@gemoji/game-core";
import type { Player } from "@gemoji/shared";
import { wordtrapGameModule } from "../src/index";

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

describe("wordtrap game engine", () => {
  test("Mode Reveal: picking correct letter reveals slots & hides secretWord in getPlayerView", () => {
    const players = makePlayers(3);
    const config = wordtrapGameModule.parseConfig({
      mode: "reveal",
      targetPoints: 3,
      turnDurationSec: 20,
    });

    let state = wordtrapGameModule.init(players, config, {
      now: 1000,
      rng: createSeededRng(42),
      libraryWords: ["KOMPUTER"],
    });

    expect(state.phase).toBe("PLAYING");
    expect(state.secretWord).toBe("KOMPUTER");

    const firstId = state.turnOrder[0]!;
    const secondId = state.turnOrder[1]!;

    // Out-of-turn player cannot pick letter
    expect(
      wordtrapGameModule.validateAction(state, secondId, {
        actionType: "PICK_LETTER",
        data: { letter: "K" },
      }),
    ).not.toBeNull();

    // First player picks 'K' (hit) -> no bonus turn, moves to second player
    state = wordtrapGameModule.reduce(
      state,
      firstId,
      { actionType: "PICK_LETTER", data: { letter: "K" } },
      2000,
    ).state;

    const view = wordtrapGameModule.getPlayerView(state, secondId);
    expect(view.revealedSecretWord).toBeNull();
    expect(view.slots).toEqual(["K", null, null, null, null, null, null, null]);
    expect(view.keyboard["K"]).toBe("correct");
    expect(view.currentTurnPlayerId).toBe(secondId);

    // Second player picks 'Z' (miss) -> red on keyboard
    state = wordtrapGameModule.reduce(
      state,
      secondId,
      { actionType: "PICK_LETTER", data: { letter: "Z" } },
      3000,
    ).state;
    const view2 = wordtrapGameModule.getPlayerView(state, firstId);
    expect(view2.keyboard["Z"]).toBe("wrong");
  });

  test("Mode Hidden + Skill Trap: wrong trap letter appears Green for 1 full rotation, then logs and turns Red", () => {
    const players = makePlayers(3);
    const config = wordtrapGameModule.parseConfig({
      mode: "hidden",
      targetPoints: 3,
      turnDurationSec: 20,
    });

    let state = wordtrapGameModule.init(players, config, {
      now: 1000,
      rng: createSeededRng(7),
      libraryWords: ["PELANGI"],
    });

    const [pA, pB, pC] = state.turnOrder as [string, string, string];

    // pA uses Trap on 'Z' (NOT in PELANGI!)
    state = wordtrapGameModule.reduce(
      state,
      pA,
      { actionType: "USE_TRAP", data: { letter: "Z" } },
      2000,
    ).state;

    // Opponents see 'Z' as GREEN (disguised) and no slots opened in Hidden mode
    const viewB = wordtrapGameModule.getPlayerView(state, pB);
    expect(viewB.keyboard["Z"]).toBe("correct");
    expect(viewB.slots.every((s) => s === null)).toBe(true);
    expect(viewB.me.myActiveTrap).toBeNull();

    // pA sees their own active trap privately
    const viewA = wordtrapGameModule.getPlayerView(state, pA);
    expect(viewA.me.myActiveTrap?.letter).toBe("Z");
    expect(viewA.me.trapUsedInRound).toBe(true);

    // pB takes turn (picks 'P' - genuine hit, still hidden on slots!)
    state = wordtrapGameModule.reduce(
      state,
      pB,
      { actionType: "PICK_LETTER", data: { letter: "P" } },
      3000,
    ).state;
    const viewC = wordtrapGameModule.getPlayerView(state, pC);
    expect(viewC.keyboard["P"]).toBe("correct");
    expect(viewC.slots.every((s) => s === null)).toBe(true);
    expect(viewC.keyboard["Z"]).toBe("correct"); // still active during pC's turn!

    // pC takes turn (picks 'Q' - miss) -> 1 full rotation finishes, turn returns to pA -> Trap expires!
    const resC = wordtrapGameModule.reduce(
      state,
      pC,
      { actionType: "PICK_LETTER", data: { letter: "Q" } },
      4000,
    );
    state = resC.state;

    const viewAfter = wordtrapGameModule.getPlayerView(state, pA);
    expect(viewAfter.currentTurnPlayerId).toBe(pA);
    expect(viewAfter.keyboard["Z"]).toBe("wrong"); // Reverted to true color (Red)!
    expect(state.activeTraps.length).toBe(0);
    expect(state.logs.some((l) => l.type === "trap_expired" && l.message.includes('"Z"'))).toBe(
      true,
    );
    expect(resC.systemMessages?.some((m) => m.content.includes("TRAP"))).toBe(true);
  });

  test("Mode Reveal + Skill Trap: fake letter on empty slot vanishes immediately if true letter is guessed", () => {
    const players = makePlayers(3);
    const config = wordtrapGameModule.parseConfig({
      mode: "reveal",
      targetPoints: 3,
      turnDurationSec: 20,
    });

    let state = wordtrapGameModule.init(players, config, {
      now: 1000,
      rng: createSeededRng(11),
      libraryWords: ["RENDANG"],
    });

    const [pA, pB] = state.turnOrder as [string, string];

    // pA places fake letter 'X' on slot 0 (actual letter is 'R')
    state = wordtrapGameModule.reduce(
      state,
      pA,
      { actionType: "USE_TRAP", data: { letter: "X", slotIndex: 0 } },
      2000,
    ).state;

    // pB sees 'X' on slot 0 and 'X' green on keyboard
    const viewB = wordtrapGameModule.getPlayerView(state, pB);
    expect(viewB.slots[0]).toBe("X");
    expect(viewB.keyboard["X"]).toBe("correct");

    // pB guesses the true letter 'R' -> slot 0 becomes 'R', trap busted, 'X' becomes red!
    const resB = wordtrapGameModule.reduce(
      state,
      pB,
      { actionType: "PICK_LETTER", data: { letter: "R" } },
      3000,
    );
    state = resB.state;

    const viewAfter = wordtrapGameModule.getPlayerView(state, pA);
    expect(viewAfter.slots[0]).toBe("R");
    expect(viewAfter.keyboard["R"]).toBe("correct");
    expect(viewAfter.keyboard["X"]).toBe("wrong");
    expect(state.activeTraps.length).toBe(0);
    expect(state.logs.some((l) => l.type === "trap_busted" && l.message.includes('"X"'))).toBe(
      true,
    );
  });

  test("START_WORD_GUESS pauses game for 30s; wrong eliminates player, right awards point & reaches targetPoints", () => {
    const players = makePlayers(2);
    const config = wordtrapGameModule.parseConfig({
      mode: "reveal",
      targetPoints: 2,
      turnDurationSec: 20,
    });

    let state = wordtrapGameModule.init(players, config, {
      now: 1000,
      rng: createSeededRng(5),
      libraryWords: ["GAJAH", "ELANG"],
    });

    const [pA, pB] = state.turnOrder as [string, string];
    const word1 = state.secretWord;

    // Off-turn player pB can press "Tebak Kata" anytime!
    expect(
      wordtrapGameModule.validateAction(state, pB, { actionType: "START_WORD_GUESS", data: {} }),
    ).toBeNull();

    state = wordtrapGameModule.reduce(
      state,
      pB,
      { actionType: "START_WORD_GUESS", data: {} },
      5000,
    ).state;

    expect(state.phase).toBe("GUESSING_WORD");
    expect(state.activeGuesserId).toBe(pB);
    expect(state.phaseEndsAt).toBe(35_000); // exact 30s!

    // Wrong guess -> pB eliminated for this round, game resumes to pA's turn
    state = wordtrapGameModule.reduce(
      state,
      pB,
      { actionType: "SUBMIT_WORD_GUESS", data: { word: "SALAH" } },
      10_000,
    ).state;

    expect(state.phase).toBe("PLAYING");
    expect(state.players.find((p) => p.id === pB)?.eliminatedInRound).toBe(true);
    expect(state.turnOrder[state.currentTurnIndex]).toBe(pA);

    // Eliminated pB cannot guess again in Round 1
    expect(
      wordtrapGameModule.validateAction(state, pB, { actionType: "START_WORD_GUESS", data: {} }),
    ).not.toBeNull();

    // pA buzzes & guesses correctly -> +1 point, ROUND_END
    state = wordtrapGameModule.reduce(
      state,
      pA,
      { actionType: "START_WORD_GUESS", data: {} },
      12_000,
    ).state;
    state = wordtrapGameModule.reduce(
      state,
      pA,
      { actionType: "SUBMIT_WORD_GUESS", data: { word: word1.toLowerCase() } },
      14_000,
    ).state;

    expect(state.phase).toBe("ROUND_END");
    expect(state.players.find((p) => p.id === pA)?.score).toBe(1);
    expect(wordtrapGameModule.getPlayerView(state, pB).revealedSecretWord).toBe(word1);

    // Advance to Round 2 -> pB is un-eliminated and new word selected
    state = wordtrapGameModule.reduce(
      state,
      pA,
      { actionType: "NEXT_ROUND", data: {} },
      20_000,
    ).state;

    expect(state.phase).toBe("PLAYING");
    expect(state.round).toBe(2);
    expect(state.secretWord).not.toBe(word1);
    expect(state.players.find((p) => p.id === pB)?.eliminatedInRound).toBe(false);

    // pA guesses Round 2 word -> reaches targetPoints (2) -> GAME_OVER!
    const word2 = state.secretWord;
    state = wordtrapGameModule.reduce(
      state,
      pA,
      { actionType: "START_WORD_GUESS", data: {} },
      21_000,
    ).state;
    state = wordtrapGameModule.reduce(
      state,
      pA,
      { actionType: "SUBMIT_WORD_GUESS", data: { word: word2 } },
      22_000,
    ).state;

    expect(state.phase).toBe("GAME_OVER");
    expect(state.winner?.winnerPlayerIds).toEqual([pA]);
  });

  test("trapLimit config defaults to 1 and supports 2 or 3 traps per round", () => {
    const defaultConfig = wordtrapGameModule.parseConfig({});
    expect(defaultConfig.trapLimit).toBe(1);

    const players = makePlayers(2);
    const config = wordtrapGameModule.parseConfig({
      mode: "hidden",
      targetPoints: 3,
      turnDurationSec: 20,
      trapLimit: 2,
    });

    let state = wordtrapGameModule.init(players, config, {
      now: 1000,
      rng: createSeededRng(9),
      libraryWords: ["MANGGA"],
    });

    const [pA, pB] = state.turnOrder as [string, string];

    // Trap #1 by pA
    expect(wordtrapGameModule.getPlayerView(state, pA).me.trapsRemainingInRound).toBe(2);
    state = wordtrapGameModule.reduce(
      state,
      pA,
      { actionType: "USE_TRAP", data: { letter: "Z" } },
      2000,
    ).state;
    expect(wordtrapGameModule.getPlayerView(state, pA).me.trapsUsedInRound).toBe(1);
    expect(wordtrapGameModule.getPlayerView(state, pA).me.trapsRemainingInRound).toBe(1);
    expect(wordtrapGameModule.getPlayerView(state, pA).me.trapUsedInRound).toBe(false);

    // pB picks normal letter -> turn returns to pA
    state = wordtrapGameModule.reduce(
      state,
      pB,
      { actionType: "PICK_LETTER", data: { letter: "M" } },
      3000,
    ).state;

    // Trap #2 by pA is allowed
    expect(
      wordtrapGameModule.validateAction(state, pA, {
        actionType: "USE_TRAP",
        data: { letter: "X" },
      }),
    ).toBeNull();
    state = wordtrapGameModule.reduce(
      state,
      pA,
      { actionType: "USE_TRAP", data: { letter: "X" } },
      4000,
    ).state;
    expect(wordtrapGameModule.getPlayerView(state, pA).me.trapsRemainingInRound).toBe(0);
    expect(wordtrapGameModule.getPlayerView(state, pA).me.trapUsedInRound).toBe(true);

    // pB picks normal letter -> turn returns to pA -> Trap #3 is blocked!
    state = wordtrapGameModule.reduce(
      state,
      pB,
      { actionType: "PICK_LETTER", data: { letter: "A" } },
      5000,
    ).state;
    expect(wordtrapGameModule.getPlayerView(state, pA).me.canUseTrap).toBe(false);
    expect(
      wordtrapGameModule.validateAction(state, pA, {
        actionType: "USE_TRAP",
        data: { letter: "Q" },
      }),
    ).not.toBeNull();
  });
});
