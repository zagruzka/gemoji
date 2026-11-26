import {
  SECTOR_PREP_DURATION_MS,
  type ModuleSubmitValue,
  type SpaceteamPlayerView,
} from "@gemoji/game-spaceteam";
import {
  AlertTriangleIcon,
  AwardIcon,
  CheckIcon,
  PlayIcon,
  RocketIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TrophyIcon,
} from "lucide-react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AvatarBadge, GameButton, GamePanel } from "../../components/game-ui";
import { ModuleCard } from "./ModuleCard";
import { ParameterStrip } from "./ParameterStrip";

interface SpaceteamBoardProps {
  view: SpaceteamPlayerView;
  isHost: boolean;
  onlineById?: Record<string, boolean>;
  onAction: (actionType: string, data: unknown) => void;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
}

export function SpaceteamBoard({
  view,
  isHost,
  onlineById,
  onAction,
  onPlayAgain,
  onReturnLobby,
}: SpaceteamBoardProps) {
  // Sinkronisasi jam client vs server hanya saat menerima snapshot baru dari server
  const clockOffsetRef = useRef<number>(Date.now() - view.serverNow);
  useEffect(() => {
    clockOffsetRef.current = Date.now() - view.serverNow;
  }, [view.serverNow]);

  const [barRatio, setBarRatio] = useState(1);
  const [transitionSec, setTransitionSec] = useState(0);
  const [damageFlash, setDamageFlash] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);

  const [cockpitScope, animateCockpit] = useAnimate();
  const lastDamageRef = useRef<number | null>(view.lastHullDamageAt);
  const lastSuccessRef = useRef<number | null>(view.me.lastSuccessAt);

  // Trigger kilat merah global, efek getar kokpit, dan haptic vibration tiap Hull berkurang
  useEffect(() => {
    if (view.lastHullDamageAt && view.lastHullDamageAt !== lastDamageRef.current) {
      lastDamageRef.current = view.lastHullDamageAt;
      setDamageFlash(true);

      if (cockpitScope.current) {
        animateCockpit(
          cockpitScope.current,
          { x: [0, -7, 7, -5, 5, -3, 3, 0], y: [0, 3, -3, 2, -2, 0] },
          { duration: 0.36, ease: "easeOut" },
        );
      }

      try {
        navigator.vibrate?.([70, 35, 90]);
      } catch {
        // Ignore unsupported vibration API
      }

      const t = setTimeout(() => setDamageFlash(false), 380);
      return () => clearTimeout(t);
    }
  }, [view.lastHullDamageAt, animateCockpit, cockpitScope]);

  // Trigger kilat hijau pada Panel 1 & Panel 3 tiap aksi kita sukses
  useEffect(() => {
    if (view.me.lastSuccessAt && view.me.lastSuccessAt !== lastSuccessRef.current) {
      lastSuccessRef.current = view.me.lastSuccessAt;
      setSuccessFlash(true);
      const t = setTimeout(() => setSuccessFlash(false), 420);
      return () => clearTimeout(t);
    }
  }, [view.me.lastSuccessAt]);

  // Loop animasi countdown progress bar 60fps untuk Panel 1 & transisi fase
  const activeInstr = view.me.activeInstruction;
  const activeInstrId = activeInstr?.id ?? null;
  const activeInstrExpiresAt = activeInstr?.expiresAt ?? null;
  const activeInstrDurationMs = activeInstr?.durationMs ?? 0;

  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      const approxServerNow = Date.now() - clockOffsetRef.current;

      if (view.phase === "PLAYING" && activeInstrId !== null) {
        if (activeInstrExpiresAt === null) {
          setBarRatio(1);
        } else {
          const rem = Math.max(0, activeInstrExpiresAt - approxServerNow);
          const ratio =
            activeInstrDurationMs > 0 ? Math.min(1, rem / activeInstrDurationMs) : 0;
          setBarRatio(ratio);
        }
      } else if (view.phase === "SECTOR_PREP" && view.phaseTransitionEndsAt) {
        const rem = Math.max(0, view.phaseTransitionEndsAt - approxServerNow);
        setBarRatio(Math.min(1, rem / SECTOR_PREP_DURATION_MS));
        setTransitionSec(Math.max(1, Math.ceil(rem / 1000)));
      } else {
        setBarRatio(0);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    view.phase,
    view.phaseTransitionEndsAt,
    activeInstrId,
    activeInstrExpiresAt,
    activeInstrDurationMs,
  ]);

  const playerById = new Map(view.players.map((p) => [p.id, p]));

  /* 1. FASE GAME OVER (POST-GAME SUMMARY) */
  if (view.phase === "GAME_OVER" && view.summary) {
    const summary = view.summary;
    const mvp = summary.mvpPlayerId ? playerById.get(summary.mvpPlayerId) : null;
    const culprit = summary.culpritPlayerId ? playerById.get(summary.culpritPlayerId) : null;
    const sortedPlayers = [...view.players].sort(
      (a, b) => b.correctCount - a.correctCount || a.wrongCount - b.wrongCount,
    );

    return (
      <div className="mx-auto w-full max-w-xl">
        <GamePanel
          title={summary.victory ? "Misi Berhasil!" : "Pesawat Hancur!"}
          ribbonColor={summary.victory ? "cyan" : "pink"}
        >
          <div className="mb-4 text-center">
            <div
              className={[
                "mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white text-white shadow-lg",
                summary.victory
                  ? "bg-gradient-to-b from-[#ffe259] to-[#f4900c]"
                  : "bg-gradient-to-b from-[#ff6b8b] to-[#c72258]",
              ].join(" ")}
            >
              {summary.victory ? (
                <TrophyIcon className="h-9 w-9" />
              ) : (
                <ShieldAlertIcon className="h-9 w-9" />
              )}
            </div>
            <p className="text-sm font-extrabold text-[#5c1632]">{view.winner?.reason}</p>
          </div>

          {/* Ringkasan Misi */}
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffdf0] p-2.5">
              <div className="text-[10px] font-extrabold uppercase text-[#786b51]">Sektor</div>
              <div className="font-display text-xl font-bold text-[#3d2940]">
                {summary.sectorsCleared}/{summary.totalSectors}
              </div>
            </div>
            <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffdf0] p-2.5">
              <div className="text-[10px] font-extrabold uppercase text-[#786b51]">Instruksi</div>
              <div className="font-display text-xl font-bold text-[#1a662b]">
                {summary.totalCompleted}
              </div>
            </div>
            <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffdf0] p-2.5">
              <div className="text-[10px] font-extrabold uppercase text-[#786b51]">Sisa Hull</div>
              <div className="font-display text-xl font-bold text-[#c72258]">
                {summary.hullRemaining} HP
              </div>
            </div>
          </div>

          {/* MVP & Culprit */}
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2.5 rounded-2xl border-2 border-[#f0b429] bg-[#fff9dc] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ffe047] text-[#5c1632]">
                <AwardIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9c6500]">
                  MVP Kru
                </div>
                <div className="truncate text-sm font-extrabold text-[#3d2940]">
                  {mvp ? `${mvp.nickname} (${mvp.correctCount} benar)` : "Belum ada"}
                </div>
              </div>
            </div>

            <div
              className={[
                "flex items-center gap-2.5 rounded-2xl border-2 p-3",
                culprit
                  ? "border-[#f26b99] bg-[#ffe8f0]"
                  : "border-[#78d465] bg-[#ecffd9]",
              ].join(" ")}
            >
              <div
                className={[
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  culprit ? "bg-[#ff6b8b] text-white" : "bg-[#4fc924] text-white",
                ].join(" ")}
              >
                {culprit ? (
                  <AlertTriangleIcon className="h-5 w-5" />
                ) : (
                  <SparklesIcon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <div
                  className={[
                    "text-[10px] font-extrabold uppercase tracking-wider",
                    culprit ? "text-[#9b1342]" : "text-[#1a662b]",
                  ].join(" ")}
                >
                  {culprit ? "Biang Kerok" : "Kru Sempurna"}
                </div>
                <div className="truncate text-sm font-extrabold text-[#3d2940]">
                  {culprit
                    ? `${culprit.nickname} (${culprit.wrongCount} salah)`
                    : "0 Kesalahan!"}
                </div>
              </div>
            </div>
          </div>

          {/* Statistik Tiap Kru */}
          <div className="mb-5 space-y-1.5">
            {sortedPlayers.map((p) => {
              const isOffline = onlineById?.[p.id] === false;
              return (
                <div
                  key={p.id}
                  className={[
                    "flex items-center justify-between gap-2 rounded-2xl border-2 px-3 py-2",
                    isOffline
                      ? "border-dashed border-[#e0326a] bg-[#fff0f5] opacity-80"
                      : "border-[#d8cfa3] bg-[#fffdf0]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <AvatarBadge avatar={p.avatar} size="sm" offline={isOffline} />
                    <span className="text-sm font-extrabold text-[#3d2940]">{p.nickname}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-extrabold">
                    <span className="rounded-full bg-[#dff9d8] px-2 py-0.5 text-[#14532d]">
                      {p.correctCount} benar
                    </span>
                    <span className="rounded-full bg-[#ffe0e6] px-2 py-0.5 text-[#9b1342]">
                      {p.wrongCount} salah
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {isHost ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <GameButton variant="yellow" size="md" fullWidth onClick={onPlayAgain}>
                <PlayIcon className="h-5 w-5 fill-current" />
                Main Lagi!
              </GameButton>
              <GameButton variant="cyan" size="md" fullWidth onClick={onReturnLobby}>
                <RotateCcwIcon className="h-5 w-5" />
                Kembali ke Lobby
              </GameButton>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[#c8bf94] bg-[#ebe4be] py-3 text-center text-sm font-extrabold text-[#6e6049]">
              Menunggu Host memulai misi baru atau kembali ke Lobby...
            </div>
          )}
        </GamePanel>
      </div>
    );
  }

  /* 2. KOKPIT AKTIF 3 PANEL (TEMA LUAR ANGKASA GELAP) */
  const sectorPercent =
    view.sectorTarget > 0
      ? Math.max(0, Math.min(100, (view.sectorProgress / view.sectorTarget) * 100))
      : 0;
  const isCompactModules = view.me.modules.length > 4;

  const handleConfirmModule = (moduleId: string, value: ModuleSubmitValue) => {
    onAction("SUBMIT_MODULE", { moduleId, value });
  };

  return (
    <div className="relative mx-auto w-full max-w-xl">
      {/* Global Red Damage Flash Overlay */}
      <AnimatePresence>
        {damageFlash && (
          <motion.div
            initial={{ opacity: 0.65 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.36, ease: "easeOut" }}
            className="pointer-events-none fixed inset-0 z-40 bg-rose-600/45 ring-inset ring-8 ring-rose-500/80"
          />
        )}
      </AnimatePresence>

      {/* Main Dark Space Cockpit Frame */}
      <div
        ref={cockpitScope}
        className="relative overflow-hidden rounded-[26px] border-2 border-[#273e6e] bg-[#091124]/95 p-3 text-slate-100 shadow-[0_16px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(147,197,253,0.18)] will-change-transform sm:p-4"
      >
        {/* Compact Cockpit Top Strip: Sector Dots (Fill/Hollow) + Progress Bar */}
        <div className="mb-2.5 rounded-2xl border border-[#243966] bg-[#0f1b38] px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-extrabold">
            <div className="flex items-center gap-2">
              <span className="font-display inline-flex items-center gap-1 text-cyan-300">
                <RocketIcon className="h-3.5 w-3.5" />
                SEKTOR
              </span>
              <div
                className="flex items-center gap-1.5"
                aria-label={`Sektor ${view.sector} dari ${view.totalSectors}`}
              >
                {Array.from({ length: view.totalSectors }, (_, idx) => {
                  const sectorNum = idx + 1;
                  const isFilled = sectorNum <= view.sector;
                  const isCurrent = sectorNum === view.sector;
                  return (
                    <span
                      key={sectorNum}
                      className={[
                        "h-3 w-3 rounded-full border-2 transition-all",
                        isCurrent
                          ? "border-[#fff5a8] bg-[#ffe047] shadow-[0_0_8px_rgba(255,224,71,0.8)]"
                          : isFilled
                            ? "border-emerald-300 bg-emerald-400"
                            : "border-cyan-300/60 bg-transparent",
                      ].join(" ")}
                    />
                  );
                })}
              </div>
            </div>

            <span className="font-mono text-slate-300">
              {view.sectorProgress}/{view.sectorTarget}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#070d1d]">
            <div
              style={{ width: `${sectorPercent}%` }}
              className="h-full rounded-full bg-gradient-to-r from-[#2dd4ff] to-[#38f28c] transition-all duration-300"
            />
          </div>
        </div>

        {/* PANEL 1: TOP BANNER (INSTRUKSI + COUNTDOWN BAR) */}
        <div
          className={[
            "relative mb-2.5 flex min-h-[104px] flex-col justify-between overflow-hidden rounded-2xl border-2 px-3.5 pb-2.5 pt-2.5 transition-colors duration-200",
            successFlash
              ? "border-emerald-400 bg-emerald-950/75 shadow-[0_0_24px_rgba(52,211,153,0.45)]"
              : activeInstr?.kind === "IF_ELSE"
                ? "border-amber-400/80 bg-[#141d38]"
                : "border-[#31508f] bg-[#101c3a]",
          ].join(" ")}
        >
          {activeInstr ? (
            <div className="flex flex-1 flex-col justify-center">
              {activeInstr.kind === "IF_ELSE" && activeInstr.clauses ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-xs font-bold uppercase tracking-wide text-[#ffe047]">
                      Target: {activeInstr.targetModuleName}
                    </span>
                    <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-200">
                      CEK {activeInstr.parameterLabel?.toUpperCase()}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {activeInstr.clauses.map((cl, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 rounded-lg bg-black/25 px-2 py-0.5 text-xs font-bold"
                      >
                        <span className="text-slate-200">{cl.conditionLabel}</span>
                        <span className="font-display shrink-0 text-[#55f5ff]">
                          {cl.actionLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="mb-0.5 text-[10px] font-extrabold uppercase tracking-widest text-cyan-300/80">
                    Bacakan Perintah Ini
                  </div>
                  <p className="font-display text-base font-bold leading-snug text-white sm:text-lg">
                    {activeInstr.text}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs font-extrabold tracking-wide text-slate-400">
              {view.phase === "PLAYING" ? "Menerima transmisi baru..." : "Menunggu misi dimulai..."}
            </div>
          )}

          {/* Horizontal Countdown Progress Bar (hanya tampil saat PLAYING) */}
          <div
            className={[
              "mt-2 h-2 w-full overflow-hidden rounded-full bg-black/45 transition-opacity",
              view.phase === "PLAYING" ? "opacity-100" : "opacity-0",
            ].join(" ")}
          >
            <div
              style={{
                width: view.phase === "PLAYING" ? `${(barRatio * 100).toFixed(2)}%` : "0%",
              }}
              className={[
                "h-full rounded-full transition-colors",
                view.config.difficulty === "practice"
                  ? "bg-emerald-400/75"
                  : barRatio <= 0.22
                    ? "bg-rose-500"
                    : barRatio <= 0.45
                      ? "bg-amber-400"
                      : "bg-[#38e8ff]",
              ].join(" ")}
            />
          </div>
        </div>

        {/* PANEL 2: MIDDLE STRIP (HANYA TAMPIL MULAI SEKTOR 3 SAAT INSTRUKSI IF-ELSE DIPAKAI) */}
        {view.sector >= 3 && view.me.parameter && (
          <div className="mb-2.5">
            <ParameterStrip parameter={view.me.parameter} />
          </div>
        )}

        {/* PANEL 3: BOTTOM GRID (MODUL KONTROL INTERAKTIF) */}
        <div
          className={[
            "rounded-2xl border-2 p-2 transition-colors duration-200",
            successFlash
              ? "border-emerald-400 bg-emerald-950/40"
              : "border-[#1f335c] bg-[#070d1d]/80",
          ].join(" ")}
        >
          <div className="grid grid-cols-2 gap-2">
            {view.me.modules.map((mod) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                compact={isCompactModules}
                disabled={view.phase !== "PLAYING"}
                onConfirm={handleConfirmModule}
              />
            ))}
          </div>
        </div>

        {/* FULL-SCREEN COCKPIT OVERLAY: READY CHECK (SEBELUM MULAI & NAIK SEKTOR) */}
        <AnimatePresence>
          {view.phase === "READY_CHECK" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 z-30 flex flex-col gap-2 items-center justify-center bg-[#060b19]/92 p-5 text-center backdrop-blur-[4px]"
            >
              {view.justCompletedSector !== null ? (
                <>
                  <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/70 bg-emerald-500/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-emerald-200">
                    <SparklesIcon className="h-3.5 w-3.5" />
                    Warp Jump · Hull +15 HP
                  </span>
                  <h3 className="font-display text-2xl font-bold text-white">
                    Sektor {view.justCompletedSector} Selesai!
                  </h3>
                  <p className="mt-1 max-w-xs text-xs font-bold text-slate-300">
                    Modul &amp; status panel telah diacak ulang. Semua kru harus menekan Ready untuk
                    memasuki Sektor {view.sector}/{view.totalSectors}!
                  </p>
                </>
              ) : (
                <>
                  <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-cyan-400/70 bg-cyan-500/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-cyan-200">
                    <RocketIcon className="h-3.5 w-3.5" />
                    Misi Spaceteam · Sektor {view.sector}/{view.totalSectors}
                  </span>
                  <h3 className="font-display text-2xl font-bold text-white">
                    Semua Kru Siap?
                  </h3>
                  <p className="mt-1 max-w-xs text-xs font-bold text-slate-300">
                    Pastikan semua sudah siap, lalu tekan Ready untuk memulai
                    hitungan mundur!
                  </p>
                </>
              )}

              {/* Daftar Status Ready Kru */}
              <div className="my-4 flex w-full max-w-sm flex-wrap items-center justify-center gap-2">
                {view.players.map((p) => (
                  <div
                    key={p.id}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-extrabold transition",
                      p.isReady
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                        : "border-slate-700 bg-slate-900/80 text-slate-400",
                    ].join(" ")}
                  >
                    <AvatarBadge avatar={p.avatar} size="xs" offline={onlineById?.[p.id] === false} />
                    <span>{p.nickname}</span>
                    {p.isReady && <CheckIcon className="h-3.5 w-3.5 stroke-[3] text-emerald-300" />}
                  </div>
                ))}
              </div>

              <div className="w-full max-w-xs">
                {view.me.isReady ? (
                  <div className="font-display flex items-center justify-center gap-1.5 rounded-2xl border-2 border-emerald-400/70 bg-emerald-500/20 py-3 text-sm font-bold text-emerald-200">
                    <CheckIcon className="h-5 w-5 stroke-[3]" />
                    Siap! Menunggu kru lain...
                  </div>
                ) : (
                  <GameButton
                    variant="yellow"
                    size="md"
                    fullWidth
                    onClick={() => onAction("PLAYER_READY", {})}
                  >
                    <CheckIcon className="h-5 w-5 stroke-[3]" />
                    READY!
                  </GameButton>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FULL-SCREEN COCKPIT OVERLAY: COUNTDOWN 5..4..3..2..1 MENUTUPI LAYAR GAME */}
        <AnimatePresence>
          {view.phase === "SECTOR_PREP" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#060b19]/88 p-5 text-center backdrop-blur-[4px]"
            >
              <span className="mb-1 text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-300">
                Sektor {view.sector} / {view.totalSectors}
              </span>
              <div className="font-display text-lg font-bold tracking-wide text-white">
                MISI DIMULAI DALAM
              </div>

              <div className="my-4 flex h-32 w-32 items-center justify-center rounded-full border-4 border-[#ffe047] bg-[#0e1a36] shadow-[0_0_40px_rgba(255,224,71,0.35)]">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={transitionSec}
                    initial={{ scale: 1.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 450, damping: 22 }}
                    className="font-display text-6xl font-black text-[#ffe047] drop-shadow-[0_4px_12px_rgba(255,224,71,0.5)]"
                  >
                    {transitionSec}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="mb-2 h-2 w-48 overflow-hidden rounded-full bg-slate-800">
                <div
                  style={{ width: `${(barRatio * 100).toFixed(2)}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-[#2dd4ff] to-[#ffe047]"
                />
              </div>

              <p className="text-xs font-bold text-slate-300">
                {view.sector <= 2
                  ? "Sektor 1–2: Perintah langsung, eksekusi cepat!"
                  : "Sektor 3+: Perhatikan syarat JIKA / SELAIN ITU pada Status Panel!"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
