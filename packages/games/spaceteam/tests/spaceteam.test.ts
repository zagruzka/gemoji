import { describe, expect, test } from "bun:test";
import { createSeededRng } from "@gemoji/game-core";
import type { Player } from "@gemoji/shared";
import {
  calculateInstructionDurationMs,
  calculateSectorTarget,
  spaceteamGameModule,
  type ModuleSubmitValue,
  type SpaceteamState,
  type ToggleValue,
} from "../src/index";
import {
  INSTRUCTION_RESPAWN_DELAY_MS,
  SECTOR_PREP_DURATION_MS,
  TIMEOUT_DAMAGE,
  WARP_HEAL_HP,
  WRONG_CONFIRM_DAMAGE,
  onSpaceteamTimeout,
  reduceSpaceteam,
} from "../src/engine";

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `Kru${i + 1}`,
    avatar: "fox",
    isHost: i === 0,
    isConnected: true,
    joinedAt: i,
  }));
}

function readyAllAndStart(
  initial: SpaceteamState,
  readyAt: number,
  rng: () => number,
): { state: SpaceteamState; startedAt: number } {
  let state = initial;
  for (const p of state.players) {
    state = reduceSpaceteam(
      state,
      p.id,
      { actionType: "PLAYER_READY", data: {} },
      readyAt,
      rng,
    ).state;
  }
  expect(state.phase).toBe("SECTOR_PREP");
  const startedAt = readyAt + SECTOR_PREP_DURATION_MS;
  state = onSpaceteamTimeout(state, startedAt, rng).state;
  expect(state.phase).toBe("PLAYING");
  return { state, startedAt };
}

