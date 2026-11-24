import { X } from "lucide-react";
import type { ReactNode } from "react";

interface GamePanelProps {
  title?: string;
  ribbonColor?: "pink" | "cyan" | "purple";
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

const RIBBON_THEMES = {
  pink: {
    main: "from-[#f65287] to-[#e0326a]",
    border: "border-[#c72258]",
    wing: "#b82052",
  },
  cyan: {
    main: "from-[#35d9f7] to-[#17a3db]",
    border: "border-[#127fae]",
    wing: "#1175a1",
  },
  purple: {
    main: "from-[#9b6bff] to-[#7442e8]",
    border: "border-[#5429ba]",
    wing: "#4f25b0",
  },
};

export function GamePanel({
  title,
  ribbonColor = "pink",
  onClose,
  children,
  className = "",
}: GamePanelProps) {
  const ribbon = RIBBON_THEMES[ribbonColor];

  return (
    <div
      className={[
        "relative rounded-[28px] border-[4px] border-[#c8bf94] bg-[#f4eecb] shadow-[0_14px_30px_rgba(24,52,58,0.28),inset_0_2px_0_rgba(255,255,255,0.8)]",
        className,
      ].join(" ")}
    >
      {title && (
        <div className="relative -mx-5 mt-5 mb-4 flex items-center justify-center">
          {/* Left folded ribbon wing */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute -left-5 top-2.5 h-12 w-9"
            viewBox="0 0 36 48"
          >
            <polygon points="36,0 0,0 12,24 0,48 36,48" fill={ribbon.wing} />
          </svg>

          {/* Right folded ribbon wing */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute -right-5 top-2.5 h-12 w-9"
            viewBox="0 0 36 48"
          >
            <polygon points="0,0 36,0 24,24 36,48 0,48" fill={ribbon.wing} />
          </svg>

          {/* Main ribbon banner */}
          <div
            className={[
              "relative z-10 flex w-full items-center justify-center rounded-xl border-b-[4px] bg-gradient-to-b px-12 py-2.5 shadow-[0_6px_12px_rgba(72,15,38,0.25)]",
              ribbon.main,
              ribbon.border,
            ].join(" ")}
          >
            <h2 className="font-display game-title-stroke text-center text-2xl font-bold tracking-wide text-white sm:text-3xl">
              {title}
            </h2>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="absolute right-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#6d1839] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.25)] transition hover:scale-105 active:scale-95"
              >
                <X className="h-5 w-5 stroke-[3]" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}
