import {
  pickRandom,
  shuffle,
  type GameActionResult,
  type GameInitContext,
  type GameResult,
} from "@gemoji/game-core";
import type { ChatChannel, Player } from "@gemoji/shared";
import type { SpaceteamAction } from "./actions";
import {
  ALL_PARAMETER_TYPES,
  BASIC_MODULE_TYPES,
  MODULE_DEFINITIONS,
  MODULE_NAME_POOL,
  PARAMETER_LABELS,
  buildParameterConditionBranches,
  createRandomParameter,
} from "./catalog";
import type {
  ControlModule,
  ControlModuleType,
  InstructionClause,
  ModuleSubmitValue,
  ParameterState,
  SpaceteamConfig,
  SpaceteamDifficulty,
  SpaceteamInstruction,
  SpaceteamPlayerInternal,
  SpaceteamPlayerView,
  SpaceteamState,
  SpaceteamSummary,
} from "./state";

export const MAX_HULL_HP = 100;
export const WRONG_CONFIRM_DAMAGE = 10;
export const TIMEOUT_DAMAGE = 10;
export const WARP_HEAL_HP = 15;
export const SECTOR_PREP_DURATION_MS = 5000;
export const INSTRUCTION_RESPAWN_DELAY_MS = 500;
export const WARP_JUMP_DURATION_MS = 5000;

const DIFFICULTY_MULTIPLIER: Record<SpaceteamDifficulty, number> = {
  practice: 0,
  relaxed: 1.25,
  normal: 1.0,
  panic: 0.85,
};

export function calculateInstructionDurationMs(
  sector: number,
  playerCount: number,
  difficulty: SpaceteamDifficulty = "normal",
): number {
  if (difficulty === "practice") return 0;

  const baseMs = 15_000;
  const minMs = 5_500;
  const deltaSector = 1_100;
  const deltaPlayer = 1_000;
  const condBonus = sector >= 3 ? 2_500 : 0;

  const raw =
    baseMs - (sector - 1) * deltaSector + Math.max(0, playerCount - 2) * deltaPlayer + condBonus;
  const scaled = Math.round(raw * DIFFICULTY_MULTIPLIER[difficulty]);
  return Math.max(minMs, scaled);
}

export function calculateSectorTarget(sector: number, playerCount: number): number {
  return 8 + (sector - 1) * 3 + Math.max(0, playerCount - 2) * 2;
}

export function modulesPerPlayerCount(playerCount: number): number {
  return playerCount === 2 ? 6 : 4;
}

function dealParametersAndModules(
  players: Array<{ id: string }>,
  sector: number,
  rng: () => number,
): Map<string, { parameter: ParameterState; modules: ControlModule[] }> {
  const perPlayer = modulesPerPlayerCount(players.length);
  const shuffledNames = shuffle([...MODULE_NAME_POOL], rng);
  const shuffledParamTypes = shuffle([...ALL_PARAMETER_TYPES], rng);

  let nameIdx = 0;
  let modSeq = 0;
  const result = new Map<string, { parameter: ParameterState; modules: ControlModule[] }>();

  for (let pIdx = 0; pIdx < players.length; pIdx++) {
    const p = players[pIdx]!;
    const paramType = shuffledParamTypes[pIdx % shuffledParamTypes.length]!;
    const parameter = createRandomParameter(paramType, rng);

    // Pastikan setiap pemain mendapat variasi tipe modul yang seimbang (semua 4 tipe dasar hadir)
    const types: ControlModuleType[] = shuffle([...BASIC_MODULE_TYPES], rng);
    while (types.length < perPlayer) {
      types.push(pickRandom([...BASIC_MODULE_TYPES], rng));
    }
    const assignedTypes = shuffle(types.slice(0, perPlayer), rng);

    const modules: ControlModule[] = assignedTypes.map((type) => {
      const def = MODULE_DEFINITIONS[type];
      const name = shuffledNames[nameIdx % shuffledNames.length] ?? `Modul ${nameIdx + 1}`;
      nameIdx++;
      return {
        id: `mod_s${sector}_${modSeq++}`,
        ownerId: p.id,
        name,
        type,
        currentValue: def.createInitialValue(),
      };
    });

    result.set(p.id, { parameter, modules });
  }

  return result;
}

