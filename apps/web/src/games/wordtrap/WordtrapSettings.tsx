import type { WordtrapConfig } from "@gemoji/game-wordtrap";
import { EyeIcon, EyeOffIcon, InfinityIcon } from "lucide-react";

interface WordtrapSettingsProps {
  config: WordtrapConfig;
  isHost: boolean;
  onChange: (patch: Partial<WordtrapConfig>) => void;
}

const TARGET_POINTS: Array<{ value: WordtrapConfig["targetPoints"]; label: string }> = [
  { value: 2, label: "2 Poin" },
  { value: 3, label: "3 Poin" },
  { value: 5, label: "5 Poin" },
];

const TRAP_LIMITS: Array<{ value: WordtrapConfig["trapLimit"]; label: string }> = [
  { value: 1, label: "1x" },
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
];

const TURN_DURATIONS: Array<{ value: WordtrapConfig["turnDurationSec"]; label: string }> = [
  { value: 0, label: "unlimited" },
  { value: 15, label: "15s" },
  { value: 20, label: "20s" },
  { value: 30, label: "30s" },
];

export function WordtrapSettings({ config, isHost, onChange }: WordtrapSettingsProps) {
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
          Pengaturan Wordtrap
        </span>
        {!isHost && (
          <span className="rounded-full bg-[#dcd3a6] px-2.5 py-0.5 text-[11px] font-extrabold text-[#6b5d44]">
            Diatur Host
          </span>
        )}
      </div>

      {/* Mode Permainan */}
      <div>
        <div className="mb-1.5 text-xs font-extrabold text-[#6e6049]">Mode Permainan</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!isHost}
            onClick={() => onChange({ mode: "reveal" })}
            className={`${pillBtn(config.mode === "reveal")} flex items-center justify-center gap-1.5 py-2`}
          >
            <EyeIcon className="h-4 w-4" />
            Mode Reveal
          </button>
          <button
            type="button"
            disabled={!isHost}
            onClick={() => onChange({ mode: "hidden" })}
            className={`${pillBtn(config.mode === "hidden")} flex items-center justify-center gap-1.5 py-2`}
          >
            <EyeOffIcon className="h-4 w-4" />
            Mode Hidden
          </button>
        </div>
        <p className="mt-1 text-[11px] font-bold text-[#786b51]">
          {config.mode === "reveal"
            ? "Huruf benar langsung muncul di slot kata. Skill Trap memasang huruf palsu di slot kosong!"
            : "Huruf benar hanya ditandai Hijau di keyboard (anagram). Skill Trap menyamarkan huruf jadi Hijau!"}
        </p>
      </div>

      {/* Target Poin */}
      <div>
        <div className="mb-1.5 text-xs font-extrabold text-[#6e6049]">Target Menang</div>
        <div className="grid grid-cols-3 gap-1.5">
          {TARGET_POINTS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={!isHost}
              onClick={() => onChange({ targetPoints: opt.value })}
              className={pillBtn(config.targetPoints === opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Limit Trap */}
      <div>
        <div className="mb-1.5 text-xs font-extrabold text-[#6e6049]">Limit Trap / Ronde</div>
        <div className="grid grid-cols-3 gap-1.5">
          {TRAP_LIMITS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={!isHost}
              onClick={() => onChange({ trapLimit: opt.value })}
              className={pillBtn(config.trapLimit === opt.value)}
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
    </div>
  );
}
