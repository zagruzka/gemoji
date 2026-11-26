import { describe, expect, test } from "bun:test";
import { createSeededRng } from "@gemoji/game-core";
import type { Player } from "@gemoji/shared";
import { createStandardUnoDeck, unoGameModule, type UnoState } from "../src/index";

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

describe("uno game engine", () => {
  test("creates 108-card standard deck, deals 7 cards each, and hides opponents' hands", () => {
    expect(createStandardUnoDeck().length).toBe(108);

    const players = makePlayers(3);
    const config = unoGameModule.parseConfig({});
    const state = unoGameModule.init(players, config, {
      now: 1000,
      rng: createSeededRng(42),
    });

    expect(state.phase).toBe("PLAYING");
    expect(state.players.every((p) => p.hand.length === 7)).toBe(true);
    expect(state.discardPile.length).toBe(1);
    expect(state.drawPile.length).toBe(108 - 21 - 1);

    const view = unoGameModule.getPlayerView(state, "p1");
    expect(view.me.hand.length).toBe(7);
    expect(view.players.every((p) => p.cardCount === 7)).toBe(true);
    expect("hand" in view.players[1]!).toBe(false);
  });

  test("stacking ON: +2 can be stacked with +2 or +4, and +4 only with +4", () => {
    const players = makePlayers(3);
    const config = unoGameModule.parseConfig({ stacking: true, turnDurationSec: 20 });
    const base = unoGameModule.init(players, config, { now: 1000, rng: createSeededRng(1) });
    const [p1, p2, p3] = base.turnOrder as [string, string, string];

    let state: UnoState = {
      ...base,
      activeColor: "red",
      discardPile: [{ id: "top", color: "red", value: "5" }],
      players: base.players.map((p) => {
        if (p.id === p1) {
          return {
            ...p,
            hand: [
              { id: "r_d2", color: "red", value: "draw2" },
              { id: "extra1", color: "blue", value: "1" },
            ],
          };
        }
        if (p.id === p2) {
          return {
            ...p,
            hand: [
              { id: "w4", color: "wild", value: "wild4" },
              { id: "b_d2", color: "blue", value: "draw2" },
              { id: "r_3", color: "red", value: "3" },
            ],
          };
        }
        return {
          ...p,
          hand: [
            { id: "g_d2", color: "green", value: "draw2" },
            { id: "g_7", color: "green", value: "7" },
          ],
        };
      }),
    };

    // p1 plays red +2 -> pendingDraw = 2
    state = unoGameModule.reduce(
      state,
      p1,
      { actionType: "PLAY_CARD", data: { cardId: "r_d2" } },
      2000,
    ).state;
    expect(state.pendingDraw).toBe(2);
    expect(state.pendingDrawType).toBe("draw2");

    // p2 cannot play regular red 3 while pendingDraw > 0
    expect(
      unoGameModule.validateAction(state, p2, {
        actionType: "PLAY_CARD",
        data: { cardId: "r_3" },
      }),
    ).not.toBeNull();

    // p2 stacks Wild +4 on top of +2 -> pendingDraw = 6, type = wild4
    state = unoGameModule.reduce(
      state,
      p2,
      { actionType: "PLAY_CARD", data: { cardId: "w4", chosenColor: "green" } },
      3000,
    ).state;
    expect(state.pendingDraw).toBe(6);
    expect(state.pendingDrawType).toBe("wild4");
    expect(state.activeColor).toBe("green");

    // p3 CANNOT stack +2 on top of +4!
    expect(
      unoGameModule.validateAction(state, p3, {
        actionType: "PLAY_CARD",
        data: { cardId: "g_d2" },
      }),
    ).not.toBeNull();

    // p3 draws 6 penalty cards
    const beforeCount = state.players.find((p) => p.id === p3)!.hand.length;
    state = unoGameModule.reduce(state, p3, { actionType: "DRAW_CARD", data: {} }, 4000).state;
    expect(state.pendingDraw).toBe(0);
    expect(state.players.find((p) => p.id === p3)!.hand.length).toBe(beforeCount + 6);
  });

  test("2-player Reverse acts as Skip and forgetting UNO! can be caught for +2 penalty", () => {
    const players = makePlayers(2);
    const config = unoGameModule.parseConfig({ stacking: false, turnDurationSec: 20 });
    const base = unoGameModule.init(players, config, { now: 1000, rng: createSeededRng(2) });
    const [p1, p2] = base.turnOrder as [string, string];

    let state: UnoState = {
      ...base,
      activeColor: "blue",
      discardPile: [{ id: "top", color: "blue", value: "2" }],
      players: base.players.map((p) =>
        p.id === p1
          ? {
              ...p,
              hand: [
                { id: "b_rev", color: "blue", value: "reverse" },
                { id: "b_9", color: "blue", value: "9" },
              ],
            }
          : { ...p, hand: [{ id: "r_1", color: "red", value: "1" }, { id: "r_2", color: "red", value: "2" }] },
      ),
    };

    // With 2 cards left, CALL_UNO is NOT available yet
    expect(unoGameModule.getPlayerView(state, p1).me.canCallUno).toBe(false);
    expect(
      unoGameModule.validateAction(state, p1, { actionType: "CALL_UNO", data: {} }),
    ).not.toBeNull();

    // p1 plays blue Reverse -> drops to 1 card: stays p1's turn (2-player skip), UNO! unlocks, catch delayed 1s
    state = unoGameModule.reduce(
      state,
      p1,
      { actionType: "PLAY_CARD", data: { cardId: "b_rev" } },
      2000,
    ).state;

    expect(state.turnOrder[state.currentTurnIndex]).toBe(p1);
    expect(state.unoVulnerablePlayerId).toBe(p1);
    expect(state.unoCatchableAt).toBe(3000);
    expect(unoGameModule.getPlayerView(state, p1).me.canCallUno).toBe(true);

    // p2 tries catching before 1s delay (at 2500ms) -> ignored
    state = unoGameModule.reduce(
      state,
      p2,
      { actionType: "CATCH_UNO", data: { targetPlayerId: p1 } },
      2500,
    ).state;
    expect(state.unoVulnerablePlayerId).toBe(p1);
    expect(state.players.find((p) => p.id === p1)!.hand.length).toBe(1);

    // p2 catches p1 after 1s delay (at 3000ms) -> p1 receives +2 penalty cards!
    state = unoGameModule.reduce(
      state,
      p2,
      { actionType: "CATCH_UNO", data: { targetPlayerId: p1 } },
      3000,
    ).state;

    expect(state.unoVulnerablePlayerId).toBeNull();
    expect(state.unoCatchableAt).toBeNull();
    expect(state.players.find((p) => p.id === p1)!.hand.length).toBe(3);
  });

  test("draw 1 playable card allows playing it or passing, and playing last card wins immediately", () => {
    const players = makePlayers(2);
    const config = unoGameModule.parseConfig({ stacking: true, turnDurationSec: 20 });
    const base = unoGameModule.init(players, config, { now: 1000, rng: createSeededRng(3) });
    const [p1, p2] = base.turnOrder as [string, string];

    let state: UnoState = {
      ...base,
      activeColor: "yellow",
      discardPile: [{ id: "top", color: "yellow", value: "4" }],
      drawPile: [{ id: "drawn_b2", color: "blue", value: "2" }],
      players: base.players.map((p) =>
        p.id === p1
          ? {
              ...p,
              hand: [
                { id: "r_1", color: "red", value: "1" },
                { id: "y_3", color: "yellow", value: "3" },
              ],
            }
          : { ...p, hand: [{ id: "y_9", color: "yellow", value: "9" }] },
      ),
    };

    // p1 already has playable y_3, draws non-matching b2 -> still allowed to play y_3 OR pass!
    state = unoGameModule.reduce(state, p1, { actionType: "DRAW_CARD", data: {} }, 2000).state;
    expect(state.turnOrder[state.currentTurnIndex]).toBe(p1);
    expect(state.drawnPlayableCardId).toBe("drawn_b2");
    expect(unoGameModule.getPlayerView(state, p1).me.playableCardIds).toContain("y_3");
    expect(
      unoGameModule.validateAction(state, p1, {
        actionType: "PLAY_CARD",
        data: { cardId: "y_3" },
      }),
    ).toBeNull();

    // p1 passes turn -> moves to p2
    state = unoGameModule.reduce(state, p1, { actionType: "PASS_TURN", data: {} }, 3000).state;
    expect(state.turnOrder[state.currentTurnIndex]).toBe(p2);
    expect(state.drawnPlayableCardId).toBeNull();

    // p2 plays last card -> wins immediately!
    state = unoGameModule.reduce(
      state,
      p2,
      { actionType: "PLAY_CARD", data: { cardId: "y_9" } },
      4000,
    ).state;
    expect(state.phase).toBe("GAME_OVER");
    expect(state.winner?.winnerPlayerIds).toEqual([p2]);
  });

  test("drawing a card with no playable cards does NOT auto-skip turn (waits for PASS_TURN)", () => {
    const players = makePlayers(2);
    const config = unoGameModule.parseConfig({ stacking: true, turnDurationSec: 20 });
    const base = unoGameModule.init(players, config, { now: 1000, rng: createSeededRng(4) });
    const [p1, p2] = base.turnOrder as [string, string];

    let state: UnoState = {
      ...base,
      activeColor: "yellow",
      discardPile: [{ id: "top", color: "yellow", value: "4" }],
      drawPile: [{ id: "drawn_g7", color: "green", value: "7" }],
      players: base.players.map((p) =>
        p.id === p1
          ? { ...p, hand: [{ id: "r_1", color: "red", value: "1" }] }
          : { ...p, hand: [{ id: "y_9", color: "yellow", value: "9" }] },
      ),
    };

    // p1 has no matching cards and draws non-matching g7 -> turn MUST stay on p1 until PASS_TURN
    state = unoGameModule.reduce(state, p1, { actionType: "DRAW_CARD", data: {} }, 2000).state;
    const view1 = unoGameModule.getPlayerView(state, p1);
    expect(view1.currentTurnPlayerId).toBe(p1);
    expect(view1.me.canPass).toBe(true);
    expect(view1.me.canDraw).toBe(false);
    expect(view1.me.playableCardIds).toEqual([]);

    // Player manually passes -> moves to p2
    state = unoGameModule.reduce(state, p1, { actionType: "PASS_TURN", data: {} }, 3000).state;
    expect(state.turnOrder[state.currentTurnIndex]).toBe(p2);
  });
});
