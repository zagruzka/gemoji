import { pickRandom, shuffle } from "@gemoji/game-core";
import {
  BLINKING_PATTERNS,
  COMPASS_DIRECTIONS,
  POWER_MODES,
  SELECTOR_LEVELS,
  SIGNAL_LAMP_COLORS,
  SYMBOL_SHAPES,
  type BlinkingPattern,
  type CompassDirection,
  type ControlModule,
  type ControlModuleType,
  type ModuleSubmitValue,
  type ModuleValue,
  type ParameterState,
  type ParameterType,
  type PowerMode,
  type SelectorLevel,
  type SignalLampColor,
  type SymbolShapeKind,
  type SymbolShapeVariant,
  type ToggleValue,
} from "./state";

/**
 * 44 nama modul sci-fi berbahasa Inggris yang kontras secara fonetik
 * agar tidak saling tertukar saat diteriakkan di voice call (hingga 8 pemain = 32 modul).
 */
export const MODULE_NAME_POOL: readonly string[] = [
  "Plasma Valve",
  "Flux Capacitor",
  "Hyperdrive Core",
  "Orbit Stabilizer",
  "Cryo Cooler",
  "Shield Deflector",
  "Radar Dish",
  "Gravity Booster",
  "Oxygen Pump",
  "Antimatter Coil",
  "Airlock Seal",
  "Quantum Scanner",
  "Thruster Trigger",
  "Ion Regulator",
  "Warp Conduit",
  "Solar Array",
  "Laser Array",
  "Fusion Injector",
  "Magnetic Lock",
  "Photon Relay",
  "Cargo Winch",
  "Radiation Filter",
  "Circuit Breaker",
  "Distress Beacon",
  "Hydrogen Vent",
  "Astro Gyro",
  "Hull Balancer",
  "Field Generator",
  "Landing Gear",
  "Cosmic Horn",
  "Fuel Manifold",
  "Graviton Sensor",
  "Cabin Heater",
  "Air Purifier",
  "Satellite Link",
  "Backup Relay",
  "Nitrogen Valve",
  "Antenna Rotor",
  "Atmo Brake",
  "Hatch Clamp",
  "Starlight Matrix",
  "Subspace Tuner",
  "Ion Thruster",
  "Reactor Vent",
];

export const BASIC_MODULE_TYPES: readonly ControlModuleType[] = [
  "BUTTON",
  "TOGGLE",
  "SLIDER",
  "SELECTOR",
];

export interface ModuleDefinition {
  type: ControlModuleType;
  createInitialValue: () => ModuleValue;
  createRandomTarget: (rng: () => number) => ModuleSubmitValue;
  createDistinctTargets: (count: number, rng: () => number) => ModuleSubmitValue[];
  valuesEqual: (a: ModuleSubmitValue, b: ModuleSubmitValue) => boolean;
  formatShortAction: (value: ModuleSubmitValue) => string;
  formatDirectText: (moduleName: string, value: ModuleSubmitValue) => string;
  /** Hook opsional untuk konsekuensi spesifik modul saat salah konfirmasi */
  onWrongConfirm?: (module: ControlModule) => ModuleValue;
}

function randomInt(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function randomButtonCode(rng: () => number): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += String(randomInt(1, 4, rng));
  }
  return code;
}

function toggleFromMask(mask: number): ToggleValue {
  return [
    Boolean(mask & 1),
    Boolean(mask & 2),
    Boolean(mask & 4),
    Boolean(mask & 8),
    Boolean(mask & 16),
  ];
}

function randomToggleValue(rng: () => number): ToggleValue {
  // mask 1..31 -> minimal 1 saklar ON (karena semua OFF membuat tombol OK nonaktif)
  return toggleFromMask(randomInt(1, 31, rng));
}

function toggleValuesEqual(a: ToggleValue, b: ToggleValue): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4];
}

function formatTogglePattern(val: ToggleValue): string {
  return val.map((on) => (on ? "ON" : "OFF")).join(" ");
}

