import {
  PARAMETER_LABELS,
  type BlinkingPattern,
  type CompassDirection,
  type ParameterState,
  type SignalLampColor,
  type SymbolShapeKind,
  type SymbolShapeVariant,
} from "@gemoji/game-spaceteam";
import { CompassIcon, FlameIcon, GaugeIcon, RadioIcon, WindIcon } from "lucide-react";
import { useEffect, useState } from "react";

const LAMP_STYLES: Record<
  SignalLampColor,
  { fill: string; ring: string; glow: string; badgeText: string }
> = {
  BIRU: {
    fill: "bg-[#2ea8ff]",
    ring: "border-[#9ad8ff]",
    glow: "shadow-[0_0_16px_rgba(46,168,255,0.85)]",
    badgeText: "text-[#8fd3ff]",
  },
  KUNING: {
    fill: "bg-[#ffe047]",
    ring: "border-[#fff5b0]",
    glow: "shadow-[0_0_16px_rgba(255,224,71,0.85)]",
    badgeText: "text-[#ffe770]",
  },
  MERAH: {
    fill: "bg-[#ff3b52]",
    ring: "border-[#ff9aa6]",
    glow: "shadow-[0_0_16px_rgba(255,59,82,0.85)]",
    badgeText: "text-[#ff8f9c]",
  },
  HIJAU: {
    fill: "bg-[#38e06c]",
    ring: "border-[#9ff7b9]",
    glow: "shadow-[0_0_16px_rgba(56,224,108,0.85)]",
    badgeText: "text-[#7ef2a1]",
  },
  HITAM: {
    fill: "bg-[#090d16]",
    ring: "border-slate-300",
    glow: "shadow-[0_0_10px_rgba(226,232,240,0.45)]",
    badgeText: "text-slate-300",
  },
  PUTIH: {
    fill: "bg-white",
    ring: "border-slate-400",
    glow: "shadow-[0_0_18px_rgba(255,255,255,0.9)]",
    badgeText: "text-white",
  },
  UNGU: {
    fill: "bg-[#b06bff]",
    ring: "border-[#dcbaff]",
    glow: "shadow-[0_0_16px_rgba(176,107,255,0.85)]",
    badgeText: "text-[#d4abff]",
  },
};

const COMPASS_ANGLE: Record<CompassDirection, number> = {
  UTARA: 0,
  "TIMUR LAUT": 45,
  TIMUR: 90,
  TENGGARA: 135,
  SELATAN: 180,
  "BARAT DAYA": 225,
  BARAT: 270,
  "BARAT LAUT": 315,
};