function computeNextEventTimestamp(state: SpaceteamState): number | null {
  if (state.phase === "GAME_OVER" || state.phase === "READY_CHECK") return null;
  if (state.phase === "SECTOR_PREP") {
    return state.phaseTransitionEndsAt;
  }

  let earliest: number | null = null;
  for (const instr of state.activeInstructions) {
    if (instr.expiresAt !== null && (earliest === null || instr.expiresAt < earliest)) {
      earliest = instr.expiresAt;
    }
  }
  for (const p of state.players) {
    if (p.nextInstructionAt !== null) {
      if (earliest === null || p.nextInstructionAt < earliest) {
        earliest = p.nextInstructionAt;
      }
    }
  }
  return earliest;
}

function buildSummary(state: SpaceteamState, victory: boolean): SpaceteamSummary {
  const sectorsCleared = victory ? state.config.totalSectors : Math.max(0, state.sector - 1);

  let mvpPlayerId: string | null = null;
  let maxCorrect = 0;
  for (const p of state.players) {
    if (p.correctCount > maxCorrect) {
      maxCorrect = p.correctCount;
      mvpPlayerId = p.id;
    }
  }

  let culpritPlayerId: string | null = null;
  let maxWrong = 0;
  for (const p of state.players) {
    if (p.wrongCount > maxWrong) {
      maxWrong = p.wrongCount;
      culpritPlayerId = p.id;
    }
  }

  return {
    victory,
    sectorsCleared,
    totalSectors: state.config.totalSectors,
    totalCompleted: state.totalCompleted,
    hullRemaining: state.hullHp,
    mvpPlayerId,
    culpritPlayerId,
  };
}

function buildGameOverState(
  state: SpaceteamState,
  victory: boolean,
): GameActionResult<SpaceteamState> {
  const summary = buildSummary(state, victory);
  const allPlayerIds = state.players.map((p) => p.id);
  const reason = victory
    ? `Misi berhasil! Kru menuntaskan seluruh ${state.config.totalSectors} sektor dengan sisa ${state.hullHp} HP!`
    : `Pesawat hancur di Sektor ${state.sector}! Hull Integrity mencapai 0 HP.`;

  const winner: GameResult = {
    winnerTeam: victory ? "crew" : "space",
    winnerPlayerIds: victory ? allPlayerIds : [],
    reason,
  };

  return {
    state: {
      ...state,
      phase: "GAME_OVER",
      phaseEndsAt: null,
      phaseTransitionEndsAt: null,
      activeInstructions: [],
      players: state.players.map((p) => ({ ...p, nextInstructionAt: null })),
      summary,
      winner,
    },
    systemMessages: [{ channel: "public", content: reason }],
  };
}