export const MODULE_DEFINITIONS: Record<ControlModuleType, ModuleDefinition> = {
  BUTTON: {
    type: "BUTTON",
    createInitialValue: () => "",
    createRandomTarget: (rng) => randomButtonCode(rng),
    createDistinctTargets: (count, rng) => {
      const picked = new Set<string>();
      while (picked.size < count) {
        picked.add(randomButtonCode(rng));
      }
      return [...picked];
    },
    valuesEqual: (a, b) => typeof a === "string" && typeof b === "string" && a === b,
    formatShortAction: (val) => `Kode ${val as string}`,
    formatDirectText: (name, val) => `Masukkan kode ${val as string} pada ${name}`,
  },

  TOGGLE: {
    type: "TOGGLE",
    createInitialValue: () => [false, false, false, false, false],
    createRandomTarget: (rng) => randomToggleValue(rng),
    createDistinctTargets: (count, rng) => {
      const all: ToggleValue[] = [];
      for (let mask = 1; mask < 32; mask++) {
        all.push(toggleFromMask(mask));
      }
      return shuffle(all, rng).slice(0, count);
    },
    valuesEqual: (a, b) =>
      Array.isArray(a) && Array.isArray(b) && toggleValuesEqual(a as ToggleValue, b as ToggleValue),
    formatShortAction: (val) => `[${formatTogglePattern(val as ToggleValue)}]`,
    formatDirectText: (name, val) =>
      `Setel ${name} ke [${formatTogglePattern(val as ToggleValue)}]`,
  },

  SLIDER: {
    type: "SLIDER",
    createInitialValue: () => 0,
    createRandomTarget: (rng) => randomInt(1, 10, rng),
    createDistinctTargets: (count, rng) =>
      shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rng).slice(0, count),
    valuesEqual: (a, b) => typeof a === "number" && typeof b === "number" && a === b,
    formatShortAction: (val) => `Level ${val as number}`,
    formatDirectText: (name, val) => `Geser ${name} ke level ${val as number}`,
  },

  SELECTOR: {
    type: "SELECTOR",
    createInitialValue: () => null,
    createRandomTarget: (rng) => pickRandom([...SELECTOR_LEVELS], rng),
    createDistinctTargets: (count, rng) => shuffle([...SELECTOR_LEVELS], rng).slice(0, count),
    valuesEqual: (a, b) => typeof a === "string" && typeof b === "string" && a === b,
    formatShortAction: (val) => `${val as SelectorLevel}`,
    formatDirectText: (name, val) => `Atur ${name} ke ${val as SelectorLevel}`,
  },
};

/* ---------- 10 Parameter Panel 2 & Generator Cabang IF-ELSE ---------- */

export const ALL_PARAMETER_TYPES: readonly ParameterType[] = [
  "SIGNAL_LAMP",
  "CORE_TEMP",
  "POWER_MODE",
  "COMPASS",
  "SYMBOL_SHAPE",
  "BATTERY_BARS",
  "SIGNAL_BARS",
  "OXYGEN_PERCENTAGE",
  "BLINKING_LIGHTS",
  "CLOCK",
];

export const PARAMETER_LABELS: Record<ParameterType, string> = {
  SIGNAL_LAMP: "Lampu Sinyal",
  CORE_TEMP: "Suhu Mesin",
  POWER_MODE: "Mode Daya",
  COMPASS: "Kompas",
  SYMBOL_SHAPE: "Simbol",
  BATTERY_BARS: "Bar Baterai",
  SIGNAL_BARS: "Bar Sinyal",
  OXYGEN_PERCENTAGE: "Oksigen",
  BLINKING_LIGHTS: "Lampu Kedip",
  CLOCK: "Jam Analog",
};

export function createRandomParameter(type: ParameterType, rng: () => number): ParameterState {
  switch (type) {
    case "SIGNAL_LAMP":
      return { type, value: pickRandom([...SIGNAL_LAMP_COLORS], rng) };
    case "CORE_TEMP":
      return { type, value: randomInt(10, 99, rng) };
    case "POWER_MODE":
      return { type, value: pickRandom([...POWER_MODES], rng) };
    case "COMPASS":
      return { type, value: pickRandom([...COMPASS_DIRECTIONS], rng) };
    case "SYMBOL_SHAPE":
      return {
        type,
        value: {
          shape: pickRandom([...SYMBOL_SHAPES], rng),
          variant: rng() >= 0.5 ? "SOLID" : "HOLLOW",
        },
      };
    case "BATTERY_BARS":
      return { type, value: randomInt(1, 5, rng) };
    case "SIGNAL_BARS":
      return { type, value: randomInt(1, 5, rng) };
    case "OXYGEN_PERCENTAGE":
      return { type, value: randomInt(1, 100, rng) };
    case "BLINKING_LIGHTS":
      return { type, value: pickRandom([...BLINKING_PATTERNS], rng) };
    case "CLOCK":
      return { type, value: randomInt(1, 12, rng) };
  }
}

export interface ConditionBranchSpec {
  label: string;
  matches: boolean;
}

function formatBlinkingLabel(pat: BlinkingPattern): string {
  if (pat === "ALWAYS_ON") return "NYALA TERUS";
  if (pat === "ALWAYS_OFF") return "MATI TERUS";
  return `KEDIP ${pat}x`;
}

