import type { SpaceteamConfig } from "@gemoji/game-spaceteam";

interface SpaceteamSettingsProps {
  config: SpaceteamConfig;
  isHost: boolean;
  onChange: (patch: Partial<SpaceteamConfig>) => void;
}

const DIFFICULTIES: Array<{
  value: SpaceteamConfig["difficulty"];
  label: string;
  desc: string;
}> = [
  {
    value: "practice",
    label: "Latihan",
    desc: "Tanpa timer instruksi, cocok untuk belajar membaca panel dan komunikasi kru.",
  },
  { value: "relaxed", label: "Santai", desc: "Waktu +25% lebih longgar untuk adaptasi kru baru." },
  { value: "normal", label: "Normal", desc: "Kecepatan standar sesuai jumlah pemain dan sektor." },
  { value: "panic", label: "Panik", desc: "Waktu -15% lebih cepat untuk tantangan ekstra kacau!" },
];

const SECTOR_OPTIONS: Array<{ value: SpaceteamConfig["totalSectors"]; label: string }> = [
  { value: 3, label: "3 Sektor (Cepat)" },
  { value: 5, label: "5 Sektor (Standar)" },
];

export function SpaceteamSettings({ config, isHost, onChange }: SpaceteamSettingsProps) {
  const pillBtn = (active: boolean) =>
    [
      "font-display rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition",
      active
        ? "border-[#e0326a] bg-[#ffe694] text-[#5c1632] shadow-[0_3px_0_#e0326a]"
        : "border-[#d8cfa3] bg-[#fffdf0] text-[#6a5d48]",
      isHost ? "cursor-pointer hover:bg-[#fff6cc]" : "cursor-default",
    ].join(" ");

  const activeDiff =
    DIFFICULTIES.find((d) => d.value === config.difficulty) ?? DIFFICULTIES[2]!;

  return (
    <div className="space-y-3 rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] p-2.5">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-bold uppercase tracking-wide text-[#5c1632]">
          Pengaturan Spaceteam
        </span>
        {!isHost && (
          <span className="rounded-full bg-[#dcd3a6] px-2.5 py-0.5 text-[11px] font-extrabold text-[#6b5d44]">
            Diatur Host
          </span>
        )}
      </div>

      {/* Tingkat Kesulitan */}
      <div>
        <div className="mb-1.5 text-xs font-extrabold text-[#6e6049]">Tingkat Kesulitan</div>
        <div className="grid grid-cols-4 gap-1.5">
          {DIFFICULTIES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={!isHost}
              onClick={() => onChange({ difficulty: opt.value })}
              className={`${pillBtn(config.difficulty === opt.value)} px-1.5`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] font-bold text-[#786b51]">{activeDiff.desc}</p>
      </div>

      {/* Jumlah Sektor */}
      <div>
        <div className="mb-1.5 text-xs font-extrabold text-[#6e6049]">Jumlah Sektor</div>
        <div className="grid grid-cols-2 gap-2">
          {SECTOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={!isHost}
              onClick={() => onChange({ totalSectors: opt.value })}
              className={pillBtn(config.totalSectors === opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
