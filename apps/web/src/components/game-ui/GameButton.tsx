import type { ButtonHTMLAttributes, ReactNode } from "react";

export type GameButtonVariant = "yellow" | "cyan" | "green" | "white" | "pink";
export type GameButtonSize = "sm" | "md" | "lg";

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANT_STYLES: Record<GameButtonVariant, string> = {
  yellow:
    "bg-gradient-to-b from-[#fff05a] via-[#ffd42e] to-[#ffae19] text-[#5c1632] border-[#fff8a6] shadow-[0_6px_0_#c9386b,0_10px_16px_rgba(74,17,41,0.3)] hover:brightness-105 active:shadow-[0_2px_0_#c9386b,0_4px_8px_rgba(74,17,41,0.25)]",
  cyan:
    "bg-gradient-to-b from-[#55f5ff] via-[#1bd4fb] to-[#0ca9ec] text-[#1c2358] border-[#aefbff] shadow-[0_6px_0_#6540bb,0_10px_16px_rgba(32,24,84,0.3)] hover:brightness-105 active:shadow-[0_2px_0_#6540bb,0_4px_8px_rgba(32,24,84,0.25)]",
  green:
    "bg-gradient-to-b from-[#c0ff3e] via-[#7ae622] to-[#3dbe18] text-[#154524] border-[#e2ff99] shadow-[0_6px_0_#1e7d75,0_10px_16px_rgba(14,68,58,0.28)] hover:brightness-105 active:shadow-[0_2px_0_#1e7d75,0_4px_8px_rgba(14,68,58,0.22)]",
  white:
    "bg-gradient-to-b from-[#ffffff] via-[#f1f5f8] to-[#d9e1e7] text-[#3a424c] border-white shadow-[0_6px_0_#8894a0,0_10px_16px_rgba(35,44,54,0.22)] hover:brightness-102 active:shadow-[0_2px_0_#8894a0,0_4px_8px_rgba(35,44,54,0.18)]",
  pink:
    "bg-gradient-to-b from-[#ff72a0] via-[#ee3e79] to-[#d4245f] text-white border-[#ffb4ce] shadow-[0_6px_0_#8f143e,0_10px_16px_rgba(92,10,38,0.32)] hover:brightness-105 active:shadow-[0_2px_0_#8f143e,0_4px_8px_rgba(92,10,38,0.24)]",
};

const SIZE_STYLES: Record<GameButtonSize, string> = {
  sm: "px-4 py-2 text-base rounded-xl",
  md: "px-6 py-3 text-xl rounded-2xl",
  lg: "px-7 py-3.5 text-2xl rounded-2xl",
};

export function GameButton({
  variant = "yellow",
  size = "md",
  fullWidth = false,
  className = "",
  disabled,
  children,
  ...props
}: GameButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        "font-display relative inline-flex select-none items-center justify-center gap-2 border-t-2 font-bold tracking-wide transition-transform duration-100",
        "active:translate-y-[4px] disabled:pointer-events-none disabled:opacity-55 cursor-pointer",
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {/* Top glossy highlight strip */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 top-1 h-2 rounded-full bg-white/45"
      />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
}
