import type { ButtonHTMLAttributes, ReactNode } from "react";

export type IconButtonTone = "gold" | "green" | "red" | "cyan" | "pink";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: IconButtonTone;
  badge?: number | string;
  children: ReactNode;
}

const TONE_STYLES: Record<IconButtonTone, string> = {
  gold: "bg-gradient-to-b from-[#ffe259] via-[#ffb829] to-[#f28705] text-white shadow-[0_4px_0_#b55400,0_6px_10px_rgba(0,0,0,0.22)] active:shadow-[0_1px_0_#b55400]",
  green:
    "bg-gradient-to-b from-[#b9f838] via-[#67d81d] to-[#34ad14] text-white shadow-[0_4px_0_#1e7011,0_6px_10px_rgba(0,0,0,0.22)] active:shadow-[0_1px_0_#1e7011]",
  red: "bg-gradient-to-b from-[#ff7a59] via-[#f24634] to-[#cc2119] text-white shadow-[0_4px_0_#8a120d,0_6px_10px_rgba(0,0,0,0.22)] active:shadow-[0_1px_0_#8a120d]",
  cyan: "bg-gradient-to-b from-[#59f0ff] via-[#1dc4f0] to-[#0f95d6] text-white shadow-[0_4px_0_#145b96,0_6px_10px_rgba(0,0,0,0.22)] active:shadow-[0_1px_0_#145b96]",
  pink: "bg-gradient-to-b from-[#ff71a5] via-[#ec3e7b] to-[#c9205b] text-white shadow-[0_4px_0_#85113a,0_6px_10px_rgba(0,0,0,0.22)] active:shadow-[0_1px_0_#85113a]",
};

export function IconButton({
  tone = "gold",
  badge,
  className = "",
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={[
        "relative inline-flex h-11 w-11 cursor-pointer select-none items-center justify-center rounded-full border-2 border-white/85 transition-transform duration-100 active:translate-y-[3px]",
        TONE_STYLES[tone],
        className,
      ].join(" ")}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1 h-2 w-5 rounded-full bg-white/40"
      />
      <span className="relative z-10 drop-shadow-[0_1.5px_0_rgba(0,0,0,0.35)]">{children}</span>
      {badge !== undefined && badge !== 0 && (
        <span className="font-display absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#e62958] px-1 text-[11px] font-bold leading-4 text-white shadow">
          {badge}
        </span>
      )}
    </button>
  );
}
