import type { UndercoverConfig } from "@gemoji/game-undercover";
import { BookOpenIcon, CheckIcon, ClockIcon, EyeIcon, EyeOffIcon, InfinityIcon, MinusIcon, PenLineIcon, PlusIcon } from "lucide-react";

interface UndercoverSettingsProps {
  config: UndercoverConfig;
  isHost: boolean;
  playerCount: number;
  onChange: (patch: Partial<UndercoverConfig>) => void;
}

const VOTE_DURATIONS: Array<{ value: UndercoverConfig["voteDuration"]; label: string }> = [
  { value: 0, label: "unlimited" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
  { value: 120, label: "120s" },
];

const CLUE_DURATIONS: Array<{ value: UndercoverConfig["clueDurationSec"]; label: string }> = [
  { value: 0, label: "Skip" },
  { value: 30, label: "30s" },
  { value: 45, label: "45s" },
  { value: 60, label: "60s" },
];

export function UndercoverSettings({
  config,
  isHost,
  playerCount,
  onChange,
}: UndercoverSettingsProps) {
  const effectivePlayers = Math.max(playerCount, 3);
  const maxInfiltrators = Math.max(1, Math.floor((effectivePlayers - 1) / 2));

  // Hitung estimasi distribusi aktual (sama dengan clamp di server engine)
  let previewUndercover = config.undercoverCount;
  let previewMrBlank = config.mrBlankCount;
  if (previewUndercover + previewMrBlank === 0) previewUndercover = 1;
  while (previewUndercover + previewMrBlank > maxInfiltrators) {
    if (previewMrBlank > 0) previewMrBlank--;
    else if (previewUndercover > 1) previewUndercover--;
    else break;
  }
  const citizenCount = Math.max(1, effectivePlayers - previewUndercover - previewMrBlank);

  const handleDecUndercover = () => {
    if (config.undercoverCount <= 0) return;
    if (config.undercoverCount === 1 && config.mrBlankCount === 0) {
      // Langsung tukar ke mode Citizen + Mr. Blank (tanpa Undercover)
      onChange({ undercoverCount: 0, mrBlankCount: 1 });
      return;
    }
    onChange({ undercoverCount: config.undercoverCount - 1 });
  };

  const handleIncUndercover = () => {
    if (config.undercoverCount + config.mrBlankCount < maxInfiltrators) {
      onChange({ undercoverCount: config.undercoverCount + 1 });
    } else if (config.mrBlankCount > 0) {
      // Tukar 1 slot Mr. Blank menjadi Undercover
      onChange({
        undercoverCount: config.undercoverCount + 1,
        mrBlankCount: config.mrBlankCount - 1,
      });
    }
  };

  const handleDecMrBlank = () => {
    if (config.mrBlankCount <= 0) return;
    if (config.mrBlankCount === 1 && config.undercoverCount === 0) {
      // Langsung tukar ke mode Citizen + Undercover
      onChange({ undercoverCount: 1, mrBlankCount: 0 });
      return;
    }
    onChange({ mrBlankCount: config.mrBlankCount - 1 });
  };

  const handleIncMrBlank = () => {
    if (config.undercoverCount + config.mrBlankCount < maxInfiltrators) {
      onChange({ mrBlankCount: config.mrBlankCount + 1 });
    } else if (config.undercoverCount > 0) {
      // Tukar 1 slot Undercover menjadi Mr. Blank (memungkinkan 0 Undercover di 3-4 pemain)
      onChange({
        undercoverCount: config.undercoverCount - 1,
        mrBlankCount: config.mrBlankCount + 1,
      });
    }
  };

  const pillBtn = (active: boolean) =>
    [
      "font-display rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition",
      active
        ? "border-[#e0326a] bg-[#ffe694] text-[#5c1632] shadow-[0_3px_0_#e0326a]"
        : "border-[#d8cfa3] bg-[#fffdf0] text-[#6a5d48]",
      isHost ? "cursor-pointer hover:bg-[#fff6cc]" : "cursor-default",
    ].join(" ");

  return (
    <div className="space-y-3 rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] p-2">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-bold uppercase tracking-wide text-[#5c1632]">
          Pengaturan Undercover
        </span>
        {!isHost && (
          <span className="rounded-full bg-[#dcd3a6] px-2.5 py-0.5 text-[11px] font-extrabold text-[#6b5d44]">
            Diatur Host
          </span>
        )}
      </div>

      {/* Mode Kata */}
      <div>
        <div className="mb-1.5 text-xs font-extrabold text-[#6e6049]">Mode Kata</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!isHost}
            onClick={() => onChange({ wordMode: "library" })}
            className={`${pillBtn(config.wordMode === "library")} flex items-center justify-center gap-1.5 py-2`}
          >
            <BookOpenIcon className="h-4 w-4" />
            Library
          </button>
          <button
            type="button"
            disabled={!isHost}
            onClick={() => onChange({ wordMode: "custom" })}
            className={`${pillBtn(config.wordMode === "custom")} flex items-center justify-center gap-1.5 py-2`}
          >
            <PenLineIcon className="h-4 w-4" />
            Custom Word
          </button>
        </div>
        <p className="mt-1 text-[11px] font-bold text-[#786b51]">
          {config.wordMode === "custom"
            ? "Tiap pemain menulis 1 pasang kata, lalu diacak sampai semua terpakai."
            : "Server memilih pasangan kata secara acak dari koleksi 110+ kata."}
        </p>
      </div>

      {/* Role Counts: Citizen (otomatis), Undercover (bisa 0), Mr. Blank (bisa 0) */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-extrabold text-[#6e6049]">
          <span>Komposisi Role</span>
          <span className="text-[11px] font-bold text-[#786b51]">
            {playerCount < 3 ? `Estimasi ${effectivePlayers} pemain` : `${playerCount} pemain`}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {/* Citizen (Auto) */}
          <div className="flex flex-col justify-between rounded-xl border-2 border-[#d8cfa3] bg-[#fffdf0] p-2.5 text-center">
            <div className="text-[11px] font-extrabold text-[#1a662b]">Citizen</div>
            <div className="font-display my-1 text-2xl font-bold text-[#144a1f]">
              {citizenCount}
            </div>
            <div className="text-[10px] font-extrabold text-[#3c8749]">Kata Umum</div>
          </div>

          {/* Undercover */}
          <div className="flex flex-col justify-between rounded-xl border-2 border-[#d8cfa3] bg-[#fffdf0] p-2.5">
            <div className="text-center text-[11px] font-extrabold text-[#c72258]">Undercover</div>
            <div className="mt-1.5 -mx-1 sm:mx-0 flex items-center justify-between">
              <button
                type="button"
                disabled={!isHost || config.undercoverCount <= 0}
                onClick={handleDecUndercover}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-2 border-[#d8cfa3] bg-[#ebe4be] text-[#4e3e4d] disabled:opacity-40"
              >
                <MinusIcon className="h-3.5 w-3.5" />
              </button>
              <span className="font-display text-xl font-bold text-[#3d2940]">
                {previewUndercover}
              </span>
              <button
                type="button"
                disabled={
                  !isHost ||
                  (config.undercoverCount + config.mrBlankCount >= maxInfiltrators &&
                    config.mrBlankCount <= 0)
                }
                onClick={handleIncUndercover}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-2 border-[#d8cfa3] bg-[#ebe4be] text-[#4e3e4d] disabled:opacity-40"
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1 text-center text-[10px] font-bold text-[#8a7d63]">
              Kata Mirip
            </div>
          </div>

          {/* Mr. Blank */}
          <div className="flex flex-col justify-between rounded-xl border-2 border-[#d8cfa3] bg-[#fffdf0] p-2.5">
            <div className="text-center text-[11px] font-extrabold text-[#6540bb]">Mr. Blank</div>
            <div className="mt-1.5 -mx-1 sm:mx-0 flex items-center justify-between">
              <button
                type="button"
                disabled={!isHost || config.mrBlankCount <= 0}
                onClick={handleDecMrBlank}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-2 border-[#d8cfa3] bg-[#ebe4be] text-[#4e3e4d] disabled:opacity-40"
              >
                <MinusIcon className="h-3.5 w-3.5" />
              </button>
              <span className="font-display text-xl font-bold text-[#3d2940]">
                {previewMrBlank}
              </span>
              <button
                type="button"
                disabled={
                  !isHost ||
                  (config.undercoverCount + config.mrBlankCount >= maxInfiltrators &&
                    config.undercoverCount <= 0)
                }
                onClick={handleIncMrBlank}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-2 border-[#d8cfa3] bg-[#ebe4be] text-[#4e3e4d] disabled:opacity-40"
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1 text-center text-[10px] font-bold text-[#8a7d63]">Tanpa Kata</div>
          </div>
        </div>
      </div>

      {/* Waktu Vote */}
      <div>
        <div className="mb-1.5 flex items-center gap-1 text-xs font-extrabold text-[#6e6049]">
          Waktu Vote
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {VOTE_DURATIONS.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              disabled={!isHost}
              onClick={() => onChange({ voteDuration: opt.value })}
              className={pillBtn(config.voteDuration === opt.value)}
            >
              {opt.value === 0 ? <InfinityIcon className="size-4 mx-auto" /> : opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode Vote */}
      <div>
        <div className="mb-1.5 text-xs font-extrabold text-[#6e6049]">Mode Vote</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!isHost}
            onClick={() => onChange({ voteMode: "open" })}
            className={`${pillBtn(config.voteMode === "open")} flex items-center justify-center gap-1.5 py-2`}
          >
            <EyeIcon className="h-4 w-4" />
            Terbuka
          </button>
          <button
            type="button"
            disabled={!isHost}
            onClick={() => onChange({ voteMode: "secret" })}
            className={`${pillBtn(config.voteMode === "secret")} flex items-center justify-center gap-1.5 py-2`}
          >
            <EyeOffIcon className="h-4 w-4" />
            Rahasia
          </button>
        </div>
      </div>

      {/* Durasi Clue */}
      <div>
        <div className="mb-1.5 text-xs font-extrabold text-[#6e6049]">Timer Clue</div>
        <div className="grid grid-cols-4 gap-1.5">
          {CLUE_DURATIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={!isHost}
              onClick={() => onChange({ clueDurationSec: opt.value })}
              className={`${pillBtn(config.clueDurationSec === opt.value)} px-1.5`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {config.clueDurationSec === 0 && (
          <p className="mt-1 text-[11px] font-bold text-[#786b51]">
            Mode tatap muka: fase ketik clue dilewati, langsung masuk ke voting.
          </p>
        )}
      </div>

      {/* Blind Role Checklist */}
      <label
        className={[
          "flex items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 transition select-none",
          config.blindRole
            ? "border-[#5ac92e] bg-[#f4ffe8]"
            : "border-[#d8cfa3] bg-[#fffdf0]",
          isHost ? "cursor-pointer hover:bg-[#fff9dc]" : "cursor-default",
        ].join(" ")}
      >
        <input
          type="checkbox"
          checked={config.blindRole}
          disabled={!isHost}
          onChange={(e) => onChange({ blindRole: e.target.checked })}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={[
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition",
            config.blindRole
              ? "border-[#1e7d75] bg-gradient-to-b from-[#b9f838] to-[#3dbe18] text-white shadow-[0_2px_0_#1e7d75]"
              : "border-[#c8bf94] bg-[#ebe4be] text-transparent",
          ].join(" ")}
        >
          <CheckIcon className="h-4 w-4 stroke-[3.5]" />
        </span>
        <div className="min-w-0">
          <div className="font-display text-sm font-bold text-[#3d2940]">Blind Role</div>
          <div className="text-[11px] font-bold text-[#786b51]">
            Citizen &amp; Undercover tidak tahu role-nya di awal.
          </div>
        </div>
      </label>
    </div>
  );
}
