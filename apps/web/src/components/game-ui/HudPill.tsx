import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";

interface HudPillProps {
  icon: ReactNode;
  value: string | number;
  label?: string;
  accent?: "gold" | "pink" | "cyan" | "green";
  onAction?: () => void;
  actionLabel?: string;
}

const ICON_BG = {
  gold: "from-[#ffe152] to-[#f4900c] border-[#fff6b8]",
  pink: "from-[#ff6b8b] to-[#db1f48] border-[#ffc2d1]",
  cyan: "from-[#53ecff] to-[#1199e8] border-[#bdf7ff]",
  green: "from-[#b2f538] to-[#39b516] border-[#e2ffab]",
};

export function HudPill({
  icon,
  value,
  label,
  accent = "gold",
  onAction,
  actionLabel = "Tambah",
}: HudPillProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#d3c99b] bg-[#f4eecb] py-1 pl-1.5 pr-3 shadow-[0_4px_0_rgba(40,68,72,0.28)]">
      <div
        className={[
          "flex h-8 w-8 items-center justify-center rounded-full border-2 bg-gradient-to-b text-white shadow-sm",
          ICON_BG[accent],
        ].join(" ")}
      >
        {icon}
      </div>

      <div className="flex flex-col leading-tight">
        {label && (
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7c7155]">
            {label}
          </span>
        )}
        <span className="font-display text-base font-bold text-[#3f2c40]">{value}</span>
      </div>

      {onAction && (
        <button
          type="button"
          onClick={onAction}
          aria-label={actionLabel}
          className="ml-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-white/80 bg-gradient-to-b from-[#a8f532] to-[#38b816] text-white shadow-[0_2px_0_#1e7513] active:translate-y-0.5"
        >
          <PlusIcon className="h-4 w-4 stroke-[3]" />
        </button>
      )}
    </div>
  );
}