function spawnInstructionForPlayer(
  state: SpaceteamState,
  instructorId: string,
  now: number,
  rng: () => number,
): { instruction: SpaceteamInstruction; nextSeq: number } | null {
  // 1. Kumpulkan semua modul yang TIDAK sedang ditargetkan instruksi aktif (No Duplicate Target)
  const busyModuleIds = new Set(state.activeInstructions.map((i) => i.targetModuleId));

  // Prefer modul milik pemain lain (Aktor != Instruktor) agar komunikasi suara berjalan
  const otherModules: ControlModule[] = [];
  const ownModules: ControlModule[] = [];
  for (const p of state.players) {
    for (const m of p.modules) {
      if (busyModuleIds.has(m.id)) continue;
      if (p.id !== instructorId) otherModules.push(m);
      else ownModules.push(m);
    }
  }

  const candidatePool = otherModules.length > 0 ? otherModules : ownModules;
  if (candidatePool.length === 0) return null;

  const targetModule = pickRandom(candidatePool, rng);
  const def = MODULE_DEFINITIONS[targetModule.type];
  const durationMs = calculateInstructionDurationMs(
    state.sector,
    state.players.length,
    state.config.difficulty,
  );

  const nextSeq = state.instructionSeq + 1;
  const id = `instr_s${state.sector}_${nextSeq}`;

  // Sektor 1 - 2: DIRECT
  if (state.sector <= 2) {
    const expectedValue = def.createRandomTarget(rng);
    const text = def.formatDirectText(targetModule.name, expectedValue);
    return {
      instruction: {
        id,
        instructorId,
        actorId: targetModule.ownerId,
        targetModuleId: targetModule.id,
        targetModuleName: targetModule.name,
        kind: "DIRECT",
        parameterOwnerId: null,
        parameterType: null,
        parameterLabel: null,
        expectedValue,
        text,
        clauses: null,
        createdAt: now,
        expiresAt: durationMs > 0 ? now + durationMs : null,
        durationMs,
      },
      nextSeq,
    };
  }

  // Sektor 3 - 5: IF-ELSE
  // 3 - 8 pemain: parameter milik pemain B (bukan Instruktor & bukan Aktor)
  // 2 pemain: acak antara Instruktor atau Aktor
  let paramOwnerCandidates = state.players.filter(
    (p) => p.id !== instructorId && p.id !== targetModule.ownerId,
  );
  if (paramOwnerCandidates.length === 0) {
    paramOwnerCandidates = state.players;
  }
  const paramOwner = pickRandom(paramOwnerCandidates, rng);
  const param = paramOwner.parameter;
  const paramLabel = PARAMETER_LABELS[param.type];

  // Sektor 3: 2 cabang; Sektor 4-5: 2 atau 3 cabang
  const branchCount: 2 | 3 = state.sector === 3 ? 2 : rng() >= 0.4 ? 3 : 2;
  const branches = buildParameterConditionBranches(param, branchCount, rng);
  const matchingIdx = Math.max(
    0,
    branches.findIndex((b) => b.matches),
  );

  const assignedValues: ModuleSubmitValue[] = def.createDistinctTargets(branchCount, rng);
  const expectedValue = assignedValues[matchingIdx]!;
  const clauses: InstructionClause[] = branches.map((b, idx) => ({
    conditionLabel: b.label,
    actionLabel: def.formatShortAction(assignedValues[idx]!),
  }));

  const text = `${targetModule.name}: ${clauses
    .map((c) => `${c.conditionLabel} -> ${c.actionLabel}`)
    .join("; ")}`;

  return {
    instruction: {
      id,
      instructorId,
      actorId: targetModule.ownerId,
      targetModuleId: targetModule.id,
      targetModuleName: targetModule.name,
      kind: "IF_ELSE",
      parameterOwnerId: paramOwner.id,
      parameterType: param.type,
      parameterLabel: paramLabel,
      expectedValue,
      text,
      clauses,
      createdAt: now,
      expiresAt: durationMs > 0 ? now + durationMs : null,
      durationMs,
    },
    nextSeq,
  };
}

function fillReadyInstructions(
  state: SpaceteamState,
  now: number,
  rng: () => number,
): SpaceteamState {
  let working = state;
  const activeInstructorIds = new Set(working.activeInstructions.map((i) => i.instructorId));

  // Urutkan acak agar adil saat perebutan target modul
  const playerIds = shuffle(
    working.players.map((p) => p.id),
    rng,
  );

  for (const pid of playerIds) {
    const player = working.players.find((p) => p.id === pid);
    if (!player) continue;
    if (activeInstructorIds.has(pid)) continue;
    if (player.nextInstructionAt !== null && player.nextInstructionAt > now) continue;

    const spawned = spawnInstructionForPlayer(working, pid, now, rng);
    if (!spawned) continue;

    activeInstructorIds.add(pid);
    working = {
      ...working,
      instructionSeq: spawned.nextSeq,
      activeInstructions: [...working.activeInstructions, spawned.instruction],
      players: working.players.map((p) =>
        p.id === pid ? { ...p, nextInstructionAt: null } : p,
      ),
    };
  }

  return working;
}

export function initSpaceteam(
  players: Player[],
  config: SpaceteamConfig,
  context: GameInitContext,
): SpaceteamState {
  const rng = context.rng ?? Math.random;
  const dealt = dealParametersAndModules(players, 1, rng);

  const internalPlayers: SpaceteamPlayerInternal[] = players.map((p) => {
    const pack = dealt.get(p.id)!;
    return {
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      isReady: false,
      parameter: pack.parameter,
      modules: pack.modules,
      nextInstructionAt: null,
      lastSuccessAt: null,
      correctCount: 0,
      wrongCount: 0,
    };
  });

  return {
    phase: "READY_CHECK",
    phaseEndsAt: null,
    phaseTransitionEndsAt: null,
    config,
    sector: 1,
    justCompletedSector: null,
    sectorProgress: 0,
    sectorTarget: calculateSectorTarget(1, players.length),
    totalCompleted: 0,
    hullHp: MAX_HULL_HP,
    maxHullHp: MAX_HULL_HP,
    players: internalPlayers,
    activeInstructions: [],
    lastHullDamageAt: null,
    lastHullDamageReason: null,
    summary: null,
    winner: null,
    instructionSeq: 0,
  };
}

