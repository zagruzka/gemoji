import type { BaseGameState, GameResult } from "@gemoji/game-core";
import type { AvatarId } from "@gemoji/shared";
import { z } from "zod";

export const SpaceteamConfigSchema = z.object({
  /** Tingkat kesulitan kecepatan timer: practice (tanpa timer), relaxed (+25%), normal (100%), panic (-15%) */
  difficulty: z.enum(["practice", "relaxed", "normal", "panic"]).default("normal"),
  /** Jumlah sektor yang harus dilintasi untuk menang */
  totalSectors: z.union([z.literal(3), z.literal(5)]).default(5),
});

export type SpaceteamConfig = z.infer<typeof SpaceteamConfigSchema>;
export type SpaceteamDifficulty = SpaceteamConfig["difficulty"];
export type SpaceteamPhase = "READY_CHECK" | "SECTOR_PREP" | "PLAYING" | "GAME_OVER";

/* ---------- Panel 2: 10 Parameter Status ---------- */

export const SIGNAL_LAMP_COLORS = [
  "BIRU",
  "KUNING",
  "MERAH",
  "HIJAU",
  "HITAM",
  "PUTIH",
  "UNGU",
] as const;
export type SignalLampColor = (typeof SIGNAL_LAMP_COLORS)[number];

export const POWER_MODES = ["ECO", "TURBO", "OVERLOAD"] as const;
export type PowerMode = (typeof POWER_MODES)[number];

export const COMPASS_DIRECTIONS = [
  "UTARA",
  "TIMUR",
  "SELATAN",
  "BARAT",
  "TENGGARA",
  "TIMUR LAUT",
  "BARAT LAUT",
  "BARAT DAYA",
] as const;
export type CompassDirection = (typeof COMPASS_DIRECTIONS)[number];

export const SYMBOL_SHAPES = ["HATI", "BULAT", "KOTAK", "BINTANG", "SEGITIGA"] as const;
export type SymbolShapeKind = (typeof SYMBOL_SHAPES)[number];
export type SymbolShapeVariant = "SOLID" | "HOLLOW";

export const BLINKING_PATTERNS = ["ALWAYS_ON", "ALWAYS_OFF", 1, 2, 3] as const;
export type BlinkingPattern = (typeof BLINKING_PATTERNS)[number];

export type ParameterState =
  | { type: "SIGNAL_LAMP"; value: SignalLampColor }
  | { type: "CORE_TEMP"; value: number }
  | { type: "POWER_MODE"; value: PowerMode }
  | { type: "COMPASS"; value: CompassDirection }
  | {
      type: "SYMBOL_SHAPE";
      value: { shape: SymbolShapeKind; variant: SymbolShapeVariant };
    }
  | { type: "BATTERY_BARS"; value: number }
  | { type: "SIGNAL_BARS"; value: number }
  | { type: "OXYGEN_PERCENTAGE"; value: number }
  | { type: "BLINKING_LIGHTS"; value: BlinkingPattern }
  | { type: "CLOCK"; value: number };

export type ParameterType = ParameterState["type"];

/* ---------- Panel 3: Modul Kontrol (Ekstensibel) ---------- */

export const SELECTOR_LEVELS = ["LOW", "MED", "HIGH"] as const;
export type SelectorLevel = (typeof SELECTOR_LEVELS)[number];

export type ControlModuleType = "BUTTON" | "TOGGLE" | "SLIDER" | "SELECTOR";

export type ToggleValue = [boolean, boolean, boolean, boolean, boolean];
/** Nilai yang dikirim saat konfirmasi modul (BUTTON = 4 digit "1"-"4", TOGGLE = 5 saklar, SLIDER = 1-10, SELECTOR = LOW/MED/HIGH) */
export type ModuleSubmitValue = string | number | ToggleValue | SelectorLevel;
/** Nilai state internal modul (SELECTOR reset ke null, BUTTON reset ke "") */
export type ModuleValue = ModuleSubmitValue | null;

export interface ControlModule {
  id: string;
  ownerId: string;
  name: string;
  type: ControlModuleType;
  currentValue: ModuleValue;
}

/* ---------- Panel 1: Instruksi ---------- */

export interface InstructionClause {
  conditionLabel: string;
  actionLabel: string;
}

export interface SpaceteamInstruction {
  id: string;
  instructorId: string;
  actorId: string;
  targetModuleId: string;
  targetModuleName: string;
  kind: "DIRECT" | "IF_ELSE";
  parameterOwnerId: string | null;
  parameterType: ParameterType | null;
  parameterLabel: string | null;
  expectedValue: ModuleSubmitValue;
  text: string;
  clauses: InstructionClause[] | null;
  createdAt: number;
  expiresAt: number | null;
  durationMs: number;
}

/* ---------- Pemain, State & Summary ---------- */

export interface SpaceteamPlayerInternal {
  id: string;
  nickname: string;
  avatar: AvatarId;
  isReady: boolean;
  parameter: ParameterState;
  modules: ControlModule[];
  nextInstructionAt: number | null;
  lastSuccessAt: number | null;
  correctCount: number;
  wrongCount: number;
}

export interface SpaceteamSummary {
  victory: boolean;
  sectorsCleared: number;
  totalSectors: number;
  totalCompleted: number;
  hullRemaining: number;
  mvpPlayerId: string | null;
  culpritPlayerId: string | null;
}

export interface SpaceteamState extends BaseGameState {
  phase: SpaceteamPhase;
  config: SpaceteamConfig;
  sector: number;
  justCompletedSector: number | null;
  sectorProgress: number;
  sectorTarget: number;
  totalCompleted: number;
  hullHp: number;
  maxHullHp: number;
  phaseTransitionEndsAt: number | null;
  players: SpaceteamPlayerInternal[];
  activeInstructions: SpaceteamInstruction[];
  lastHullDamageAt: number | null;
  lastHullDamageReason: string | null;
  summary: SpaceteamSummary | null;
  winner: GameResult | null;
  instructionSeq: number;
}

export interface SpaceteamPublicPlayer {
  id: string;
  nickname: string;
  avatar: AvatarId;
  isReady: boolean;
  correctCount: number;
  wrongCount: number;
}

export interface SpaceteamPlayerView {
  phase: SpaceteamPhase;
  config: SpaceteamConfig;
  sector: number;
  justCompletedSector: number | null;
  totalSectors: number;
  sectorProgress: number;
  sectorTarget: number;
  totalCompleted: number;
  hullHp: number;
  maxHullHp: number;
  serverNow: number;
  phaseTransitionEndsAt: number | null;
  lastHullDamageAt: number | null;
  lastHullDamageReason: string | null;
  me: {
    id: string;
    isReady: boolean;
    parameter: ParameterState | null;
    modules: ControlModule[];
    activeInstruction: {
      id: string;
      kind: "DIRECT" | "IF_ELSE";
      targetModuleName: string;
      parameterLabel: string | null;
      text: string;
      clauses: InstructionClause[] | null;
      createdAt: number;
      expiresAt: number | null;
      durationMs: number;
    } | null;
    lastSuccessAt: number | null;
    correctCount: number;
    wrongCount: number;
  };
  players: SpaceteamPublicPlayer[];
  summary: SpaceteamSummary | null;
  winner: GameResult | null;
}