/**
 * Membangun 2 atau 3 cabang kondisi (IF / ELSE IF / ELSE) yang saling eksklusif
 * dan 100% deterministik terhadap nilai parameter saat ini.
 * Cabang terakhir selalu "Selain itu" sebagai fallback.
 */
export function buildParameterConditionBranches(
  param: ParameterState,
  branchCount: 2 | 3,
  rng: () => number,
): ConditionBranchSpec[] {
  switch (param.type) {
    case "SIGNAL_LAMP": {
      const actual: SignalLampColor = param.value;
      const others = shuffle(
        SIGNAL_LAMP_COLORS.filter((c) => c !== actual),
        rng,
      );
      if (branchCount === 2) {
        const hitFirst = rng() >= 0.45;
        const condColor = hitFirst ? actual : others[0]!;
        return [
          { label: `Jika Lampu Sinyal ${condColor}`, matches: hitFirst },
          { label: "Selain itu", matches: !hitFirst },
        ];
      }
      const hitIdx = randomInt(0, 2, rng); // 0, 1, atau 2 (else)
      const c0 = hitIdx === 0 ? actual : others[0]!;
      const c1 = hitIdx === 1 ? actual : others[1]!;
      return [
        { label: `Jika Lampu Sinyal ${c0}`, matches: hitIdx === 0 },
        { label: `Jika ${c1}`, matches: hitIdx === 1 },
        { label: "Selain itu", matches: hitIdx === 2 },
      ];
    }

    case "POWER_MODE": {
      const actual: PowerMode = param.value;
      const others = shuffle(
        POWER_MODES.filter((m) => m !== actual),
        rng,
      );
      if (branchCount === 2) {
        const hitFirst = rng() >= 0.45;
        const condMode = hitFirst ? actual : others[0]!;
        return [
          { label: `Jika Mode Daya ${condMode}`, matches: hitFirst },
          { label: "Selain itu", matches: !hitFirst },
        ];
      }
      const order = shuffle([...POWER_MODES], rng) as [PowerMode, PowerMode, PowerMode];
      return [
        { label: `Jika Mode Daya ${order[0]}`, matches: actual === order[0] },
        { label: `Jika ${order[1]}`, matches: actual === order[1] },
        { label: "Selain itu", matches: actual === order[2] },
      ];
    }

    case "COMPASS": {
      const actual: CompassDirection = param.value;
      const cardinalSet = new Set<CompassDirection>(["UTARA", "TIMUR", "SELATAN", "BARAT"]);
      if (branchCount === 2 && rng() >= 0.5) {
        const isCardinal = cardinalSet.has(actual);
        return [
          { label: "Jika Kompas arah utama (U/T/S/B)", matches: isCardinal },
          { label: "Selain itu", matches: !isCardinal },
        ];
      }
      const others = shuffle(
        COMPASS_DIRECTIONS.filter((d) => d !== actual),
        rng,
      );
      if (branchCount === 2) {
        const hitFirst = rng() >= 0.45;
        const d0 = hitFirst ? actual : others[0]!;
        return [
          { label: `Jika Kompas ke ${d0}`, matches: hitFirst },
          { label: "Selain itu", matches: !hitFirst },
        ];
      }
      const hitIdx = randomInt(0, 2, rng);
      const d0 = hitIdx === 0 ? actual : others[0]!;
      const d1 = hitIdx === 1 ? actual : others[1]!;
      return [
        { label: `Jika Kompas ke ${d0}`, matches: hitIdx === 0 },
        { label: `Jika ke ${d1}`, matches: hitIdx === 1 },
        { label: "Selain itu", matches: hitIdx === 2 },
      ];
    }

    case "SYMBOL_SHAPE": {
      const actualShape: SymbolShapeKind = param.value.shape;
      const actualVariant: SymbolShapeVariant = param.value.variant;
      if (branchCount === 2 && rng() >= 0.5) {
        const isSolid = actualVariant === "SOLID";
        return [
          { label: "Jika Simbol SOLID (penuh)", matches: isSolid },
          { label: "Jika HOLLOW (garis)", matches: !isSolid },
        ];
      }
      const others = shuffle(
        SYMBOL_SHAPES.filter((s) => s !== actualShape),
        rng,
      );
      if (branchCount === 2) {
        const hitFirst = rng() >= 0.45;
        const s0 = hitFirst ? actualShape : others[0]!;
        return [
          { label: `Jika Simbol ${s0}`, matches: hitFirst },
          { label: "Selain itu", matches: !hitFirst },
        ];
      }
      const hitIdx = randomInt(0, 2, rng);
      const s0 = hitIdx === 0 ? actualShape : others[0]!;
      const s1 = hitIdx === 1 ? actualShape : others[1]!;
      return [
        { label: `Jika Simbol ${s0}`, matches: hitIdx === 0 },
        { label: `Jika ${s1}`, matches: hitIdx === 1 },
        { label: "Selain itu", matches: hitIdx === 2 },
      ];
    }

    case "CORE_TEMP": {
      const temp = param.value;
      if (branchCount === 2) {
        if (rng() >= 0.5) {
          return [
            { label: "Jika Suhu Mesin < 50°C", matches: temp < 50 },
            { label: "Selain itu (>= 50°C)", matches: temp >= 50 },
          ];
        }
        const isEven = temp % 2 === 0;
        return [
          { label: "Jika Suhu Mesin GENAP", matches: isEven },
          { label: "Jika GANJIL", matches: !isEven },
        ];
      }
      return [
        { label: "Jika Suhu Mesin < 40°C", matches: temp < 40 },
        { label: "Jika 40°C - 70°C", matches: temp >= 40 && temp <= 70 },
        { label: "Selain itu (> 70°C)", matches: temp > 70 },
      ];
    }

    case "OXYGEN_PERCENTAGE": {
      const oxy = param.value;
      if (branchCount === 2) {
        return [
          { label: "Jika Oksigen < 50%", matches: oxy < 50 },
          { label: "Selain itu (>= 50%)", matches: oxy >= 50 },
        ];
      }
      return [
        { label: "Jika Oksigen <= 33%", matches: oxy <= 33 },
        { label: "Jika 34% - 66%", matches: oxy >= 34 && oxy <= 66 },
        { label: "Selain itu (> 66%)", matches: oxy > 66 },
      ];
    }

    case "BATTERY_BARS": {
      const bars = param.value;
      if (branchCount === 2) {
        return [
          { label: "Jika Bar Baterai <= 2", matches: bars <= 2 },
          { label: "Selain itu (>= 3)", matches: bars >= 3 },
        ];
      }
      return [
        { label: "Jika Bar Baterai 1 - 2", matches: bars <= 2 },
        { label: "Jika 3 - 4", matches: bars >= 3 && bars <= 4 },
        { label: "Jika penuh (5)", matches: bars === 5 },
      ];
    }

    case "SIGNAL_BARS": {
      const bars = param.value;
      if (branchCount === 2) {
        return [
          { label: "Jika Bar Sinyal <= 2", matches: bars <= 2 },
          { label: "Selain itu (>= 3)", matches: bars >= 3 },
        ];
      }
      return [
        { label: "Jika Bar Sinyal 1 - 2", matches: bars <= 2 },
        { label: "Jika 3 - 4", matches: bars >= 3 && bars <= 4 },
        { label: "Jika penuh (5)", matches: bars === 5 },
      ];
    }

    case "BLINKING_LIGHTS": {
      const actual: BlinkingPattern = param.value;
      const others = shuffle(
        BLINKING_PATTERNS.filter((p) => p !== actual),
        rng,
      );
      if (branchCount === 2) {
        const hitFirst = rng() >= 0.45;
        const p0 = hitFirst ? actual : others[0]!;
        return [
          { label: `Jika Lampu Kedip ${formatBlinkingLabel(p0)}`, matches: hitFirst },
          { label: "Selain itu", matches: !hitFirst },
        ];
      }
      const hitIdx = randomInt(0, 2, rng);
      const p0 = hitIdx === 0 ? actual : others[0]!;
      const p1 = hitIdx === 1 ? actual : others[1]!;
      return [
        { label: `Jika Lampu Kedip ${formatBlinkingLabel(p0)}`, matches: hitIdx === 0 },
        { label: `Jika ${formatBlinkingLabel(p1)}`, matches: hitIdx === 1 },
        { label: "Selain itu", matches: hitIdx === 2 },
      ];
    }

    case "CLOCK": {
      const hour = param.value;
      if (branchCount === 2) {
        if (rng() >= 0.5) {
          return [
            { label: "Jika Jam Analog 1 - 6", matches: hour <= 6 },
            { label: "Selain itu (7 - 12)", matches: hour >= 7 },
          ];
        }
        const isEven = hour % 2 === 0;
        return [
          { label: "Jika Jam Analog GENAP", matches: isEven },
          { label: "Jika GANJIL", matches: !isEven },
        ];
      }
      return [
        { label: "Jika Jam Analog 1 - 4", matches: hour <= 4 },
        { label: "Jika 5 - 8", matches: hour >= 5 && hour <= 8 },
        { label: "Selain itu (9 - 12)", matches: hour >= 9 },
      ];
    }
  }
}