export function validateSpaceteamAction(
  state: SpaceteamState,
  playerId: string,
  action: SpaceteamAction,
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Pemain tidak ditemukan di game ini";

  switch (action.actionType) {
    case "PLAYER_READY": {
      if (state.phase !== "READY_CHECK") {
        return "Bukan fase konfirmasi kesiapan";
      }
      if (player.isReady) {
        return "Kamu sudah menekan Ready";
      }
      return null;
    }

    case "SUBMIT_MODULE": {
      if (state.phase !== "PLAYING") {
        return "Modul hanya bisa dikonfirmasi saat misi sedang berjalan";
      }
      const mod = player.modules.find((m) => m.id === action.data.moduleId);
      if (!mod) return "Modul kontrol tidak ditemukan di panelmu";

      const val = action.data.value;
      if (mod.type === "BUTTON") {
        if (typeof val !== "string" || !/^[1-4]{4}$/.test(val)) {
          return "Kode tombol harus 4 digit angka 1 sampai 4";
        }
      } else if (mod.type === "TOGGLE") {
        if (!Array.isArray(val) || val.length !== 5) {
          return "Nilai saklar harus terdiri dari 5 posisi ON/OFF";
        }
      } else if (mod.type === "SLIDER") {
        if (typeof val !== "number" || val < 1 || val > 10) {
          return "Nilai slider harus antara 1 sampai 10";
        }
      } else if (mod.type === "SELECTOR") {
        if (typeof val !== "string" || !["LOW", "MED", "HIGH"].includes(val)) {
          return "Nilai selector tidak valid";
        }
      }
      return null;
    }
  }
}