describe("spaceteam game engine", () => {
  test("duration and sector target formulas match specification", () => {
    expect(calculateInstructionDurationMs(1, 2, "normal")).toBe(20_000);
    expect(calculateInstructionDurationMs(2, 2, "normal")).toBe(18_900);
    expect(calculateInstructionDurationMs(3, 2, "normal")).toBe(20_300);
    expect(calculateInstructionDurationMs(4, 4, "normal")).toBe(21_200);
    expect(calculateInstructionDurationMs(5, 8, "normal")).toBe(24_100);
    expect(calculateInstructionDurationMs(5, 2, "panic")).toBe(Math.round(18_100 * 0.85));
    expect(calculateInstructionDurationMs(1, 2, "relaxed")).toBe(25_000);
    expect(calculateInstructionDurationMs(1, 2, "practice")).toBe(0);

    expect(calculateSectorTarget(1, 2)).toBe(8);
    expect(calculateSectorTarget(5, 2)).toBe(20);
    expect(calculateSectorTarget(1, 4)).toBe(12);
    expect(calculateSectorTarget(5, 8)).toBe(32);
  });

  test("starts in READY_CHECK, deals 6 modules for 2 players and 4 modules for 3-8 players with unique names", () => {
    const rng = createSeededRng(42);
    const config = spaceteamGameModule.parseConfig({});

    const s2 = spaceteamGameModule.init(makePlayers(2), config, { now: 1000, rng });
    expect(s2.phase).toBe("READY_CHECK");
    expect(s2.phaseEndsAt).toBeNull();
    expect(s2.players.every((p) => p.modules.length === 6 && !p.isReady)).toBe(true);
    const names2 = new Set(s2.players.flatMap((p) => p.modules.map((m) => m.name)));
    expect(names2.size).toBe(12);

    const s8 = spaceteamGameModule.init(makePlayers(8), config, { now: 1000, rng });
    expect(s8.phase).toBe("READY_CHECK");
    expect(s8.players.every((p) => p.modules.length === 4)).toBe(true);
    const names8 = new Set(s8.players.flatMap((p) => p.modules.map((m) => m.name)));
    expect(names8.size).toBe(32);
  });

  test("requires all players to press READY before 5s countdown, then spawns non-duplicate instructions", () => {
    const rng = createSeededRng(7);
    const config = spaceteamGameModule.parseConfig({ totalSectors: 5 });
    let state = spaceteamGameModule.init(makePlayers(3), config, { now: 1000, rng });

    // Baru 2 dari 3 pemain yang ready -> masih di READY_CHECK
    state = reduceSpaceteam(state, "p1", { actionType: "PLAYER_READY", data: {} }, 1500, rng).state;
    state = reduceSpaceteam(state, "p2", { actionType: "PLAYER_READY", data: {} }, 1600, rng).state;
    expect(state.phase).toBe("READY_CHECK");
    expect(state.phaseEndsAt).toBeNull();

    // Pemain ke-3 ready -> langsung masuk SECTOR_PREP 5 detik!
    state = reduceSpaceteam(state, "p3", { actionType: "PLAYER_READY", data: {} }, 2000, rng).state;
    expect(state.phase).toBe("SECTOR_PREP");
    expect(state.phaseEndsAt).toBe(2000 + SECTOR_PREP_DURATION_MS);

    // Selesai countdown 5 detik -> PLAYING dengan 3 instruksi paralel target unik
    const tPlay = 2000 + SECTOR_PREP_DURATION_MS;
    state = onSpaceteamTimeout(state, tPlay, rng).state;
    expect(state.phase).toBe("PLAYING");
    expect(state.activeInstructions.length).toBe(3);

    const uniqueTargets = new Set(state.activeInstructions.map((i) => i.targetModuleId));
    expect(uniqueTargets.size).toBe(3);

    // Eksekusi benar oleh aktor instruksi pertama
    const first = state.activeInstructions[0]!;
    const tAction = tPlay + 500;
    state = reduceSpaceteam(
      state,
      first.actorId,
      {
        actionType: "SUBMIT_MODULE",
        data: { moduleId: first.targetModuleId, value: first.expectedValue },
      },
      tAction,
      rng,
    ).state;

    expect(state.sectorProgress).toBe(1);
    expect(state.activeInstructions.length).toBe(2);
    expect(state.players.find((p) => p.id === first.actorId)?.correctCount).toBe(1);
    expect(state.players.find((p) => p.id === first.instructorId)?.lastSuccessAt).toBe(tAction);
    expect(state.players.find((p) => p.id === first.instructorId)?.nextInstructionAt).toBe(
      tAction + INSTRUCTION_RESPAWN_DELAY_MS,
    );

    // Setelah 500ms, instruksi baru muncul kembali
    state = onSpaceteamTimeout(state, tAction + INSTRUCTION_RESPAWN_DELAY_MS, rng).state;
    expect(state.activeInstructions.length).toBe(3);
    const uniqueTargetsAfter = new Set(state.activeInstructions.map((i) => i.targetModuleId));
    expect(uniqueTargetsAfter.size).toBe(3);
  });

  test("wrong confirm deals -10 HP while keeping instruction active, and timeout deals -10 HP", () => {
    const rng = createSeededRng(11);
    const config = spaceteamGameModule.parseConfig({});
    const init = spaceteamGameModule.init(makePlayers(2), config, { now: 1000, rng });
    let { state, startedAt } = readyAllAndStart(init, 1500, rng);

    const first = state.activeInstructions[0]!;
    const actor = state.players.find((p) => p.id === first.actorId)!;
    const mod = actor.modules.find((m) => m.id === first.targetModuleId)!;

    // Buat nilai yang pasti salah
    let wrongVal: ModuleSubmitValue;
    if (mod.type === "BUTTON") {
      wrongVal = first.expectedValue === "1111" ? "2222" : "1111";
    } else if (mod.type === "SLIDER") {
      wrongVal = first.expectedValue === 1 ? 2 : 1;
    } else if (mod.type === "SELECTOR") {
      wrongVal = first.expectedValue === "LOW" ? "HIGH" : "LOW";
    } else {
      const exp = first.expectedValue as ToggleValue;
      wrongVal = [!exp[0], exp[1], exp[2], exp[3], exp[4]];
    }

    state = reduceSpaceteam(
      state,
      first.actorId,
      { actionType: "SUBMIT_MODULE", data: { moduleId: mod.id, value: wrongVal } },
      startedAt + 500,
      rng,
    ).state;

    expect(state.hullHp).toBe(100 - WRONG_CONFIRM_DAMAGE);
    expect(state.players.find((p) => p.id === first.actorId)?.wrongCount).toBe(1);
    expect(state.activeInstructions.some((i) => i.id === first.id)).toBe(true);

    // Timeout seluruh instruksi aktif (2 instruksi -> -20 HP)
    const maxExpire = Math.max(...state.activeInstructions.map((i) => i.expiresAt ?? 0));
    state = onSpaceteamTimeout(state, maxExpire, rng).state;
    expect(state.hullHp).toBe(100 - WRONG_CONFIRM_DAMAGE - TIMEOUT_DAMAGE * 2);
    expect(state.activeInstructions.length).toBe(0);
  });

  test("practice difficulty spawns instructions without timer (expiresAt = null) and never times out", () => {
    const rng = createSeededRng(33);
    const config = spaceteamGameModule.parseConfig({ difficulty: "practice", totalSectors: 3 });
    const init = spaceteamGameModule.init(makePlayers(2), config, { now: 1000, rng });
    let { state } = readyAllAndStart(init, 1200, rng);

    expect(state.phase).toBe("PLAYING");
    expect(state.activeInstructions.length).toBe(2);
    expect(state.activeInstructions.every((i) => i.expiresAt === null && i.durationMs === 0)).toBe(
      true,
    );
    expect(state.phaseEndsAt).toBeNull();

    state = onSpaceteamTimeout(state, 999_999, rng).state;
    expect(state.hullHp).toBe(100);
    expect(state.activeInstructions.length).toBe(2);
  });

  test("sector clear enters READY_CHECK with +15 HP heal, requires all READY for next sector, up to Victory", () => {
    const rng = createSeededRng(21);
    const config = spaceteamGameModule.parseConfig({ totalSectors: 3 });
    const init = spaceteamGameModule.init(makePlayers(3), config, { now: 1000, rng });
    let { state, startedAt } = readyAllAndStart(init, 1500, rng);

    // Selesaikan Sektor 1 -> masuk READY_CHECK Sektor 2 dengan Hull +15 HP (70 -> 85)
    state = { ...state, hullHp: 70, sectorProgress: state.sectorTarget - 1 };
    const i1 = state.activeInstructions[0]!;
    const tClear1 = startedAt + 1000;
    state = reduceSpaceteam(
      state,
      i1.actorId,
      { actionType: "SUBMIT_MODULE", data: { moduleId: i1.targetModuleId, value: i1.expectedValue } },
      tClear1,
      rng,
    ).state;

    expect(state.phase).toBe("READY_CHECK");
    expect(state.sector).toBe(2);
    expect(state.justCompletedSector).toBe(1);
    expect(state.hullHp).toBe(70 + WARP_HEAL_HP);
    expect(state.players.every((p) => !p.isReady)).toBe(true);

    // Semua kru tekan Ready -> Countdown 5s -> Sektor 2 PLAYING -> selesaikan Sektor 2
    const s2 = readyAllAndStart(state, tClear1 + 500, rng);
    state = { ...s2.state, sectorProgress: s2.state.sectorTarget - 1 };
    const i2 = state.activeInstructions[0]!;
    const tClear2 = s2.startedAt + 1000;
    state = reduceSpaceteam(
      state,
      i2.actorId,
      { actionType: "SUBMIT_MODULE", data: { moduleId: i2.targetModuleId, value: i2.expectedValue } },
      tClear2,
      rng,
    ).state;
    expect(state.phase).toBe("READY_CHECK");
    expect(state.sector).toBe(3);

    // Semua kru tekan Ready -> Countdown 5s -> Sektor 3 PLAYING (IF-ELSE)
    const s3 = readyAllAndStart(state, tClear2 + 500, rng);
    state = s3.state;
    expect(state.sector).toBe(3);
    expect(state.phase).toBe("PLAYING");
    for (const instr of state.activeInstructions) {
      expect(instr.kind).toBe("IF_ELSE");
      expect(instr.clauses?.length).toBe(2);
      expect(instr.parameterOwnerId).not.toBe(instr.instructorId);
      expect(instr.parameterOwnerId).not.toBe(instr.actorId);
    }

    // Selesaikan Sektor 3 (sektor terakhir) -> VICTORY dengan 0 kesalahan
    state = { ...state, sectorProgress: state.sectorTarget - 1 };
    const i3 = state.activeInstructions[0]!;
    state = reduceSpaceteam(
      state,
      i3.actorId,
      { actionType: "SUBMIT_MODULE", data: { moduleId: i3.targetModuleId, value: i3.expectedValue } },
      s3.startedAt + 1000,
      rng,
    ).state;

    expect(state.phase).toBe("GAME_OVER");
    expect(state.summary?.victory).toBe(true);
    expect(state.summary?.culpritPlayerId).toBeNull();
    expect(state.summary?.mvpPlayerId).not.toBeNull();
    expect(state.winner?.winnerTeam).toBe("crew");
  });
});
