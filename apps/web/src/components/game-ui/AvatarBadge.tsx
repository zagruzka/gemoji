import { AVATAR_IDS, type AvatarId } from "@gemoji/shared";

interface AvatarMeta {
  emoji: string;
  label: string;
  bg: string;
}

export const AVATAR_MAP: Record<AvatarId, AvatarMeta> = {
  fox: { emoji: "🦊", label: "Rubah", bg: "from-[#ffae42] to-[#e65c19]" },
  cat: { emoji: "🐱", label: "Kucing", bg: "from-[#ffd466] to-[#f2992e]" },
  panda: { emoji: "🐼", label: "Panda", bg: "from-[#eef3f7] to-[#b5c2ce]" },
  frog: { emoji: "🐸", label: "Katak", bg: "from-[#9bf048] to-[#34ad1f]" },
  owl: { emoji: "🦉", label: "Burung Hantu", bg: "from-[#b784f5] to-[#6c3ad1]" },
  bear: { emoji: "🐻", label: "Beruang", bg: "from-[#d49663] to-[#8f5228]" },
  rabbit: { emoji: "🐰", label: "Kelinci", bg: "from-[#ffb5d2] to-[#e6538b]" },
  penguin: { emoji: "🐧", label: "Penguin", bg: "from-[#6be3ff] to-[#1e88d9]" },
  koala: { emoji: "🐨", label: "Koala", bg: "from-[#b8d0dc] to-[#6a8899]" },
  tiger: { emoji: "🐯", label: "Harimau", bg: "from-[#ffc233] to-[#e06d06]" },
  dog: { emoji: "🐶", label: "Anjing", bg: "from-[#f5c78a] to-[#c77d34]" },
  unicorn: { emoji: "🦄", label: "Unicorn", bg: "from-[#ff8ae2] to-[#9847f5]" },
};

interface AvatarBadgeProps {
  avatar: AvatarId;
  size?: "sm" | "md" | "lg";
  dimmed?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: "h-8 w-8 text-base",
  md: "h-11 w-11 text-xl",
  lg: "h-14 w-14 text-3xl",
};

export function AvatarBadge({ avatar, size = "md", dimmed = false, className = "" }: AvatarBadgeProps) {
  const meta = AVATAR_MAP[avatar] ?? AVATAR_MAP.fox;
  return (
    <span
      title={meta.label}
      className={[
        "relative inline-flex shrink-0 select-none items-center justify-center rounded-full border-2 border-white bg-gradient-to-b shadow-[0_3px_0_rgba(40,35,55,0.28)]",
        meta.bg,
        SIZE_MAP[size],
        dimmed ? "grayscale opacity-60" : "",
        className,
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0.5 h-1.5 w-1/2 rounded-full bg-white/40"
      />
      <span className="relative z-10 leading-none">{meta.emoji}</span>
    </span>
  );
}

interface AvatarPickerProps {
  value: AvatarId;
  onChange: (avatar: AvatarId) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {AVATAR_IDS.map((id) => {
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={[
              "flex cursor-pointer items-center justify-center rounded-2xl p-1 transition",
              selected
                ? "scale-105 bg-[#ffe97d] ring-3 ring-[#e0326a]"
                : "bg-[#e9e2bb] hover:bg-[#f9f4d8]",
            ].join(" ")}
          >
            <AvatarBadge avatar={id} size="sm" />
          </button>
        );
      })}
    </div>
  );
}