export function reduceSpaceteam(
  state: SpaceteamState,
  playerId: string,
  action: SpaceteamAction,
  now: number,
  rng: () => number = Math.random,
): GameActionResult<SpaceteamState> {
  switch (action.actionType) {
    case "PLAYER_READY": {
      if (state.phase !== "READY_CHECK") return { state };
      const updatedPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, isReady: true } : p,
      );
      const allReady = updatedPlayers.every((p) => p.isReady);

      if (allReady) {
        const prepEndsAt = now + SECTOR_PREP_DURATION_MS;
        return {
          state: {
            ...state,
            phase: "SECTOR_PREP",
            phaseEndsAt: prepEndsAt,
            phaseTransitionEndsAt: prepEndsAt,
            players: updatedPlayers,
          },
        };
      }

      return {
        state: {
          ...state,
          players: updatedPlayers,
        },
      };
    }

    case "SUBMIT_MODULE": {
      if (state.phase !== "PLAYING") return { state };
      const player = state.players.find((p) => p.id === playerId)!;
      const mod = player.modules.find((m) => m.id === action.data.moduleId)!;
      const def = MODULE_DEFINITIONS[mod.type];
      const submittedValue = action.data.value;

      const matchingInstr = state.activeInstructions.find(
        (i) => i.targetModuleId === mod.id,
      );

      // 1. EKSEKUSI BENAR (Correct Action) -> selalu reset state modul ke nilai awal!
      if (matchingInstr && def.valuesEqual(submittedValue, matchingInstr.expectedValue)) {
        const resetValue = def.createInitialValue();
        const nextProgress = state.sectorProgress + 1;
        const nextTotalCompleted = state.totalCompleted + 1;

        const updatedPlayers = state.players.map((p) => {
          let nextP = p;
          if (p.id === playerId) {
            nextP = {
              ...nextP,
              correctCount: nextP.correctCount + 1,
              lastSuccessAt: now,
              modules: nextP.modules.map((m) =>
                m.id === mod.id ? { ...m, currentValue: resetValue } : m,
              ),
            };
          }
          if (p.id === matchingInstr.instructorId) {
            nextP = {
              ...nextP,
              lastSuccessAt: now,
              nextInstructionAt: now + INSTRUCTION_RESPAWN_DELAY_MS,
            };
          }
          return nextP;
        });

        const remainingInstructions = state.activeInstructions.filter(
          (i) => i.id !== matchingInstr.id,
        );

        const nextState: SpaceteamState = {
          ...state,
          sectorProgress: nextProgress,
          totalCompleted: nextTotalCompleted,
          players: updatedPlayers,
          activeInstructions: remainingInstructions,
        };

        // Cek apakah sektor selesai!
        if (nextProgress >= state.sectorTarget) {
          if (state.sector >= state.config.totalSectors) {
            return buildGameOverState(nextState, true);
          }

          // Naik ke sektor berikutnya -> pulih +15 HP, acak ulang parameter & modul, tunggu semua pemain READY!
          const nextSector = state.sector + 1;
          const nextHull = Math.min(state.maxHullHp, state.hullHp + WARP_HEAL_HP);
          const dealt = dealParametersAndModules(nextState.players, nextSector, rng);

          const readyState: SpaceteamState = {
            ...nextState,
            phase: "READY_CHECK",
            phaseEndsAt: null,
            phaseTransitionEndsAt: null,
            sector: nextSector,
            justCompletedSector: state.sector,
            sectorProgress: 0,
            sectorTarget: calculateSectorTarget(nextSector, nextState.players.length),
            hullHp: nextHull,
            activeInstructions: [],
            players: nextState.players.map((p) => {
              const pack = dealt.get(p.id)!;
              return {
                ...p,
                isReady: false,
                parameter: pack.parameter,
                modules: pack.modules,
                nextInstructionAt: null,
              };
            }),
          };

          return {
            state: readyState,
            systemMessages: [
              {
                channel: "public",
                content: `Sektor ${state.sector} selesai! Hull pulih +${WARP_HEAL_HP} HP. Tekan Ready untuk meluncur ke Sektor ${nextSector}!`,
              },
            ],
          };
        }

        // Acak ulang parameter pemilik yang sudah tidak dikunci instruksi aktif (opsional: jaga dinamika di sektor IF-ELSE)
        let syncedState = nextState;
        if (matchingInstr.parameterOwnerId) {
          const stillLocked = remainingInstructions.some(
            (i) => i.parameterOwnerId === matchingInstr.parameterOwnerId,
          );
          if (!stillLocked) {
            syncedState = {
              ...syncedState,
              players: syncedState.players.map((p) =>
                p.id === matchingInstr.parameterOwnerId
                  ? { ...p, parameter: createRandomParameter(p.parameter.type, rng) }
                  : p,
              ),
            };
          }
        }

        return {
          state: {
            ...syncedState,
            phaseEndsAt: computeNextEventTimestamp(syncedState),
          },
        };
      }

      // 2. SALAH KONFIRMASI (Wrong Value / Modul Tidak Ditargetkan) -> -5 HP, state modul tetap di-reset, instruksi tetap aktif!
      const nextHull = Math.max(0, state.hullHp - WRONG_CONFIRM_DAMAGE);
      const penaltyModuleValue = def.onWrongConfirm
        ? def.onWrongConfirm(mod)
        : def.createInitialValue();
      const reason = `${player.nickname} salah konfirmasi pada ${mod.name} (-${WRONG_CONFIRM_DAMAGE} HP)`;

      const damagedState: SpaceteamState = {
        ...state,
        hullHp: nextHull,
        lastHullDamageAt: now,
        lastHullDamageReason: reason,
        players: state.players.map((p) =>
          p.id === playerId
            ? {
              ...p,
              wrongCount: p.wrongCount + 1,
              modules: p.modules.map((m) =>
                m.id === mod.id ? { ...m, currentValue: penaltyModuleValue } : m,
              ),
            }
            : p,
        ),
      };

      if (nextHull <= 0) {
        return buildGameOverState(damagedState, false);
      }

      return {
        state: {
          ...damagedState,
          phaseEndsAt: computeNextEventTimestamp(damagedState),
        },
      };
    }
  }
}

