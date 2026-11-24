import {
  SKIP_VOTE_TARGET,
  type UndercoverPlayerView,
  type UndercoverRole,
} from "@gemoji/game-undercover";
import {
  Check,
  Clock,
  Eye,
  EyeOff,
  MessageSquareText,
  PenLine,
  Play,
  RotateCcw,
  Send,
  SkipForward,
  Skull,
  Sparkles,
  Trophy,
  Vote,
} from "lucide-react";
import { useState, type MouseEvent, type PointerEvent } from "react";
import { AvatarBadge, GameButton, GamePanel } from "../../components/game-ui";

interface UndercoverBoardProps {
  view: UndercoverPlayerView;
  isHost: boolean;
  remainingSec: number | null;
  onAction: (actionType: string, data: unknown) => void;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
}

const ROLE_BADGE: Record<UndercoverRole, { label: string; cls: string }> = {
  citizen: { label: "Citizen", cls: "bg-[#dff9d8] text-[#1a662b] border-[#78d465]" },
  undercover: { label: "Undercover", cls: "bg-[#ffe0eb] text-[#b81d52] border-[#f26b99]" },
  mr_blank: { label: "Mr. Blank", cls: "bg-[#ebe0ff] text-[#5828b5] border-[#a982f5]" },
};

export function UndercoverBoard({
  view,
  isHost,
  remainingSec,
  onAction,
  onPlayAgain,
  onReturnLobby,
}: UndercoverBoardProps) {
  const [peekWord, setPeekWord] = useState(false);
  const [clueInput, setClueInput] = useState("");
  const [mrBlankGuess, setMrBlankGuess] = useState("");

  // Custom word form state (1 pair per player)
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const [customErr, setCustomErr] = useState<string | null>(null);

  const playerById = new Map(view.players.map((p) => [p.id, p]));
  const alivePlayers = view.players.filter((p) => p.alive);

  const holdPeekHandlers = {
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      setPeekWord(true);
    },
    onPointerUp: () => setPeekWord(false),
    onPointerLeave: () => setPeekWord(false),
    onPointerCancel: () => setPeekWord(false),
    onBlur: () => setPeekWord(false),
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };

  const roleSummaryStrip = (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
      <span className="font-display rounded-full border-2 border-[#78d465] bg-[#dff9d8] px-2.5 py-0.5 text-xs font-bold text-[#1a662b]">
        {view.roleSummary.citizen} Citizen
      </span>
      {view.roleSummary.undercover > 0 && (
        <span className="font-display rounded-full border-2 border-[#f26b99] bg-[#ffe0eb] px-2.5 py-0.5 text-xs font-bold text-[#b81d52]">
          {view.roleSummary.undercover} Undercover
        </span>
      )}
      {view.roleSummary.mrBlank > 0 && (
        <span className="font-display rounded-full border-2 border-[#a982f5] bg-[#ebe0ff] px-2.5 py-0.5 text-xs font-bold text-[#5828b5]">
          {view.roleSummary.mrBlank} Mr. Blank
        </span>
      )}
    </div>
  );

  const handleSubmitCustomWords = () => {
    const wordA = pairA.trim();
    const wordB = pairB.trim();

    if (!wordA || !wordB) {
      setCustomErr("Kedua kolom pasangan kata wajib diisi.");
      return;
    }
    if (wordA.toLowerCase() === wordB.toLowerCase()) {
      setCustomErr("Kedua kata dalam satu pasangan tidak boleh sama.");
      return;
    }

    setCustomErr(null);
    onAction("SUBMIT_CUSTOM_WORDS", {
      pairs: [{ wordA, wordB }],
    });
  };

  const handleSendClue = () => {
    const clean = clueInput.trim();
    if (!clean) return;
    onAction("SUBMIT_CLUE", { clue: clean });
    setClueInput("");
  };

  const handleMrBlankGuess = () => {
    const clean = mrBlankGuess.trim();
    if (!clean) return;
    onAction("SUBMIT_MR_BLANK_GUESS", { guess: clean });
    setMrBlankGuess("");
  };

  /* 1. FASE SUBMIT CUSTOM WORDS (1 pasang/pemain) */
  if (view.phase === "SUBMIT_CUSTOM_WORDS") {
    const submittedCount = view.submittedCustomWordPlayerIds.length;
    return (
      <div className="mx-auto w-full max-w-xl">
        <GamePanel title="Tulis 1 Pasang Kata" ribbonColor="purple">
          <p className="mb-4 text-center text-sm font-bold text-[#6e6049]">
            Tiap pemain menyumbang <strong>1 pasang kata mirip</strong>. Semua pasangan akan diacak
            dan dipakai bergantian sampai habis!
          </p>

          {view.me.hasSubmittedCustomWords ? (
            <div className="mb-4 rounded-2xl border-2 border-[#64cf36] bg-[#ebffd9] p-4 text-center">
              <div className="font-display text-lg font-bold text-[#1d6321]">
                Pasangan Katamu Sudah Masuk!
              </div>
              <p className="mt-1 text-xs font-bold text-[#357a3a]">
                Menunggu pemain lain selesai mengisi ({submittedCount}/{view.players.length})...
              </p>
            </div>
          ) : (
            <div className="mb-4 space-y-3">
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] p-3.5">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#5c1632]">
                  <PenLine className="h-3.5 w-3.5" /> Pasangan Kata Mirip
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    maxLength={40}
                    autoFocus
                    placeholder="Kata 1 (mis. Kopi)"
                    value={pairA}
                    onChange={(e) => setPairA(e.target.value)}
                    className="rounded-xl border-2 border-[#cfc595] bg-[#fffdf0] px-3 py-2.5 text-sm font-bold text-[#3d2940] outline-none focus:border-[#7442e8]"
                  />
                  <input
                    type="text"
                    maxLength={40}
                    placeholder="Kata 2 (mis. Teh)"
                    value={pairB}
                    onChange={(e) => setPairB(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitCustomWords();
                    }}
                    className="rounded-xl border-2 border-[#cfc595] bg-[#fffdf0] px-3 py-2.5 text-sm font-bold text-[#3d2940] outline-none focus:border-[#7442e8]"
                  />
                </div>
              </div>

              {customErr && (
                <div className="rounded-xl border-2 border-[#e0326a] bg-[#ffe3ec] px-3 py-2 text-center text-xs font-extrabold text-[#9b1342]">
                  {customErr}
                </div>
              )}

              <GameButton variant="yellow" size="md" fullWidth onClick={handleSubmitCustomWords}>
                <Send className="h-5 w-5" />
                Kirim Pasangan Kata!
              </GameButton>
            </div>
          )}

          {/* Progress Chips */}
          <div className="flex flex-wrap justify-center gap-2">
            {view.players.map((p) => {
              const done = view.submittedCustomWordPlayerIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-extrabold",
                    done
                      ? "border-[#64cf36] bg-[#ebffd9] text-[#1d6321]"
                      : "border-[#d8cfa3] bg-[#fffdf0] text-[#7a6d54]",
                  ].join(" ")}
                >
                  <AvatarBadge avatar={p.avatar} size="sm" className="h-6 w-6 text-xs" />
                  <span>{p.nickname}</span>
                  {done && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
              );
            })}
          </div>
        </GamePanel>
      </div>
    );
  }

  /* 2. FASE REVEAL WORD */
  if (view.phase === "REVEAL_WORD") {
    const readyCount = view.players.filter((p) => p.ready).length;
    const isMrBlank = view.me.knownRole === "mr_blank";

    return (
      <div className="mx-auto w-full max-w-md">
        <GamePanel title="Kartu Rahasiamu" ribbonColor="pink">
          {roleSummaryStrip}
          {view.config.wordMode === "custom" && (
            <div className="mb-3 text-center text-xs font-extrabold text-[#6540bb]">
              Mode Custom Word · Sisa pool setelah ronde ini: {view.customPoolRemaining} pasang
            </div>
          )}

          {/* Hold-to-Peek Secret Card */}
          <button
            type="button"
            {...holdPeekHandlers}
            className={[
              "mb-5 flex min-h-44 w-full cursor-pointer select-none touch-none flex-col items-center justify-center rounded-3xl border-4 p-5 text-center transition-all duration-150",
              peekWord
                ? "border-[#e0326a] bg-[#fffef4] shadow-[0_8px_0_#e0326a]"
                : "border-[#6540bb] bg-gradient-to-b from-[#8b5cf6] to-[#6540bb] text-white shadow-[0_8px_0_#43258c]",
            ].join(" ")}
          >
            {!peekWord ? (
              <>
                <Eye className="mb-2 h-10 w-10" />
                <div className="font-display text-2xl font-bold">Tahan untuk Intip Kata</div>
                <p className="mt-1 text-xs font-bold text-white/85">
                  Pastikan layar tidak terlihat oleh teman di sebelahmu!
                </p>
              </>
            ) : (
              <>
                {view.me.knownRole && (
                  <span
                    className={`font-display mb-2 rounded-full border-2 px-3 py-0.5 text-xs font-bold ${ROLE_BADGE[view.me.knownRole].cls}`}
                  >
                    {ROLE_BADGE[view.me.knownRole].label}
                  </span>
                )}

                {isMrBlank ? (
                  <>
                    <div className="font-display text-2xl font-bold text-[#5828b5]">
                      Kamu adalah Mr. Blank!
                    </div>
                    <p className="mt-1 text-xs font-bold text-[#6e6049]">
                      Kamu tidak mendapat kata. Dengarkan clue pemain lain dan berbaurlah!
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-extrabold uppercase tracking-wider text-[#8a7d63]">
                      Kata Rahasiamu
                    </div>
                    <div className="font-display mt-1 text-4xl font-bold text-[#3d2940]">
                      {view.me.word}
                    </div>
                  </>
                )}

                <span className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-[#9e8e70]">
                  <EyeOff className="h-3.5 w-3.5" /> Lepaskan untuk sembunyikan
                </span>
              </>
            )}
          </button>

          <GameButton
            variant={view.me.ready ? "white" : "green"}
            size="lg"
            fullWidth
            disabled={view.me.ready}
            onClick={() => onAction("MARK_READY", {})}
          >
            <Check className="h-6 w-6 stroke-[3]" />
            {view.me.ready ? `Menunggu (${readyCount}/${view.players.length})` : "Saya Siap!"}
          </GameButton>

          {/* Ready status chips */}
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {view.players.map((p) => (
              <span
                key={p.id}
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-extrabold",
                  p.ready
                    ? "border-[#5ac92e] bg-[#ebffd9] text-[#1c6622]"
                    : "border-[#d8cfa3] bg-[#ebe4be] text-[#7a6d54]",
                ].join(" ")}
              >
                {p.nickname} {p.ready ? "✓" : "..."}
              </span>
            ))}
          </div>
        </GamePanel>
      </div>
    );
  }

  /* 3. FASE CLUE ROUND */
  if (view.phase === "CLUE_ROUND") {
    const isMyTurn = view.currentTurnPlayerId === view.me.id;
    const activeTurnPlayer = view.currentTurnPlayerId
      ? playerById.get(view.currentTurnPlayerId)
      : null;
    const roundClues = view.clues.filter((c) => c.round === view.round);
    const pastClues = view.clues.filter((c) => c.round < view.round);

    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        <GamePanel title={`Ronde ${view.round} · Beri Clue`} ribbonColor="cyan">
          {roleSummaryStrip}
          {/* Quick Peek My Word Bar */}
          <div className="mb-3 flex items-center justify-between rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] px-3 py-2">
            <div className="text-xs font-extrabold text-[#6e6049]">
              {peekWord
                ? view.me.knownRole === "mr_blank"
                  ? "Role: Mr. Blank (Tanpa Kata)"
                  : `Katamu: "${view.me.word}"`
                : "Lupa kata rahasiamu?"}
            </div>
            <button
              type="button"
              {...holdPeekHandlers}
              className="font-display inline-flex cursor-pointer select-none touch-none items-center gap-1 rounded-xl bg-[#fffdf0] px-2.5 py-1 text-xs font-bold text-[#5c1632] shadow-sm"
            >
              {peekWord ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              Tahan Intip
            </button>
          </div>

          {/* Turn Order Strip */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {view.turnOrder.map((pid, idx) => {
              const p = playerById.get(pid);
              if (!p) return null;
              const isCurrent = pid === view.currentTurnPlayerId;
              const hasClue = roundClues.some((c) => c.playerId === pid);
              return (
                <div
                  key={pid}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-extrabold transition",
                    isCurrent
                      ? "scale-105 border-[#e0326a] bg-[#ffe694] text-[#5c1632] shadow"
                      : hasClue
                        ? "border-[#64cf36] bg-[#ebffd9] text-[#1d6321]"
                        : "border-[#d8cfa3] bg-[#fffdf0] text-[#7a6d54]",
                  ].join(" ")}
                >
                  <span className="opacity-65">{idx + 1}.</span>
                  <span>{p.nickname}</span>
                  {hasClue && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
              );
            })}
          </div>

          {/* Active Turn Box */}
          {isMyTurn ? (
            <div className="mb-4 rounded-2xl border-3 border-[#e0326a] bg-[#fff7d6] p-3.5">
              <div className="font-display mb-2 flex items-center justify-between text-base font-bold text-[#5c1632]">
                <span>Giliranmu Memberi Clue!</span>
                {remainingSec !== null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#e0326a] px-2.5 py-0.5 text-xs text-white">
                    <Clock className="h-3.5 w-3.5" /> {remainingSec}d
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={120}
                  autoFocus
                  placeholder="Ketik 1 clue singkat tanpa sebut kata aslinya..."
                  value={clueInput}
                  onChange={(e) => setClueInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendClue();
                  }}
                  className="flex-1 rounded-xl border-2 border-[#cfc595] bg-[#fffdf0] px-3 py-2 text-sm font-bold text-[#3d2940] outline-none focus:border-[#e0326a]"
                />
                <GameButton
                  variant="yellow"
                  size="sm"
                  disabled={!clueInput.trim()}
                  onClick={handleSendClue}
                >
                  <Send className="h-4 w-4" />
                  Kirim
                </GameButton>
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] px-4 py-3 text-center text-sm font-extrabold text-[#5c4e3d]">
              Menunggu <strong>{activeTurnPlayer?.nickname ?? "..."}</strong> mengetik clue
              {remainingSec !== null ? ` (${remainingSec}d)` : ""}...
            </div>
          )}

          {/* Clues Submitted This Round */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#786b51]">
              <MessageSquareText className="h-3.5 w-3.5" /> Clue Ronde {view.round}
            </div>
            {roundClues.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-[#d8cfa3] py-4 text-center text-xs font-bold text-[#8a7d63]">
                Belum ada clue di ronde ini.
              </div>
            ) : (
              <div className="space-y-1.5">
                {roundClues.map((entry, i) => {
                  const p = playerById.get(entry.playerId);
                  return (
                    <div
                      key={`${entry.round}-${entry.playerId}-${i}`}
                      className="flex items-center gap-2.5 rounded-2xl border-2 border-[#d8cfa3] bg-[#fffdf0] px-3 py-2"
                    >
                      {p && <AvatarBadge avatar={p.avatar} size="sm" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-extrabold text-[#786b51]">
                          {p?.nickname ?? "Pemain"}
                        </div>
                        <div className="text-sm font-extrabold text-[#3d2940]">“{entry.clue}”</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {pastClues.length > 0 && (
              <details className="pt-2">
                <summary className="cursor-pointer text-xs font-extrabold text-[#6540bb]">
                  Lihat clue ronde sebelumnya ({pastClues.length})
                </summary>
                <div className="mt-2 space-y-1">
                  {pastClues.map((entry, i) => {
                    const p = playerById.get(entry.playerId);
                    return (
                      <div
                        key={`past-${i}`}
                        className="rounded-xl bg-[#ebe4be] px-3 py-1.5 text-xs font-bold text-[#5c4e3d]"
                      >
                        <span className="opacity-70">R{entry.round} · </span>
                        <strong>{p?.nickname}:</strong> “{entry.clue}”
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        </GamePanel>
      </div>
    );
  }

  /* 4. FASE VOTING (Terbuka vs Rahasia + Unlimited/30s/60s/120s + Skip Vote) */
  if (view.phase === "VOTING") {
    const isOpen = view.config.voteMode === "open";
    const isFaceToFace = view.config.clueDurationSec === 0;
    const roundClues = view.clues.filter((c) => c.round === view.round);
    const isSkipSelected = view.me.myVote === SKIP_VOTE_TARGET;
    const skipVoters =
      isOpen && view.liveVotes
        ? Object.entries(view.liveVotes)
            .filter(([, target]) => target === SKIP_VOTE_TARGET)
            .map(([voterId]) => playerById.get(voterId))
            .filter(Boolean)
        : [];

    return (
      <div className="mx-auto w-full max-w-xl">
        <GamePanel title={`Ronde ${view.round} · Voting`} ribbonColor="pink">
          {roleSummaryStrip}

          {/* Quick Peek & Speaking Order when playing face-to-face (clueDurationSec = 0) */}
          {isFaceToFace && (
            <div className="mb-3 space-y-2 rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-[#6e6049]">
                  {peekWord
                    ? view.me.knownRole === "mr_blank"
                      ? "Role: Mr. Blank (Tanpa Kata)"
                      : `Katamu: "${view.me.word}"`
                    : "Mode Tatap Muka · Lupa kata rahasiamu?"}
                </div>
                <button
                  type="button"
                  {...holdPeekHandlers}
                  className="font-display inline-flex cursor-pointer select-none touch-none items-center gap-1 rounded-xl border border-[#d8cfa3] bg-[#fffdf0] px-2.5 py-1 text-xs font-bold text-[#5c1632]"
                >
                  {peekWord ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  Tahan Intip
                </button>
              </div>
              {view.turnOrder.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 text-[11px] font-extrabold text-[#786b51]">
                  <span>Urutan bicara:</span>
                  {view.turnOrder.map((pid, idx) => {
                    const p = playerById.get(pid);
                    if (!p) return null;
                    return (
                      <span
                        key={pid}
                        className="rounded-full bg-[#ebe4be] px-2 py-0.5 text-[#3d2940]"
                      >
                        {idx + 1}. {p.nickname}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Mode & Timer Banner */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] px-3.5 py-2 text-xs font-extrabold text-[#5c1632]">
            <span className="inline-flex items-center gap-1">
              {isOpen ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Mode: {isOpen ? "Terbuka" : "Rahasia"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Vote className="h-4 w-4" />
              {view.votedPlayerIds.length}/{alivePlayers.length} sudah vote
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {remainingSec === null ? "Unlimited" : `${remainingSec}d`}
            </span>
          </div>

          {!view.me.alive && (
            <div className="mb-4 rounded-2xl border-2 border-[#c8bf94] bg-[#ebe4be] p-3 text-center text-xs font-extrabold text-[#6e6049]">
              Kamu sudah tereliminasi — tonton hasil voting dari kursi penonton.
            </div>
          )}

          {/* Candidate Cards */}
          <div className="space-y-2.5">
            {alivePlayers.map((p) => {
              const isMe = p.id === view.me.id;
              const isSelected = view.me.myVote === p.id;
              const clue = roundClues.find((c) => c.playerId === p.id)?.clue;
              const hasVoted = view.votedPlayerIds.includes(p.id);
              const votersForCandidate =
                isOpen && view.liveVotes
                  ? Object.entries(view.liveVotes)
                      .filter(([, target]) => target === p.id)
                      .map(([voterId]) => playerById.get(voterId))
                      .filter(Boolean)
                  : [];

              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!view.me.alive || isMe}
                  onClick={() => onAction("CAST_VOTE", { targetPlayerId: p.id })}
                  className={[
                    "flex w-full flex-col gap-2 rounded-2xl border-3 p-3 text-left transition",
                    isSelected
                      ? "border-[#e0326a] bg-[#ffe3ec] shadow-[0_4px_0_#e0326a]"
                      : "border-[#d8cfa3] bg-[#fffdf0] hover:border-[#f0932b]",
                    !view.me.alive || isMe ? "cursor-default opacity-80" : "cursor-pointer",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AvatarBadge avatar={p.avatar} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-base font-extrabold text-[#3d2940]">
                          <span className="truncate">{p.nickname}</span>
                          {isMe && (
                            <span className="rounded-md bg-[#ebe4be] px-1.5 py-0.5 text-[10px] text-[#786b51]">
                              Kamu
                            </span>
                          )}
                        </div>
                        {clue && (
                          <div className="truncate text-xs font-bold text-[#786b51]">
                            Clue: “{clue}”
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {hasVoted && (
                        <span className="rounded-full bg-[#dff9d8] px-2 py-0.5 text-[10px] font-extrabold text-[#1c6622]">
                          Sudah vote
                        </span>
                      )}
                      {isSelected && (
                        <span className="font-display rounded-full bg-[#e0326a] px-2.5 py-1 text-xs font-bold text-white">
                          Dipilih ✓
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Open Vote Mode: show live voters under candidate */}
                  {isOpen && votersForCandidate.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 border-t border-[#e8dfb6] pt-2">
                      <span className="text-[11px] font-extrabold text-[#b82052]">
                        Voter ({votersForCandidate.length}):
                      </span>
                      {votersForCandidate.map((voter) => (
                        <span
                          key={voter!.id}
                          className="rounded-full bg-[#fff2cc] px-2 py-0.5 text-[11px] font-extrabold text-[#5c1632]"
                        >
                          {voter!.nickname}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}

            {/* Skip Vote Option */}
            <button
              type="button"
              disabled={!view.me.alive}
              onClick={() => onAction("CAST_VOTE", { targetPlayerId: SKIP_VOTE_TARGET })}
              className={[
                "flex w-full flex-col gap-2 rounded-2xl border-3 border-dashed p-3 text-left transition",
                isSkipSelected
                  ? "border-[#17a3db] bg-[#e6f9ff] shadow-[0_4px_0_#17a3db]"
                  : "border-[#c8bf94] bg-[#ebe4be] hover:border-[#17a3db] hover:bg-[#f2f9fc]",
                !view.me.alive ? "cursor-default opacity-70" : "cursor-pointer",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-gradient-to-b from-[#53ecff] to-[#1199e8] text-white shadow-sm">
                    <SkipForward className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-display text-base font-bold text-[#1c3554]">
                      Skip Voting
                    </div>
                    <div className="text-xs font-bold text-[#5e738c]">
                      Jangan eliminasi siapa pun di ronde ini
                    </div>
                  </div>
                </div>

                {isSkipSelected && (
                  <span className="font-display shrink-0 rounded-full bg-[#17a3db] px-2.5 py-1 text-xs font-bold text-white">
                    Dipilih ✓
                  </span>
                )}
              </div>

              {isOpen && skipVoters.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 border-t border-[#d6e7f0] pt-2">
                  <span className="text-[11px] font-extrabold text-[#126996]">
                    Voter ({skipVoters.length}):
                  </span>
                  {skipVoters.map((voter) => (
                    <span
                      key={voter!.id}
                      className="rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold text-[#1c3554]"
                    >
                      {voter!.nickname}
                    </span>
                  ))}
                </div>
              )}
            </button>
          </div>
        </GamePanel>
      </div>
    );
  }

  /* 5. FASE MR. BLANK GUESS */
  if (view.phase === "MR_BLANK_GUESS") {
    const isMeMrBlank = view.mrBlankGuessPlayerId === view.me.id;
    const mrBlankPlayer = view.mrBlankGuessPlayerId
      ? playerById.get(view.mrBlankGuessPlayerId)
      : null;

    return (
      <div className="mx-auto w-full max-w-md">
        <GamePanel title="Kesempatan Mr. Blank!" ribbonColor="purple">
          <div className="mb-4 text-center">
            <div className="mb-2 flex justify-center">
              {mrBlankPlayer && <AvatarBadge avatar={mrBlankPlayer.avatar} size="lg" />}
            </div>
            <div className="font-display text-xl font-bold text-[#5828b5]">
              {mrBlankPlayer?.nickname ?? "Pemain"} adalah Mr. Blank!
            </div>
            <p className="mt-1 text-sm font-bold text-[#6e6049]">
              Jika berhasil menebak <strong>kata Citizen</strong>, Mr. Blank langsung menang!
            </p>
            {remainingSec !== null && (
              <div className="font-display mt-2 inline-flex items-center gap-1 rounded-full bg-[#e0326a] px-3 py-1 text-sm font-bold text-white">
                <Clock className="h-4 w-4" /> Sisa {remainingSec} detik
              </div>
            )}
          </div>

          {isMeMrBlank ? (
            <div className="space-y-3">
              <input
                type="text"
                maxLength={60}
                autoFocus
                placeholder="Ketik tebakan kata Citizen..."
                value={mrBlankGuess}
                onChange={(e) => setMrBlankGuess(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleMrBlankGuess();
                }}
                className="w-full rounded-2xl border-3 border-[#7442e8] bg-[#fffdf0] px-4 py-3 text-center text-lg font-extrabold text-[#3d2940] outline-none"
              />
              <GameButton
                variant="yellow"
                size="lg"
                fullWidth
                disabled={!mrBlankGuess.trim()}
                onClick={handleMrBlankGuess}
              >
                <Sparkles className="h-5 w-5" />
                Kunci Tebakan!
              </GameButton>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[#a982f5] bg-[#f4ecff] py-4 text-center text-sm font-extrabold text-[#5828b5]">
              Menunggu {mrBlankPlayer?.nickname ?? "Mr. Blank"} mengetik tebakannya...
            </div>
          )}
        </GamePanel>
      </div>
    );
  }

  /* 6. FASE GAME OVER */
  const winnerTeam = view.winner?.winnerTeam ?? "citizen";
  const winnerTitle =
    winnerTeam === "citizen"
      ? "Tim Citizen Menang!"
      : winnerTeam === "undercover"
        ? "Tim Undercover Menang!"
        : "Mr. Blank Menang!";

  return (
    <div className="mx-auto w-full max-w-xl">
      <GamePanel title={winnerTitle} ribbonColor="pink">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-b from-[#ffe259] to-[#f4900c] text-white shadow-lg">
            <Trophy className="h-9 w-9" />
          </div>
          <p className="text-sm font-extrabold text-[#5c1632]">{view.winner?.reason}</p>
        </div>

        {/* Word Reveal Cards */}
        {view.revealSummary && (
          <div
            className={`mb-4 grid gap-2.5 ${view.revealSummary.undercoverWord ? "grid-cols-2" : "grid-cols-1"}`}
          >
            <div className="rounded-2xl border-2 border-[#78d465] bg-[#ecffd9] p-3 text-center">
              <div className="text-[11px] font-extrabold uppercase text-[#1a662b]">
                Kata Citizen
              </div>
              <div className="font-display text-xl font-bold text-[#144a1f]">
                {view.revealSummary.citizenWord ?? "-"}
              </div>
            </div>
            {view.revealSummary.undercoverWord && (
              <div className="rounded-2xl border-2 border-[#f26b99] bg-[#ffe3ec] p-3 text-center">
                <div className="text-[11px] font-extrabold uppercase text-[#b81d52]">
                  Kata Undercover
                </div>
                <div className="font-display text-xl font-bold text-[#7d1137]">
                  {view.revealSummary.undercoverWord}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom Word Pool Status */}
        {view.config.wordMode === "custom" && (
          <div className="mb-4 rounded-2xl border-2 border-[#a982f5] bg-[#f4ecff] px-3 py-2 text-center text-xs font-extrabold text-[#5828b5]">
            {view.customPoolRemaining > 0
              ? `Pool Custom Word masih tersisa ${view.customPoolRemaining} pasang kata untuk ronde berikutnya!`
              : "Semua pasangan Custom Word sudah terpakai — ronde berikutnya semua pemain input 1 pasang kata baru!"}
          </div>
        )}

        {/* All Players Reveal */}
        <div className="mb-5 space-y-2">
          {view.players.map((p) => {
            const roleMeta = p.revealedRole ? ROLE_BADGE[p.revealedRole] : null;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-2xl border-2 border-[#d8cfa3] bg-[#fffdf0] px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <AvatarBadge avatar={p.avatar} size="sm" dimmed={!p.alive} />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#3d2940]">
                      <span>{p.nickname}</span>
                      {!p.alive && <Skull className="h-3.5 w-3.5 text-[#8a7d63]" />}
                    </div>
                    <div className="text-xs font-bold text-[#786b51]">
                      Kata: <strong>{p.revealedWord ?? "(Kosong)"}</strong>
                    </div>
                  </div>
                </div>
                {roleMeta && (
                  <span
                    className={`font-display rounded-full border-2 px-2.5 py-0.5 text-xs font-bold ${roleMeta.cls}`}
                  >
                    {roleMeta.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Post-game actions */}
        {isHost ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <GameButton variant="yellow" size="md" fullWidth onClick={onPlayAgain}>
              <Play className="h-5 w-5 fill-current" />
              Main Lagi!
            </GameButton>
            <GameButton variant="cyan" size="md" fullWidth onClick={onReturnLobby}>
              <RotateCcw className="h-5 w-5" />
              Kembali ke Lobby
            </GameButton>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-[#c8bf94] bg-[#ebe4be] py-3 text-center text-sm font-extrabold text-[#6e6049]">
            Menunggu Host memulai ronde berikutnya atau kembali ke Lobby...
          </div>
        )}
      </GamePanel>
    </div>
  );
}