function BlinkingLightVisual({ pattern }: { pattern: BlinkingPattern }) {
  const [lit, setLit] = useState(pattern === "ALWAYS_ON");

  useEffect(() => {
    if (pattern === "ALWAYS_ON") {
      setLit(true);
      return;
    }
    if (pattern === "ALWAYS_OFF") {
      setLit(false);
      return;
    }

    // Pola kedip N kali: 280ms nyala, 220ms mati, lalu 850ms jeda sebelum berulang
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let cancelled = false;

    const runCycle = () => {
      if (cancelled) return;
      let offset = 0;
      for (let i = 0; i < pattern; i++) {
        timers.push(
          setTimeout(() => {
            if (!cancelled) setLit(true);
          }, offset),
        );
        offset += 280;
        timers.push(
          setTimeout(() => {
            if (!cancelled) setLit(false);
          }, offset),
        );
        offset += 220;
      }
      timers.push(
        setTimeout(() => {
          if (!cancelled) runCycle();
        }, offset + 850),
      );
    };

    runCycle();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [pattern]);

  return (
    <div className="flex items-center gap-3">
      <span
        className={[
          "h-7 w-7 rounded-full border-2 transition-all duration-75",
          lit
            ? "border-[#fff5a8] bg-[#ffe047] shadow-[0_0_18px_rgba(255,224,71,0.95)]"
            : "border-slate-600 bg-[#1a243d]",
        ].join(" ")}
      />
      <span className="font-mono text-xs font-bold tracking-wide text-slate-300">
        {lit ? "ON" : "OFF"}
      </span>
    </div>
  );
}

function ShapeSvg({ shape, variant }: { shape: SymbolShapeKind; variant: SymbolShapeVariant }) {
  const isSolid = variant === "SOLID";
  const fill = isSolid ? "#38e8ff" : "none";
  const stroke = "#38e8ff";

  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8 drop-shadow-[0_0_8px_rgba(56,232,255,0.55)]">
      {shape === "BULAT" && (
        <circle cx="20" cy="20" r="13" fill={fill} stroke={stroke} strokeWidth="3.5" />
      )}
      {shape === "KOTAK" && (
        <rect
          x="7"
          y="7"
          width="26"
          height="26"
          rx="3"
          fill={fill}
          stroke={stroke}
          strokeWidth="3.5"
        />
      )}
      {shape === "SEGITIGA" && (
        <polygon
          points="20,5 35,33 5,33"
          fill={fill}
          stroke={stroke}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
      )}
      {shape === "BINTANG" && (
        <polygon
          points="20,4 24.8,14 36,15.5 27.8,23.2 29.8,34.4 20,29 10.2,34.4 12.2,23.2 4,15.5 15.2,14"
          fill={fill}
          stroke={stroke}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      )}
      {shape === "HATI" && (
        <path
          d="M20 34 C19 33 6 24.5 6 15 C6 9.8 10 6.5 14.2 6.5 C17 6.5 19 8.2 20 10.2 C21 8.2 23 6.5 25.8 6.5 C30 6.5 34 9.8 34 15 C34 24.5 21 33 20 34 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function AnalogClockSvg({ hour }: { hour: number }) {
  const angleDeg = (hour % 12) * 30;
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10">
      <circle cx="24" cy="24" r="21" fill="#091124" stroke="#47669e" strokeWidth="2.5" />
      {/* 12 hour dots */}
      {Array.from({ length: 12 }, (_, idx) => {
        const rad = ((idx * 30 - 90) * Math.PI) / 180;
        const x = 24 + Math.cos(rad) * 16.5;
        const y = 24 + Math.sin(rad) * 16.5;
        const major = idx % 3 === 0;
        return (
          <circle
            key={idx}
            cx={x}
            cy={y}
            r={major ? 1.8 : 1}
            fill={major ? "#e2e8f0" : "#64748b"}
          />
        );
      })}
      {/* Minute hand fixed at 12 */}
      <line
        x1="24"
        y1="24"
        x2="24"
        y2="9"
        stroke="#94a3b8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Hour hand */}
      <g transform={`rotate(${angleDeg} 24 24)`}>
        <line
          x1="24"
          y1="24"
          x2="24"
          y2="13"
          stroke="#ffe047"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </g>
      <circle cx="24" cy="24" r="2.5" fill="#ffe047" />
    </svg>
  );
}

interface ParameterStripProps {
  parameter: ParameterState | null;
}

export function ParameterStrip({ parameter }: ParameterStripProps) {
  if (!parameter) return null;
  const label = PARAMETER_LABELS[parameter.type];

  return (
    <div className="flex min-h-[54px] items-center justify-between gap-3 rounded-2xl border-2 border-[#253b68] bg-[#0d1730] px-3.5 py-2 shadow-inner">
      <div className="min-w-0">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300/80">
          Status Panel
        </div>
        <div className="font-display truncate text-sm font-bold text-slate-100">{label}</div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {parameter.type === "SIGNAL_LAMP" && (() => {
          const style = LAMP_STYLES[parameter.value];
          return (
            <div className="flex items-center gap-2.5">
              <span
                className={`h-7 w-7 rounded-full border-2 ${style.fill} ${style.ring} ${style.glow}`}
              />
              <span className={`font-display text-sm font-bold ${style.badgeText}`}>
                {parameter.value}
              </span>
            </div>
          );
        })()}

        {parameter.type === "CORE_TEMP" && (
          <div className="flex items-center gap-2">
            <FlameIcon
              className={[
                "h-5 w-5",
                parameter.value > 70
                  ? "text-rose-400"
                  : parameter.value >= 40
                    ? "text-amber-300"
                    : "text-cyan-300",
              ].join(" ")}
            />
            <span className="font-display rounded-lg border border-[#314b80] bg-[#080f21] px-2.5 py-0.5 text-lg font-bold tabular-nums text-white">
              {parameter.value}°C
            </span>
          </div>
        )}

        {parameter.type === "POWER_MODE" && (
          <span
            className={[
              "font-display inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1 text-xs font-bold tracking-wider",
              parameter.value === "ECO"
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                : parameter.value === "TURBO"
                  ? "border-amber-400 bg-amber-500/20 text-amber-200"
                  : "border-rose-400 bg-rose-500/25 text-rose-200",
            ].join(" ")}
          >
            <GaugeIcon className="h-4 w-4" />
            {parameter.value}
          </span>
        )}

        {parameter.type === "COMPASS" && (
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#3c5991] bg-[#080f21]">
              <CompassIcon className="pointer-events-none absolute h-7 w-7 text-slate-700/60" />
              <span
                style={{ transform: `rotate(${COMPASS_ANGLE[parameter.value]}deg)` }}
                className="relative z-10 flex h-7 w-7 items-center justify-center transition-transform duration-300"
              >
                <span className="h-0 w-0 -translate-y-1 border-x-[5px] border-b-[11px] border-x-transparent border-b-[#ff4f7b]" />
              </span>
            </div>
            <span className="font-display text-xs font-bold tracking-wide text-cyan-200">
              {parameter.value}
            </span>
          </div>
        )}

        {parameter.type === "SYMBOL_SHAPE" && (
          <div className="flex items-center gap-2.5">
            <ShapeSvg shape={parameter.value.shape} variant={parameter.value.variant} />
            <div className="text-right">
              <div className="font-display text-xs font-bold text-white">
                {parameter.value.shape}
              </div>
              <div className="text-[10px] font-extrabold tracking-wider text-cyan-300">
                {parameter.value.variant}
              </div>
            </div>
          </div>
        )}

        {parameter.type === "BATTERY_BARS" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border-2 border-slate-500 bg-[#080f21] p-1">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <span
                  key={lvl}
                  className={[
                    "h-4 w-2.5 rounded-[3px]",
                    lvl <= parameter.value
                      ? parameter.value <= 2
                        ? "bg-rose-400"
                        : parameter.value <= 3
                          ? "bg-amber-300"
                          : "bg-emerald-400"
                      : "bg-slate-800",
                  ].join(" ")}
                />
              ))}
            </div>
            <span className="font-display text-sm font-bold text-white">{parameter.value}/5</span>
          </div>
        )}

        {parameter.type === "SIGNAL_BARS" && (
          <div className="flex items-center gap-2">
            <RadioIcon className="h-4 w-4 text-cyan-300" />
            <div className="flex items-end gap-1">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <span
                  key={lvl}
                  style={{ height: `${6 + lvl * 3.5}px` }}
                  className={[
                    "w-2 rounded-t-[2px]",
                    lvl <= parameter.value ? "bg-cyan-400" : "bg-slate-800",
                  ].join(" ")}
                />
              ))}
            </div>
            <span className="font-display text-sm font-bold text-white">{parameter.value}/5</span>
          </div>
        )}

        {parameter.type === "OXYGEN_PERCENTAGE" && (
          <div className="flex items-center gap-2">
            <WindIcon className="h-4 w-4 text-sky-300" />
            <div className="h-3 w-20 overflow-hidden rounded-full border border-[#314b80] bg-[#080f21]">
              <div
                style={{ width: `${parameter.value}%` }}
                className={[
                  "h-full transition-all",
                  parameter.value <= 33
                    ? "bg-rose-500"
                    : parameter.value <= 66
                      ? "bg-amber-400"
                      : "bg-sky-400",
                ].join(" ")}
              />
            </div>
            <span className="font-display text-sm font-bold tabular-nums text-white">
              {parameter.value}%
            </span>
          </div>
        )}

        {parameter.type === "BLINKING_LIGHTS" && (
          <BlinkingLightVisual pattern={parameter.value} />
        )}

        {parameter.type === "CLOCK" && (
          <div className="flex items-center gap-2">
            <AnalogClockSvg hour={parameter.value} />
            <span className="font-display text-sm font-bold tabular-nums text-amber-300">
              {parameter.value}:00
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