export function onSpaceteamTimeout(
  state: SpaceteamState,
  now: number,
  rng: () => number = Math.random,
): GameActionResult<SpaceteamState> {
  if (state.phase === "GAME_OVER" || state.phase === "READY_CHECK") return { state };

  // 1. Selesai countdown awal sektor -> mulai PLAYING & spawn instruksi untuk seluruh pemain
  if (state.phase === "SECTOR_PREP") {
    if (state.phaseTransitionEndsAt !== null && now < state.phaseTransitionEndsAt) {
      return { state };
    }
    const basePlaying: SpaceteamState = {
      ...state,
      phase: "PLAYING",
      justCompletedSector: null,
      phaseTransitionEndsAt: null,
      players: state.players.map((p) => ({ ...p, isReady: false, nextInstructionAt: now })),
    };
    const filled = fillReadyInstructions(basePlaying, now, rng);
    return {
      state: {
        ...filled,
        phaseEndsAt: computeNextEventTimestamp(filled),
      },
    };
  }

  // 2. PLAYING: proses semua instruksi yang timeout (-10 HP) & spawn instruksi yang sudah lewat jeda 500ms
  const expired: SpaceteamInstruction[] = [];
  const surviving: SpaceteamInstruction[] = [];

  for (const instr of state.activeInstructions) {
    if (instr.expiresAt !== null && instr.expiresAt <= now) {
      expired.push(instr);
    } else {
      surviving.push(instr);
    }
  }

  let working: SpaceteamState = state;

  if (expired.length > 0) {
    const totalDamage = expired.length * TIMEOUT_DAMAGE;
    const nextHull = Math.max(0, state.hullHp - totalDamage);
    const expiredInstructorIds = new Set(expired.map((i) => i.instructorId));
    const reason =
      expired.length === 1
        ? `Instruksi ${expired[0]!.targetModuleName} habis waktu (-${TIMEOUT_DAMAGE} HP)`
        : `${expired.length} instruksi habis waktu (-${totalDamage} HP)`;

    working = {
      ...working,
      hullHp: nextHull,
      lastHullDamageAt: now,
      lastHullDamageReason: reason,
      activeInstructions: surviving,
      players: working.players.map((p) =>
        expiredInstructorIds.has(p.id)
          ? { ...p, nextInstructionAt: now + INSTRUCTION_RESPAWN_DELAY_MS }
          : p,
      ),
    };

    if (nextHull <= 0) {
      return buildGameOverState(working, false);
    }
  }

  working = fillReadyInstructions(working, now, rng);

  return {
    state: {
      ...working,
      phaseEndsAt: computeNextEventTimestamp(working),
    },
  };
}

export function getSpaceteamPlayerView(
  state: SpaceteamState,
  playerId: string,
  now: number = Date.now(),
): SpaceteamPlayerView {
  const me = state.players.find((p) => p.id === playerId);
  const myInstruction =
    state.activeInstructions.find((i) => i.instructorId === playerId) ?? null;

  return {
    phase: state.phase,
    config: state.config,
    sector: state.sector,
    justCompletedSector: state.justCompletedSector,
    totalSectors: state.config.totalSectors,
    sectorProgress: state.sectorProgress,
    sectorTarget: state.sectorTarget,
    totalCompleted: state.totalCompleted,
    hullHp: state.hullHp,
    maxHullHp: state.maxHullHp,
    serverNow: now,
    phaseTransitionEndsAt: state.phaseTransitionEndsAt,
    lastHullDamageAt: state.lastHullDamageAt,
    lastHullDamageReason: state.lastHullDamageReason,
    me: {
      id: playerId,
      isReady: me?.isReady ?? false,
      parameter: me?.parameter ?? null,
      modules: me?.modules ?? [],
      activeInstruction: myInstruction
        ? {
          id: myInstruction.id,
          kind: myInstruction.kind,
          targetModuleName: myInstruction.targetModuleName,
          parameterLabel: myInstruction.parameterLabel,
          text: myInstruction.text,
          clauses: myInstruction.clauses,
          createdAt: myInstruction.createdAt,
          expiresAt: myInstruction.expiresAt,
          durationMs: myInstruction.durationMs,
        }
        : null,
      lastSuccessAt: me?.lastSuccessAt ?? null,
      correctCount: me?.correctCount ?? 0,
      wrongCount: me?.wrongCount ?? 0,
    },
    players: state.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      isReady: p.isReady,
      correctCount: p.correctCount,
      wrongCount: p.wrongCount,
    })),
    summary: state.summary,
    winner: state.winner,
  };
}

export function getSpaceteamChatChannels(
  state: SpaceteamState,
  playerId: string,
): ChatChannel[] {
  if (state.phase === "GAME_OVER") return ["public", "lobby"];
  const exists = state.players.some((p) => p.id === playerId);
  return exists ? ["public"] : [];
}
