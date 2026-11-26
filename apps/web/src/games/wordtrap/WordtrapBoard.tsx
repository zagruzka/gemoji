import { ALPHABET, type WordtrapPlayerView } from "@gemoji/game-wordtrap";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  PlayIcon,
  RotateCcwIcon,
  SendIcon,
  SkullIcon,
  SquareLetterTIcon,
  TrophyIcon,
  ZapIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AvatarBadge, GameButton, GamePanel } from "../../components/game-ui";

interface WordtrapBoardProps {
  view: WordtrapPlayerView;
  isHost: boolean;
  remainingSec: number | null;
  onlineById?: Record<string, boolean>;
  onAction: (actionType: string, data: unknown) => void;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
}

export function WordtrapBoard({
  view,
  isHost,
  remainingSec,
  onlineById,
  onAction,
  onPlayAgain,
  onReturnLobby,
}: WordtrapBoardProps) {
  const [trapMode, setTrapMode] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [wordGuess, setWordGuess] = useState("");

  // Reset local trap UI state whenever turn or phase changes
  useEffect(() => {
    if (!view.me.isMyTurn || !view.me.canUseTrap) {
      setTrapMode(false);
      setSelectedSlot(null);
    }
  }, [view.me.isMyTurn, view.me.canUseTrap, view.round, view.phase]);

  useEffect(() => {
    if (view.phase !== "GUESSING_WORD") {
      setWordGuess("");
    }
  }, [view.phase]);

  const playerById = new Map(view.players.map((p) => [p.id, p]));
  const currentTurnPlayer = view.currentTurnPlayerId
    ? playerById.get(view.currentTurnPlayerId)
    : null;
  const activeGuesser = view.activeGuesserId ? playerById.get(view.activeGuesserId) : null;
  const isMeGuesser = view.phase === "GUESSING_WORD" && view.activeGuesserId === view.me.id;

  const sortedByScore = [...view.players].sort((a, b) => b.score - a.score);

  const handleKeyboardClick = (letter: string) => {
    if (!view.me.isMyTurn || view.phase !== "PLAYING") return;

    if (trapMode) {
      if (view.config.mode === "reveal") {
        if (selectedSlot === null) return;
        onAction("USE_TRAP", { letter, slotIndex: selectedSlot });
      } else {
        onAction("USE_TRAP", { letter });
      }
      setTrapMode(false);
      setSelectedSlot(null);
      return;
    }

    onAction("PICK_LETTER", { letter });
  };

  const handleSubmitWordGuess = () => {
    const clean = wordGuess.trim();
    if (!clean) return;
    onAction("SUBMIT_WORD_GUESS", { word: clean });
    setWordGuess("");
  };

  /* 1. FASE GAME OVER */
  if (view.phase === "GAME_OVER") {
    const winnerPlayer = view.winner?.winnerPlayerIds[0]
      ? playerById.get(view.winner.winnerPlayerIds[0])
      : sortedByScore[0];

    return (
      <div className="mx-auto w-full max-w-xl">
        <GamePanel title={`${winnerPlayer?.nickname ?? "Pemain"} Menang!`} ribbonColor="pink">
          <div className="mb-4 text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-b from-[#ffe259] to-[#f4900c] text-white shadow-lg">
              <TrophyIcon className="h-9 w-9" />
            </div>
            <p className="text-sm font-extrabold text-[#5c1632]">{view.winner?.reason}</p>
          </div>

          {view.revealedSecretWord && (
            <div className="mb-4 rounded-2xl border-2 border-[#78d465] bg-[#ecffd9] p-3 text-center">
              <div className="text-[11px] font-extrabold uppercase text-[#1a662b]">
                Kata Ronde Terakhir
              </div>
              <div className="font-display text-2xl font-bold tracking-[0.18em] text-[#144a1f]">
                {view.revealedSecretWord}
              </div>
            </div>
          )}

          <div className="mb-5 space-y-2">
            {sortedByScore.map((p, idx) => {
              const isOffline = onlineById?.[p.id] === false;
              return (
                <div
                  key={p.id}
                  className={[
                    "flex items-center justify-between gap-2 rounded-2xl border-2 px-3 py-2",
                    isOffline
                      ? "border-dashed border-[#e0326a] bg-[#fff0f5] opacity-80"
                      : idx === 0
                        ? "border-[#e0326a] bg-[#fff9dc]"
                        : "border-[#d8cfa3] bg-[#fffdf0]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-display w-5 text-center text-sm font-bold text-[#786b51]">
                      #{idx + 1}
                    </span>
                    <AvatarBadge avatar={p.avatar} size="sm" offline={isOffline} />
                    <span className="text-sm font-extrabold text-[#3d2940]">{p.nickname}</span>
                  </div>
                  <span className="font-display rounded-full border-2 border-[#e0326a] bg-[#ffe694] px-3 py-0.5 text-xs font-bold text-[#5c1632]">
                    {p.score} / {view.config.targetPoints} Poin
                  </span>
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
              Menunggu Host memulai permainan baru atau kembali ke Lobby...
            </div>
          )}
        </GamePanel>
      </div>
    );
  }

  /* 2. FASE ROUND END */
  if (view.phase === "ROUND_END") {
    const roundWinner = view.lastRoundResult?.winnerPlayerId
      ? playerById.get(view.lastRoundResult.winnerPlayerId)
      : null;

    return (
      <div className="mx-auto w-full max-w-xl">
        <GamePanel title={`Ronde ${view.round} Selesai!`} ribbonColor="purple">
          <div className="mb-4 text-center">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#786b51]">
              Kata Rahasianya Adalah
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {(view.revealedSecretWord ?? "").split("").map((ch, i) => (
                <span
                  key={i}
                  className="font-display flex h-11 w-10 items-center justify-center rounded-xl border-2 border-[#4fc924] bg-[#dff9d8] text-2xl font-bold text-[#144a1f] shadow-[0_3px_0_#3ba618]"
                >
                  {ch}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm font-extrabold text-[#5c1632]">
              {roundWinner
                ? `🎉 ${roundWinner.nickname} menebak dengan benar dan mendapat +1 poin!`
                : view.lastRoundResult?.reason === "all_eliminated"
                  ? "Semua pemain tereliminasi, tidak ada poin di ronde ini."
                  : "Semua huruf sudah terbuka, tidak ada poin di ronde ini."}
            </p>
          </div>

          <div className="mb-4 space-y-1.5">
            {sortedByScore.map((p) => {
              const isOffline = onlineById?.[p.id] === false;
              return (
                <div
                  key={p.id}
                  className={[
                    "flex items-center justify-between rounded-2xl border-2 px-3 py-2",
                    isOffline
                      ? "border-dashed border-[#e0326a] bg-[#fff0f5] opacity-80"
                      : "border-[#d8cfa3] bg-[#fffdf0]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <AvatarBadge avatar={p.avatar} size="sm" offline={isOffline} />
                    <span className="text-sm font-extrabold text-[#3d2940]">{p.nickname}</span>
                  </div>
                  <span className="font-display rounded-full bg-[#ffe694] px-2.5 py-0.5 text-xs font-bold text-[#5c1632]">
                    {p.score} / {view.config.targetPoints}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-2">
            {remainingSec !== null && (
              <span className="text-xs font-extrabold text-[#6e6049]">
                Ronde berikutnya otomatis dalam {remainingSec} detik...
              </span>
            )}
            {isHost && (
              <GameButton
                variant="yellow"
                size="md"
                fullWidth
                onClick={() => onAction("NEXT_ROUND", {})}
              >
                <ArrowRightIcon className="h-5 w-5" />
                Lanjut Ronde {view.round + 1} Sekarang
              </GameButton>
            )}
          </div>
        </GamePanel>
      </div>
    );
  }

  /* 3. FASE PLAYING & GUESSING_WORD */
  const recentLogs = [...view.logs].reverse().slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-xl space-y-3">
      <GamePanel
        title={`Ronde ${view.round} · Wordtrap`}
        ribbonColor={view.phase === "GUESSING_WORD" ? "pink" : "cyan"}
      >
        {/* Mode & Target Info Strip */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] px-3 py-1.5 text-xs font-extrabold text-[#5c1632]">
          <span className="inline-flex items-center gap-1">
            {view.config.mode === "reveal" ? (
              <EyeIcon className="h-3.5 w-3.5" />
            ) : (
              <EyeOffIcon className="h-3.5 w-3.5" />
            )}
            Mode {view.config.mode === "reveal" ? "Reveal" : "Hidden (Anagram)"}
          </span>
          <span className="inline-flex items-center gap-1">
            <TrophyIcon className="h-3.5 w-3.5 text-[#d47a00]" />
            Target {view.config.targetPoints} Poin
          </span>
          <span>{view.wordLength} Huruf</span>
        </div>

        {/* Turn Order & Scoreboard Chips */}
        <div className="mb-4 flex flex-wrap justify-center gap-1.5">
          {view.turnOrder.map((pid) => {
            const p = playerById.get(pid);
            if (!p) return null;
            const isOffline = onlineById?.[pid] === false;
            const isCurrent = pid === view.currentTurnPlayerId && view.phase === "PLAYING";
            const isGuesser = pid === view.activeGuesserId && view.phase === "GUESSING_WORD";
            return (
              <div
                key={pid}
                title={isOffline ? `${p.nickname} sedang offline` : undefined}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-extrabold transition",
                  isOffline
                    ? "border-dashed border-[#e0326a] bg-[#fff0f5] text-[#9b1342] opacity-80"
                    : p.eliminatedInRound
                      ? "border-[#c8bf94] bg-[#e5dec0] text-[#8a7d63] line-through opacity-65"
                      : isGuesser
                        ? "scale-105 border-[#e0326a] bg-[#ffe0eb] text-[#8a123b] shadow"
                        : isCurrent
                          ? "scale-105 border-[#e0326a] bg-[#ffe694] text-[#5c1632] shadow"
                          : "border-[#d8cfa3] bg-[#fffdf0] text-[#4e3e4d]",
                ].join(" ")}
              >
                <AvatarBadge
                  avatar={p.avatar}
                  size="xs"
                  dimmed={p.eliminatedInRound}
                  offline={isOffline}
                />
                <span>{p.nickname}</span>
                {p.eliminatedInRound && <SkullIcon className="h-3.5 w-3.5" />}
                <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">
                  {p.score}
                </span>
              </div>
            );
          })}
        </div>

        {/* Word Slots Board */}
        <div className="mb-4 rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] px-2.5 py-4">
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            {view.slots.map((ch, idx) => {
              const isTrapSelectable =
                trapMode && view.config.mode === "reveal" && ch === null;
              const isSlotChosen = isTrapSelectable && selectedSlot === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!isTrapSelectable}
                  onClick={() => {
                    if (isTrapSelectable) setSelectedSlot(idx);
                  }}
                  className={[
                    "font-display relative flex h-11 w-9 items-center justify-center rounded-xl border-2 text-xl font-bold transition sm:h-12 sm:w-10 sm:text-2xl",
                    ch !== null
                      ? "border-[#4fc924] bg-[#dff9d8] text-[#144a1f] shadow-[0_3px_0_#3ba618]"
                      : isSlotChosen
                        ? "scale-105 cursor-pointer border-[#7442e8] bg-[#e9dcff] text-[#5828b5] shadow-[0_3px_0_#5828b5]"
                        : isTrapSelectable
                          ? "cursor-pointer border-dashed border-[#7442e8] bg-[#f4ecff] text-[#7442e8] hover:bg-[#e9dcff]"
                          : "border-[#cfc595] bg-[#fffdf0] text-[#b5a984]",
                  ].join(" ")}
                >
                  {ch ?? (isSlotChosen ? "?" : "_")}
                  {isTrapSelectable && (
                    <span className="absolute -bottom-1.5 rounded bg-[#7442e8] px-1 text-[9px] font-extrabold text-white">
                      {idx + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {view.config.mode === "hidden" && (
            <p className="mt-2.5 text-center text-[11px] font-bold text-[#786b51]">
              Mode Hidden: huruf benar tidak dibuka di slot, susun dari huruf Hijau di keyboard!
            </p>
          )}
        </div>

        {/* Private Owner Trap Indicator (ONLY visible to trap creator) */}
        {view.me.myActiveTrap && (
          <div className="mb-3 flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#a982f5] bg-[#f4ecff] px-3 py-1.5 text-xs font-extrabold text-[#5828b5]">
            <SquareLetterTIcon className="h-3.5 w-3.5 shrink-0" />
            <span>
              Trap aktifmu: huruf &ldquo;{view.me.myActiveTrap.letter}&rdquo;
              {view.me.myActiveTrap.slotIndex !== null
                ? ` di slot #${view.me.myActiveTrap.slotIndex + 1}`
                : ""}{" "}
              (sisa {view.me.myActiveTrap.turnsRemaining} giliran)
            </span>
          </div>
        )}

        {/* Phase-specific Active Box */}
        {view.phase === "GUESSING_WORD" ? (
          <div className="mb-4 rounded-2xl border-3 border-[#e0326a] bg-[#fff0f5] p-3.5">
            <div className="font-display mb-2 flex items-center justify-between text-base font-bold text-[#8a123b]">
              <span className="inline-flex items-center gap-1.5">
                <ZapIcon className="h-4 w-4 fill-current" />
                {isMeGuesser
                  ? "Waktumu Menebak Kata!"
                  : `${activeGuesser?.nickname ?? "Pemain"} sedang menebak kata!`}
              </span>
              {remainingSec !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e0326a] px-2.5 py-0.5 text-xs text-white">
                  <ClockIcon className="h-3.5 w-3.5" /> {remainingSec}d
                </span>
              )}
            </div>

            {isMeGuesser ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-[#8a123b]">
                  Ketik jawaban kata utuh ({view.wordLength} huruf). Jika salah, kamu tereliminasi
                  sampai ronde berikutnya!
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    maxLength={30}
                    placeholder={`Ketik kata ${view.wordLength} huruf...`}
                    value={wordGuess}
                    onChange={(e) => setWordGuess(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitWordGuess();
                    }}
                    className="font-display flex-1 rounded-xl border-2 border-[#e0326a] bg-[#fffdf0] px-3 py-2 text-base font-bold uppercase tracking-widest text-[#3d2940] outline-none"
                  />
                  <GameButton
                    variant="yellow"
                    size="sm"
                    disabled={!wordGuess.trim()}
                    onClick={handleSubmitWordGuess}
                  >
                    <SendIcon className="h-4 w-4" />
                    Jawab
                  </GameButton>
                </div>
              </div>
            ) : (
              <p className="text-center text-xs font-bold text-[#8a123b]">
                Permainan berhenti sementara menunggu jawaban dari{" "}
                <strong>{activeGuesser?.nickname}</strong>...
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Turn Status Banner */}
            <div
              className={[
                "mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 px-3.5 py-2 text-xs font-extrabold",
                view.me.eliminatedInRound
                  ? "border-[#c8bf94] bg-[#ebe4be] text-[#6e6049]"
                  : view.me.isMyTurn
                    ? "border-[#e0326a] bg-[#fff7d6] text-[#5c1632]"
                    : "border-[#d8cfa3] bg-[#ebe4be] text-[#5c4e3d]",
              ].join(" ")}
            >
              <span>
                {view.me.eliminatedInRound
                  ? "Kamu tereliminasi di ronde ini, tunggu ronde berikutnya."
                  : view.me.isMyTurn
                    ? trapMode
                      ? "Mode Skill Trap Aktif!"
                      : "Giliranmu! Pilih 1 huruf di keyboard atau pakai Skill Trap."
                    : currentTurnPlayer && onlineById?.[currentTurnPlayer.id] === false
                      ? `${currentTurnPlayer.nickname} sedang offline (menunggu giliran)...`
                      : `Menunggu giliran ${currentTurnPlayer?.nickname ?? "..."}...`}
              </span>
              {remainingSec !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e0326a] px-2 py-0.5 text-[11px] text-white">
                  <ClockIcon className="h-3 w-3" /> {remainingSec}d
                </span>
              )}
            </div>

            {/* Skill Trap Active Instructions */}
            {view.me.isMyTurn && trapMode && (
              <div className="mb-3 rounded-xl border-2 border-[#a982f5] bg-[#f4ecff] px-3 py-2 text-center text-xs font-extrabold text-[#5828b5]">
                {view.config.mode === "reveal"
                  ? selectedSlot === null
                    ? "Langkah 1: Ketuk 1 slot kosong di atas untuk dipasangi huruf palsu."
                    : `Langkah 2: Pilih 1 huruf palsu di keyboard untuk dipasang di slot #${selectedSlot + 1}!`
                  : "Pilih 1 huruf yang belum terpakai di keyboard. Huruf ini akan tampil HIJAU bagi semua pemain selama 1 putaran!"}
              </div>
            )}
          </>
        )}

        {/* Keyboard UI A–Z */}
        <div className="mb-4 grid grid-cols-7 gap-1.5 sm:grid-cols-9">
          {ALPHABET.map((letter) => {
            const status = view.keyboard[letter] ?? "unused";
            const canPickNormal =
              view.phase === "PLAYING" && view.me.isMyTurn && !trapMode && status === "unused";
            const canPickTrapHidden =
              view.phase === "PLAYING" &&
              view.me.isMyTurn &&
              trapMode &&
              view.config.mode === "hidden" &&
              status === "unused";
            const canPickTrapReveal =
              view.phase === "PLAYING" &&
              view.me.isMyTurn &&
              trapMode &&
              view.config.mode === "reveal" &&
              selectedSlot !== null &&
              status !== "wrong";

            const clickable = canPickNormal || canPickTrapHidden || canPickTrapReveal;

            return (
              <button
                key={letter}
                type="button"
                disabled={!clickable}
                onClick={() => handleKeyboardClick(letter)}
                className={[
                  "font-display flex h-10 items-center justify-center rounded-xl border-2 text-sm font-bold transition",
                  status === "correct"
                    ? "border-[#4fc924] bg-[#dff9d8] text-[#14532d] shadow-[0_2px_0_#3ba618]"
                    : status === "wrong"
                      ? "border-[#e0326a] bg-[#ffe0e6] text-[#9b1342] opacity-70"
                      : clickable
                        ? trapMode
                          ? "cursor-pointer border-[#7442e8] bg-[#f4ecff] text-[#5828b5] shadow-[0_2px_0_#7442e8] hover:bg-[#e8d9ff] active:translate-y-0.5"
                          : "cursor-pointer border-[#cfc595] bg-[#fffdf0] text-[#3d2940] shadow-[0_2px_0_#bfb482] hover:bg-[#fff6cc] active:translate-y-0.5"
                        : "cursor-default border-[#dcd3a6] bg-[#f5f0d6] text-[#8a7d63]",
                  canPickTrapReveal && status === "correct"
                    ? "cursor-pointer ring-2 ring-[#7442e8] hover:brightness-95"
                    : "",
                ].join(" ")}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Anytime "Tebak Kata" + Skill Trap Buttons */}
        {view.phase === "PLAYING" && (
          <div className="mb-4 flex items-center gap-2.5">
            <GameButton
              variant="yellow"
              size="sm"
              className="flex-1"
              disabled={!view.me.canGuessWord}
              onClick={() => onAction("START_WORD_GUESS", {})}
            >
              <ZapIcon className="h-4 w-4 shrink-0 fill-current" />
              {view.me.eliminatedInRound ? "Tereliminasi" : "Tebak Kata"}
            </GameButton>

            <GameButton
              variant={trapMode ? "pink" : "cyan"}
              size="sm"
              className="shrink-0"
              title={`Pakai Skill Trap (sisa ${view.me.trapsRemainingInRound}/${view.config.trapLimit} ronde ini)`}
              disabled={!view.me.canUseTrap}
              onClick={() => {
                setTrapMode((prev) => !prev);
                setSelectedSlot(null);
              }}
            >
              <SquareLetterTIcon className="h-4 w-4 shrink-0" />
              {view.me.trapUsedInRound
                ? "Habis"
                : trapMode
                  ? "Batal"
                  : view.config.trapLimit > 1
                    ? `Trap (${view.me.trapsRemainingInRound})`
                    : "Trap"}
            </GameButton>
          </div>
        )}

        {/* Activity & Trap Log */}
        <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] p-2.5">
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#6e6049]">
            Log Aktivitas &amp; Trap
          </div>
          <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
            {recentLogs.map((log) => {
              const isTrapLog = log.type === "trap_expired" || log.type === "trap_busted";
              const isWrong = log.type === "guess_wrong";
              const isWin = log.type === "guess_correct";
              return (
                <div
                  key={log.id}
                  className={[
                    "flex items-start gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold leading-snug",
                    isTrapLog
                      ? "border border-[#a982f5] bg-[#f4ecff] text-[#5828b5]"
                      : isWrong
                        ? "border border-[#f26b99] bg-[#ffe3ec] text-[#9b1342]"
                        : isWin
                          ? "border border-[#78d465] bg-[#ecffd9] text-[#144a1f]"
                          : "bg-[#fffdf0] text-[#4e3e4d]",
                  ].join(" ")}
                >
                  {isTrapLog && <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  <span>{log.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      </GamePanel>
    </div>
  );
}
