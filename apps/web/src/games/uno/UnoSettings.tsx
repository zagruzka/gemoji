import type { UnoConfig } from "@gemoji/game-uno";
import { CheckIcon, InfinityIcon, LayersIcon } from "lucide-react";

interface UnoSettingsProps {
  config: UnoConfig;
  isHost: boolean;
  onChange: (patch: Partial<UnoConfig>) => void;
}

const HAND_SIZES: Array<{ value: UnoConfig["startingHandSize"]; label: string }> = [
  { value: 5, label: "5 Kartu" },
  { value: 7, label: "7 Kartu" },
];

const TURN_DURATIONS: Array<{ value: UnoConfig["turnDurationSec"]; label: string }> = [
  { value: 0, label: "unlimited" },
  { value: 15, label: "15s" },
  { value: 20, label: "20s" },
  { value: 30, label: "30s" },
];

export function UnoSettings({ config, isHost, onChange }: UnoSettingsProps) {
  const pillBtn = (active: boolean) =>
    [
      "font-display rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition",
      active
        ? "border-[#e0326a] bg-[#ffe694] text-[#5c1632] shadow-[0_3px_0_#e0326a]"
        : "border-[#d8cfa3] bg-[#fffdf0] text-[#6a5d48]",
      isHost ? "cursor-pointer hover:bg-[#fff6cc]" : "cursor-default",
    ].join(" ");

  return (
    <div className="space-y-3 rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] p-2.5">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-bold uppercase tracking-wide text-[#5c1632]">
          Pengaturan UNO
        </span>
        {!isHost && (
          <span className="rounded-full bg-[#dcd3a6] px-2.5 py-0.5 text-[11px] font-extrabold text-[#6b5d44]">
            Diatur Host
          </span>
        )}
      </div>

      {/* Kartu Awal */}
      <div>
        <div className="mb-1.5 flex items-center gap-1 text-xs font-extrabold text-[#6e6049]">
          <LayersIcon className="h-3.5 w-3.5" />
          Kartu Awal
        </div>
        <div className="grid grid-cols-2 gap-2">
          {HAND_SIZES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={!isHost}
              onClick={() => onChange({ startingHandSize: opt.value })}
              className={pillBtn(config.startingHandSize === opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timer Giliran */}
      <div>
        <div className="mb-1.5 text-xs font-extrabold text-[#6e6049]">Timer Giliran</div>
        <div className="grid grid-cols-4 gap-1.5">
          {TURN_DURATIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={!isHost}
              onClick={() => onChange({ turnDurationSec: opt.value })}
              className={pillBtn(config.turnDurationSec === opt.value)}
            >
              {opt.value === 0 ? <InfinityIcon className="mx-auto size-4" /> : opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stacking +2 / +4 Checklist */}
      <label
        className={[
          "flex select-none items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 transition",
          config.stacking
            ? "border-[#5ac92e] bg-[#f4ffe8]"
            : "border-[#d8cfa3] bg-[#fffdf0]",
          isHost ? "cursor-pointer hover:bg-[#fff9dc]" : "cursor-default",
        ].join(" ")}
      >
        <input
          type="checkbox"
          checked={config.stacking}
          disabled={!isHost}
          onChange={(e) => onChange({ stacking: e.target.checked })}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={[
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition",
            config.stacking
              ? "border-[#1e7d75] bg-gradient-to-b from-[#b9f838] to-[#3dbe18] text-white shadow-[0_2px_0_#1e7d75]"
              : "border-[#c8bf94] bg-[#ebe4be] text-transparent",
          ].join(" ")}
        >
          <CheckIcon className="h-4 w-4 stroke-[3.5]" />
        </span>
        <div className="min-w-0">
          <div className="font-display text-sm font-bold text-[#3d2940]">Stacking +2 / +4</div>
          <div className="text-[11px] font-bold text-[#786b51]">
            Tumpuk +2 dengan +2/+4, atau +4 dengan +4 untuk lempar penalti ke lawan berikutnya.
          </div>
        </div>
      </label>
    </div>
  );
}
