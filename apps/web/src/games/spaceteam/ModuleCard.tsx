import {
  SELECTOR_LEVELS,
  type ControlModule,
  type ModuleSubmitValue,
  type SelectorLevel,
  type ToggleValue,
} from "@gemoji/game-spaceteam";
import { CheckIcon, MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface ModuleCardProps {
  module: ControlModule;
  disabled: boolean;
  compact: boolean;
  onConfirm: (moduleId: string, value: ModuleSubmitValue) => void;
}

const EMPTY_TOGGLE: ToggleValue = [false, false, false, false, false];
const CODE_DIGITS = ["1", "2", "3", "4"] as const;

export function ModuleCard({ module, disabled, compact, onConfirm }: ModuleCardProps) {
  const [codeDraft, setCodeDraft] = useState("");
  const [toggleDraft, setToggleDraft] = useState<ToggleValue>([...EMPTY_TOGGLE]);
  const [sliderDraft, setSliderDraft] = useState<number>(0);
  const [selectorDraft, setSelectorDraft] = useState<SelectorLevel | null>(null);

  // Reset draft saat modul berganti (naik sektor / game baru)
  useEffect(() => {
    setCodeDraft("");
    setToggleDraft([...EMPTY_TOGGLE]);
    setSliderDraft(0);
    setSelectorDraft(null);
  }, [module.id]);

  const handleDigitPress = (digit: string) => {
    if (disabled || codeDraft.length >= 4) return;
    const nextCode = codeDraft + digit;
    if (nextCode.length === 4) {
      onConfirm(module.id, nextCode);
      setCodeDraft("");
    } else {
      setCodeDraft(nextCode);
    }
  };

  const handleConfirm = () => {
    if (disabled) return;
    if (module.type === "TOGGLE") {
      if (!toggleDraft.some(Boolean)) return;
      onConfirm(module.id, toggleDraft);
      setToggleDraft([...EMPTY_TOGGLE]);
    } else if (module.type === "SLIDER") {
      if (sliderDraft < 1) return;
      onConfirm(module.id, sliderDraft);
      setSliderDraft(0);
    } else if (module.type === "SELECTOR") {
      if (selectorDraft === null) return;
      onConfirm(module.id, selectorDraft);
      setSelectorDraft(null);
    }
  };

  const canConfirm =
    !disabled &&
    (module.type === "TOGGLE"
      ? toggleDraft.some(Boolean)
      : module.type === "SLIDER"
        ? sliderDraft > 0
        : module.type === "SELECTOR"
          ? selectorDraft !== null
          : false);

  return (
    <div
      className={[
        "flex flex-col justify-between rounded-2xl border-2 border-[#253c6b] bg-gradient-to-b from-[#132040] to-[#0d162e] shadow-[0_4px_0_#070c1b]",
        compact ? "gap-1.5 p-2" : "gap-2 p-2.5",
      ].join(" ")}
    >
      {/* Header: Nama Modul (+ Reset sejajar judul untuk BUTTON) */}
      <div className="flex items-center justify-between gap-1.5">
        <span className="font-display truncate text-xs font-bold leading-tight text-slate-100">
          {module.name}
        </span>
        {module.type === "BUTTON" && (
          <button
            type="button"
            title="Reset kode"
            disabled={disabled || codeDraft.length === 0}
            onClick={() => setCodeDraft("")}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#314a7d] bg-[#0b1328] text-slate-300 transition hover:bg-[#19284f] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <RotateCcwIcon className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Body Kontrol sesuai Tipe Modul */}
      {module.type === "BUTTON" && (
        <div className="space-y-1.5">
          {/* 4-Digit Code Display (lebar penuh sejajar 4 tombol angka) */}
          <div className="grid grid-cols-4 gap-1">
            {[0, 1, 2, 3].map((slotIdx) => {
              const digit = codeDraft[slotIdx];
              return (
                <div
                  key={slotIdx}
                  className={[
                    "font-display flex items-center justify-center rounded-xl border-2 text-sm font-bold tabular-nums",
                    compact ? "py-1.5" : "py-2",
                    digit
                      ? "border-cyan-400 bg-cyan-500/20 text-[#ffe047]"
                      : "border-[#2a406e] bg-[#080f21] text-slate-600",
                  ].join(" ")}
                >
                  {digit ?? "•"}
                </div>
              );
            })}
          </div>

          {/* 4 Numeric Code Buttons (ukuran identik dengan 4 slot entry, auto-submit pada digit ke-4) */}
          <div className="grid grid-cols-4 gap-1">
            {CODE_DIGITS.map((digit) => (
              <button
                key={digit}
                type="button"
                disabled={disabled}
                onClick={() => handleDigitPress(digit)}
                className={[
                  "font-display cursor-pointer rounded-xl border-2 border-[#ff8eb0] bg-gradient-to-b from-[#f65287] to-[#c72258] text-sm font-bold text-white shadow-[0_3px_0_#7d1136] transition hover:brightness-110 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45",
                  compact ? "py-1.5" : "py-2",
                ].join(" ")}
              >
                {digit}
              </button>
            ))}
          </div>
        </div>
      )}

      {module.type === "TOGGLE" && (
        <div className="grid grid-cols-5 gap-1">
          {toggleDraft.map((isOn, idx) => (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() =>
                setToggleDraft((prev) => {
                  const next = [...prev] as ToggleValue;
                  next[idx] = !next[idx];
                  return next;
                })
              }
              className={[
                "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
                compact ? "py-1.5" : "py-2",
                isOn
                  ? "border-emerald-300 bg-emerald-500/25 text-emerald-200 shadow-[0_0_8px_rgba(52,211,153,0.35)]"
                  : "border-slate-700 bg-[#091021] text-slate-500",
              ].join(" ")}
            >
              <span
                className={[
                  "h-2 w-2 rounded-full",
                  isOn ? "bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.9)]" : "bg-slate-700",
                ].join(" ")}
              />
              <span className="font-display text-[9px] font-bold leading-none">
                {isOn ? "ON" : "OFF"}
              </span>
            </button>
          ))}
        </div>
      )}

      {module.type === "SLIDER" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              disabled={disabled || sliderDraft <= 0}
              onClick={() => setSliderDraft((v) => Math.max(0, v - 1))}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-[#314b80] bg-[#091124] text-cyan-200 hover:bg-[#19284f] disabled:opacity-35"
            >
              <MinusIcon className="h-3 w-3" />
            </button>
            <span
              className={[
                "font-display text-sm font-bold tabular-nums",
                sliderDraft === 0 ? "text-slate-500" : "text-[#ffe047]",
              ].join(" ")}
            >
              LVL {sliderDraft}
            </span>
            <button
              type="button"
              disabled={disabled || sliderDraft >= 10}
              onClick={() => setSliderDraft((v) => Math.min(10, v + 1))}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-[#314b80] bg-[#091124] text-cyan-200 hover:bg-[#19284f] disabled:opacity-35"
            >
              <PlusIcon className="h-3 w-3" />
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            disabled={disabled}
            value={sliderDraft}
            onChange={(e) => setSliderDraft(Number(e.target.value))}
            className="h-2 w-full cursor-pointer accent-[#38d9f5] disabled:cursor-not-allowed"
          />
        </div>
      )}

      {module.type === "SELECTOR" && (
        <div className="grid grid-cols-3 gap-1">
          {SELECTOR_LEVELS.map((lvl) => {
            const active = selectorDraft === lvl;
            return (
              <button
                key={lvl}
                type="button"
                disabled={disabled}
                onClick={() => setSelectorDraft(lvl)}
                className={[
                  "font-display cursor-pointer rounded-xl border-2 text-[11px] font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
                  compact ? "py-1.5" : "py-2",
                  active
                    ? "border-[#ffe047] bg-[#ffe047]/20 text-[#ffe047] shadow-[0_0_8px_rgba(255,224,71,0.3)]"
                    : "border-slate-700 bg-[#091021] text-slate-400 hover:border-slate-500",
                ].join(" ")}
              >
                {lvl}
              </button>
            );
          })}
        </div>
      )}

      {/* Tombol OK Besar di Bawah (untuk TOGGLE, SLIDER, SELECTOR; BUTTON auto-submit 4 kode) */}
      {module.type !== "BUTTON" && (
        <button
          type="button"
          disabled={!canConfirm}
          onClick={handleConfirm}
          className={[
            "font-display flex w-full items-center justify-center gap-1 rounded-xl border-2 text-xs font-bold tracking-wider transition",
            compact ? "py-1.5" : "py-2",
            canConfirm
              ? "cursor-pointer border-[#7df79a] bg-gradient-to-b from-[#3de06b] to-[#199e44] text-white shadow-[0_3px_0_#0e5c26] hover:brightness-110 active:translate-y-0.5"
              : "cursor-not-allowed border-slate-700 bg-slate-800/80 text-slate-500",
          ].join(" ")}
        >
          <CheckIcon className="h-3.5 w-3.5 stroke-[3]" />
          OK
        </button>
      )}
    </div>
  );
}
