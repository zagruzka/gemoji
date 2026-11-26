import {
  UNO_COLORS,
  type UnoCard,
  type UnoCardColor,
  type UnoColor,
  type UnoPlayerView,
} from "@gemoji/game-uno";
import {
  AlertTriangleIcon,
  BanIcon,
  ClockIcon,
  Grid2X2Icon,
  MegaphoneIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SkipForwardIcon,
  TrophyIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AvatarBadge, GameButton, GamePanel } from "../../components/game-ui";

function UnoBackLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "relative flex select-none items-center justify-center",
        compact ? "h-12 w-12" : "h-14 w-16",
      ].join(" ")}
    >
      <span
        className={[
          "absolute rotate-25 rounded-full bg-red-600",
          compact ? "h-13 w-8" : "h-16 w-10",
        ].join(" ")}
      />
      <span
        className={[
          "font-display relative z-10 -rotate-12 font-black italic tracking-tight text-yellow-400 [text-shadow:-2px_2px_0_#1a0d1c,1px_-1px_0_#1a0d1c,0_3px_5px_rgba(0,0,0,0.5)]",
          compact ? "text-base" : "text-3xl",
        ].join(" ")}
      >
        UNO
      </span>
    </span>
  );
}

interface UnoBoardProps {
  view: UnoPlayerView;
  isHost: boolean;
  remainingSec: number | null;
  onlineById?: Record<string, boolean>;
  onAction: (actionType: string, data: unknown) => void;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
}

const COLOR_META: Record<
  UnoColor,
  {
    label: string;
    bg: string;
    border: string;
    mutedBg: string;
    mutedBorder: string;
    mutedText: string;
    pill: string;
    picker: string;
  }
> = {
  red: {
    label: "Merah",
    bg: "from-[#ff5a5f] to-[#d62839]",
    border: "border-[#991522]",
    mutedBg: "from-[#6b2429] to-[#47161a]",
    mutedBorder: "border-[#2e0c0f]",
    mutedText: "text-[#f2b8bc]/50",
    pill: "bg-[#e63946] text-white border-[#991522]",
    picker: "from-[#ff6b6b] to-[#d62839] border-[#991522]",
  },
  yellow: {
    label: "Kuning",
    bg: "from-[#ffe047] to-[#f4a800]",
    border: "border-[#b57300]",
    mutedBg: "from-[#735c1e] to-[#4d3c10]",
    mutedBorder: "border-[#302407]",
    mutedText: "text-[#f5dfa0]/50",
    pill: "bg-[#f4b400] text-[#4a2b00] border-[#b57300]",
    picker: "from-[#ffe55c] to-[#f0a500] border-[#b57300]",
  },
  green: {
    label: "Hijau",
    bg: "from-[#5cd85a] to-[#249a3f]",
    border: "border-[#146627]",
    mutedBg: "from-[#22542b] to-[#14381b]",
    mutedBorder: "border-[#0b210f]",
    mutedText: "text-[#b6e6be]/75",
    pill: "bg-[#2ea44f] text-white border-[#146627]",
    picker: "from-[#6be068] to-[#249a3f] border-[#146627]",
  },
  blue: {
    label: "Biru",
    bg: "from-[#4dc3ff] to-[#1a75e8]",
    border: "border-[#0e4999]",
    mutedBg: "from-[#1d456b] to-[#112c47]",
    mutedBorder: "border-[#081a2c]",
    mutedText: "text-[#b8dcfa]/75",
    pill: "bg-[#1d8cf8] text-white border-[#0e4999]",
    picker: "from-[#5ccaff] to-[#1a75e8] border-[#0e4999]",
  },
};

const COLOR_SORT_ORDER: Record<UnoCardColor, number> = {
  red: 0,
  yellow: 1,
  green: 2,
  blue: 3,
  wild: 4,
};

function renderCardSymbol(value: UnoCard["value"], large = false) {
  const iconCls = large ? "size-8 stroke-[2.75]" : "size-6 stroke-[2.75]";
  if (value === "skip") return <BanIcon className={iconCls} />;
  if (value === "reverse") return <RefreshCwIcon className={iconCls} />;
  if (value === "draw2") return <span className={large ? "text-3xl" : "text-2xl"}>+2</span>;
  if (value === "wild4") return <span className={large ? "text-3xl" : "text-2xl"}>+4</span>;
  if (value === "wild") return <Grid2X2Icon className={iconCls + ' rotate-45'} />;
  return <span className={large ? "text-4xl" : "text-3xl"}>{value}</span>;
}

function renderCornerSymbol(value: UnoCard["value"], large = false) {
  const iconCls = large ? "size-4 stroke-[3]" : "size-3.5 stroke-[3]";
  if (value === "skip") return <BanIcon className={iconCls} />;
  if (value === "reverse") return <RefreshCwIcon className={iconCls} />;
  if (value === "wild") return <Grid2X2Icon className={iconCls + ' rotate-45'} />;
  if (value === "draw2") return "+2";
  if (value === "wild4") return "+4";
  return value;
}

interface UnoCardTileProps {
  card: UnoCard;
  size?: "md" | "lg";
  playable?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  unplayable?: boolean;
  zIndex?: number;
  enterDelay?: number;
  className?: string;
  buttonRef?: (el: HTMLButtonElement | null) => void;
  onClick?: () => void;
}

function UnoCardTile({
  card,
  size = "md",
  playable = false,
  selected = false,
  highlighted = false,
  unplayable = false,
  zIndex,
  enterDelay,
  className = "",
  buttonRef,
  onClick,
}: UnoCardTileProps) {
  const isWild = card.color === "wild";
  const colorStyle =
    card.color === "wild"
      ? unplayable
        ? "from-[#2e2a38] via-[#211e29] to-[#15131a] border-[#0b090f]"
        : "from-[#2d2240] via-[#1c1528] to-[#120d1a] border-[#09060d]"
      : unplayable
        ? `${COLOR_META[card.color].mutedBg} ${COLOR_META[card.color].mutedBorder}`
        : `${COLOR_META[card.color].bg} ${COLOR_META[card.color].border}`;

  const textColor =
    card.color === "wild"
      ? unplayable
        ? "text-white/55"
        : "text-white"
      : unplayable
        ? COLOR_META[card.color].mutedText
        : card.color === "yellow"
          ? "text-[#4a2b00]"
          : "text-white";

  const corner = renderCornerSymbol(card.value, size === "lg");
  const dims = size === "lg" ? "h-32 w-22 rounded-2xl" : "h-26 w-18 rounded-xl";
  const cornerTextSize = size === "lg" ? "text-lg" : "text-base";
  const hasEnteredRef = useRef(enterDelay === undefined);

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      disabled={!onClick}
      onClick={onClick}
      style={zIndex !== undefined ? { zIndex } : undefined}
      initial={enterDelay !== undefined ? { opacity: 0, y: -26, scale: 0.82 } : false}
      animate={selected ? { opacity: 1, y: -18, scale: 1.06 } : { opacity: 1, y: 0, scale: 1 }}
      onAnimationComplete={() => {
        hasEnteredRef.current = true;
      }}
      whileHover={onClick && !selected ? { y: -6 } : undefined}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      transition={{
        type: "spring",
        stiffness: 460,
        damping: 26,
        delay: hasEnteredRef.current ? 0 : (enterDelay ?? 0),
      }}
      className={[
        "font-display relative flex shrink-0 select-none flex-col items-center justify-center overflow-hidden border-[3px] bg-gradient-to-b font-semibold shadow-[0_5px_0_rgba(0,0,0,0.28)] transition-[box-shadow,border-color]",
        dims,
        colorStyle,
        textColor,
        onClick ? "cursor-pointer" : "cursor-default",
        selected
          ? "ring-4 ring-[#55f5ff] shadow-[0_10px_18px_rgba(0,0,0,0.38)]"
          : playable
            ? "ring-2 ring-[#fff6a3]"
            : "",
        !selected && highlighted ? "ring-3 ring-[#55f5ff]" : "",
        className,
      ].join(" ")}
    >
      {/* Inner white frame */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0.5 rounded-[9px] border-2 ${unplayable ? "border-white/25" : "border-white/65"}`}
      />

      {/* Tilted UNO oval backdrop */}
      {isWild ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute h-16 w-12 rotate-25 rounded-full bg-[conic-gradient(#ff5a5f_0deg_90deg,#ffe047_90deg_180deg,#5cd85a_180deg_270deg,#4dc3ff_270deg_360deg)] shadow-inner ${unplayable ? "opacity-25 saturate-50" : "opacity-90"}`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute h-16 w-12 rotate-25 rounded-full ${unplayable ? "bg-white/10" : "bg-white/22"}`}
        />
      )}

      {/* Corner indices (round icons for skip/reverse matching center) */}
      <span
        className={`absolute left-1.5 top-1.5 z-10 flex items-center justify-center leading-none ${unplayable ? "" : "drop-shadow"} ${cornerTextSize}`}
      >
        {corner}
      </span>
      <span
        className={`absolute bottom-1.5 right-1.5 z-10 flex rotate-180 items-center justify-center leading-none ${unplayable ? "" : "drop-shadow"} ${cornerTextSize}`}
      >
        {corner}
      </span>

      {/* Center symbol */}
      <span
        className={[
          "relative z-10 flex items-center justify-center leading-none",
          unplayable ? "" : "drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)]",
        ].join(" ")}
      >
        {renderCardSymbol(card.value, size === "lg")}
      </span>
    </motion.button>
  );
}

function getCardOverlapClass(cardCount: number): string {
  switch (true) {
    case cardCount > 10:
      return "-ml-[50px]";
    case cardCount > 8:
      return "-ml-[45px]";
    case cardCount > 6:
      return "-ml-[40px]";
    case cardCount > 4:
      return "-ml-[30px]";
    default:
      return "";
  }
}

interface DrawFlyItem {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  toSelf: boolean;
  delay: number;
  rotateTo: number;
}

interface PlayFlyItem {
  id: string;
  card: UnoCard;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromSelf: boolean;
}

export function UnoBoard({
  view,
  isHost,
  remainingSec,
  onlineById,
  onAction,
  onPlayAgain,
  onReturnLobby,
}: UnoBoardProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [pendingWildCardId, setPendingWildCardId] = useState<string | null>(null);
  const [catchReadyForPlayerId, setCatchReadyForPlayerId] = useState<string | null>(null);
  const [drawFlies, setDrawFlies] = useState<DrawFlyItem[]>([]);
  const [playFlies, setPlayFlies] = useState<PlayFlyItem[]>([]);
  const [displayedTopDiscard, setDisplayedTopDiscard] = useState<UnoCard>(view.topDiscard);
  const [newHandDelayMap, setNewHandDelayMap] = useState<Record<string, number>>({});

  const deckRef = useRef<HTMLButtonElement | null>(null);
  const discardRef = useRef<HTMLDivElement | null>(null);
  const handBoxRef = useRef<HTMLDivElement | null>(null);
  const playerChipRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pendingSelfPlayRef = useRef<{ cardId: string; cx: number; cy: number } | null>(null);

  const prevCountsRef = useRef<Map<string, number> | null>(null);
  const prevTopDiscardRef = useRef<UnoCard | null>(null);
  const prevHandIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!view.me.isMyTurn || view.phase !== "PLAYING") {
      setPendingWildCardId(null);
      setSelectedCardId(null);
    }
    if (view.phase !== "PLAYING") {
      setDisplayedTopDiscard(view.topDiscard);
      setPlayFlies([]);
      setDrawFlies([]);
    }
  }, [view.me.isMyTurn, view.phase, view.topDiscard]);

  useEffect(() => {
    if (selectedCardId && !view.me.hand.some((c) => c.id === selectedCardId)) {
      setSelectedCardId(null);
    }
  }, [selectedCardId, view.me.hand]);

  // Munculkan tombol Dorr di pemain lain setelah delay 1 detik
  useEffect(() => {
    const targetId = view.unoVulnerablePlayerId;
    if (!targetId || targetId === view.me.id || view.phase !== "PLAYING") {
      setCatchReadyForPlayerId(null);
      return;
    }
    setCatchReadyForPlayerId(null);
    const timer = setTimeout(() => {
      setCatchReadyForPlayerId(targetId);
    }, 1000);
    return () => clearTimeout(timer);
  }, [view.unoVulnerablePlayerId, view.unoCatchableAt, view.me.id, view.phase]);

  // Detect Draw (Nx cards flying from Deck -> Hand/Player) & Play (1x real card flying from Hand/Player -> Discard)
  useEffect(() => {
    const prevCounts = prevCountsRef.current;
    const prevTopCard = prevTopDiscardRef.current;
    const prevHandIds = prevHandIdsRef.current;

    if (prevCounts && view.phase === "PLAYING") {
      // 1. Detect PLAY (top discard changed -> 1x real card flies from raised hand card / opponent to table discard)
      if (prevTopCard && prevTopCard.id !== view.topDiscard.id) {
        const discardRect = discardRef.current?.getBoundingClientRect();
        const prevMeCount = prevCounts.get(view.me.id) ?? view.me.hand.length;
        const myCardCount =
          view.players.find((p) => p.id === view.me.id)?.cardCount ?? view.me.hand.length;
        const playedByMe =
          pendingSelfPlayRef.current?.cardId === view.topDiscard.id ||
          myCardCount < prevMeCount;

        if (discardRect) {
          const toX = discardRect.left + discardRect.width / 2;
          const toY = discardRect.top + discardRect.height / 2;

          let fromX = toX;
          let fromY = playedByMe ? toY + 180 : toY - 130;

          if (playedByMe) {
            if (pendingSelfPlayRef.current) {
              fromX = pendingSelfPlayRef.current.cx;
              fromY = pendingSelfPlayRef.current.cy;
            } else {
              const handRect = handBoxRef.current?.getBoundingClientRect();
              if (handRect) {
                fromX = handRect.left + handRect.width / 2;
                fromY = handRect.top + handRect.height * 0.45;
              }
            }
          } else {
            const actor = view.players.find((p) => {
              const prev = prevCounts.get(p.id);
              return p.id !== view.me.id && prev !== undefined && p.cardCount < prev;
            });
            const chipRect = actor
              ? playerChipRefs.current.get(actor.id)?.getBoundingClientRect()
              : undefined;
            if (chipRect) {
              fromX = chipRect.left + chipRect.width / 2;
              fromY = chipRect.top + chipRect.height / 2;
            }
          }

          pendingSelfPlayRef.current = null;
          setDisplayedTopDiscard(prevTopCard);
          const playId = `play_${view.topDiscard.id}_${Date.now()}`;
          setPlayFlies((prev) => [
            ...prev.slice(-2),
            {
              id: playId,
              card: view.topDiscard,
              fromX,
              fromY,
              toX,
              toY,
              fromSelf: playedByMe,
            },
          ]);
        } else {
          pendingSelfPlayRef.current = null;
          setDisplayedTopDiscard(view.topDiscard);
        }
      }

      // 2. Detect DRAW (cardCount increased by delta -> delta x staggered cards flying from Deck -> Hand/Opponent)
      const deckRect = deckRef.current?.getBoundingClientRect();
      if (deckRect) {
        const fromX = deckRect.left + deckRect.width / 2;
        const fromY = deckRect.top + deckRect.height / 2;
        const newDraws: DrawFlyItem[] = [];
        let batchIndex = 0;

        for (const p of view.players) {
          const prevCount = prevCounts.get(p.id);
          if (prevCount !== undefined && p.cardCount > prevCount) {
            const delta = Math.min(p.cardCount - prevCount, 12);
            const toSelf = p.id === view.me.id;
            const targetRect = toSelf
              ? handBoxRef.current?.getBoundingClientRect()
              : playerChipRefs.current.get(p.id)?.getBoundingClientRect();

            const baseToX = targetRect
              ? targetRect.left + targetRect.width / 2
              : fromX;
            const baseToY = targetRect
              ? toSelf
                ? targetRect.top + targetRect.height * 0.58
                : targetRect.top + targetRect.height / 2
              : toSelf
                ? fromY + 190
                : fromY - 120;

            for (let i = 0; i < delta; i++) {
              const spread = toSelf ? (i - (delta - 1) / 2) * 18 : 0;
              newDraws.push({
                id: `draw_${p.id}_${Date.now()}_${batchIndex++}`,
                fromX,
                fromY,
                toX: baseToX + spread,
                toY: baseToY,
                toSelf,
                delay: i * 0.14,
                rotateTo: toSelf ? (i - (delta - 1) / 2) * 4 : -10,
              });
            }
          }
        }

        if (newDraws.length > 0) {
          setDrawFlies((prev) => [...prev.slice(-16), ...newDraws]);
        }
      }
    } else if (!prevTopCard) {
      setDisplayedTopDiscard(view.topDiscard);
    }

    // 3. Stagger entry animation for newly drawn cards in my hand (timed to land with flying cards)
    if (prevHandIds) {
      const addedCards = view.me.hand.filter((c) => !prevHandIds.has(c.id));
      if (addedCards.length > 0) {
        const delayMap: Record<string, number> = {};
        addedCards.forEach((c, i) => {
          delayMap[c.id] = 0.34 + i * 0.14;
        });
        setNewHandDelayMap(delayMap);
      } else {
        setNewHandDelayMap({});
      }
    }

    prevCountsRef.current = new Map(view.players.map((p) => [p.id, p.cardCount]));
    prevTopDiscardRef.current = view.topDiscard;
    prevHandIdsRef.current = new Set(view.me.hand.map((c) => c.id));
  }, [view.phase, view.players, view.topDiscard, view.me.id, view.me.hand]);

  const playerById = new Map(view.players.map((p) => [p.id, p]));
  const currentTurnPlayer = view.currentTurnPlayerId
    ? playerById.get(view.currentTurnPlayerId)
    : null;
  const vulnerablePlayer = view.unoVulnerablePlayerId
    ? playerById.get(view.unoVulnerablePlayerId)
    : null;
  const playableSet = new Set(view.me.playableCardIds);

  const sortedHand = [...view.me.hand].sort((a, b) => {
    const colorDiff = COLOR_SORT_ORDER[a.color] - COLOR_SORT_ORDER[b.color];
    if (colorDiff !== 0) return colorDiff;
    return a.value.localeCompare(b.value);
  });

  const selectedCard = selectedCardId
    ? view.me.hand.find((c) => c.id === selectedCardId) ?? null
    : null;
  const canPlaySelectedOnTable = Boolean(
    view.me.isMyTurn && selectedCard && playableSet.has(selectedCard.id) && !pendingWildCardId,
  );

  const snapshotCardOrigin = (cardId: string) => {
    const el = cardRefs.current.get(cardId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    pendingSelfPlayRef.current = {
      cardId,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    };
  };

  const handleCardClick = (card: UnoCard) => {
    setPendingWildCardId(null);
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));
  };

  const handleTableClickToPlay = () => {
    if (!canPlaySelectedOnTable || !selectedCard) return;
    if (selectedCard.color === "wild") {
      snapshotCardOrigin(selectedCard.id);
      setPendingWildCardId(selectedCard.id);
      return;
    }
    snapshotCardOrigin(selectedCard.id);
    onAction("PLAY_CARD", { cardId: selectedCard.id });
    setSelectedCardId(null);
  };

  const handlePickWildColor = (color: UnoColor) => {
    if (!pendingWildCardId) return;
    if (!pendingSelfPlayRef.current || pendingSelfPlayRef.current.cardId !== pendingWildCardId) {
      snapshotCardOrigin(pendingWildCardId);
    }
    onAction("PLAY_CARD", { cardId: pendingWildCardId, chosenColor: color });
    setPendingWildCardId(null);
    setSelectedCardId(null);
  };

  /* 1. GAME OVER */
  if (view.phase === "GAME_OVER") {
    const sortedPlayers = [...view.players].sort((a, b) => a.cardCount - b.cardCount);
    const winnerPlayer = view.winner?.winnerPlayerIds[0]
      ? playerById.get(view.winner.winnerPlayerIds[0])
      : sortedPlayers[0];

    return (
      <div className="mx-auto w-full max-w-xl">
        <GamePanel title={`${winnerPlayer?.nickname ?? "Pemain"} Menang!`} ribbonColor="pink">
          <div className="mb-4 text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-b from-[#ffe259] to-[#f4900c] text-white shadow-lg">
              <TrophyIcon className="h-9 w-9" />
            </div>
            <p className="text-sm font-extrabold text-[#5c1632]">{view.winner?.reason}</p>
          </div>

          <div className="mb-5 space-y-2">
            {sortedPlayers.map((p, idx) => {
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
                  <span className="font-display rounded-full border-2 border-[#d8cfa3] bg-[#ebe4be] px-3 py-0.5 text-xs font-bold text-[#5c1632]">
                    {p.cardCount === 0 ? "0 Kartu · Juara!" : `Sisa ${p.cardCount} kartu`}
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
              Menunggu Host memulai ronde baru atau kembali ke Lobby...
            </div>
          )}
        </GamePanel>
      </div>
    );
  }

  /* 2. ACTIVE UNO BOARD */
  const activeColorMeta = COLOR_META[view.activeColor];
  const recentLogs = [...view.logs].reverse().slice(0, 6);
  const overlapClass = getCardOverlapClass(sortedHand.length);
  const isCompactHand = sortedHand.length > 4;
  const mustDrawDeck =
    view.me.isMyTurn && view.me.canDraw && view.me.playableCardIds.length === 0;
  const mustSkip =
    view.me.isMyTurn && view.me.canPass && view.me.playableCardIds.length === 0;
  const showHandTurnOutline =
    view.me.isMyTurn &&
    !selectedCardId &&
    !pendingWildCardId &&
    !mustDrawDeck &&
    !mustSkip;

  const narratorText = view.me.isMyTurn
    ? canPlaySelectedOnTable
      ? "Klik meja untuk memainkan kartu"
      : view.pendingDraw > 0
        ? `Penalti +${view.pendingDraw}! Tumpuk ${view.pendingDrawType === "wild4" ? "+4" : "+2/+4"} atau klik Deck`
        : view.me.canPass
          ? view.me.playableCardIds.length > 0
            ? "Pilih kartu & klik meja, atau klik Skip"
            : "Tidak ada kartu cocok, klik Skip!"
          : view.me.playableCardIds.length > 0
            ? "Giliranmu! Angkat kartu lalu klik meja"
            : "Giliranmu! Tidak ada kartu cocok, klik Deck"
    : currentTurnPlayer && onlineById?.[currentTurnPlayer.id] === false
      ? `${currentTurnPlayer.nickname} sedang offline...`
      : `Menunggu giliran ${currentTurnPlayer?.nickname ?? "..."}...`;

  return (
    <div className="mx-auto w-full max-w-xl space-y-3">
      <GamePanel
        ribbonColor="pink"
        ribbonContent={
          <div className="flex w-full items-center justify-between gap-2">
            <p className="font-display flex-1 text-center text-sm font-bold leading-snug tracking-wide text-white drop-shadow-[0_2px_0_rgba(120,16,54,0.65)] sm:text-base">
              {narratorText}
            </p>
            {remainingSec !== null && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/50 bg-[#6d1839] px-2.5 py-0.5 text-xs font-extrabold text-white shadow-inner">
                <ClockIcon className="h-3.5 w-3.5" /> {remainingSec}d
              </span>
            )}
          </div>
        }
      >
        {/* Players & Turn Order Strip */}
        <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
          {view.turnOrder.map((pid) => {
            const p = playerById.get(pid);
            if (!p) return null;
            const isOffline = onlineById?.[pid] === false;
            const isCurrent = pid === view.currentTurnPlayerId;
            return (
              <div
                key={pid}
                ref={(el) => {
                  if (el) playerChipRefs.current.set(pid, el);
                  else playerChipRefs.current.delete(pid);
                }}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-extrabold transition",
                  isOffline
                    ? "border-dashed border-[#e0326a] bg-[#fff0f5] text-[#9b1342] opacity-80"
                    : isCurrent
                      ? "scale-105 border-[#e0326a] bg-[#ffe694] text-[#5c1632] shadow"
                      : "border-[#d8cfa3] bg-[#fffdf0] text-[#4e3e4d]",
                ].join(" ")}
              >
                <AvatarBadge avatar={p.avatar} size="xs" offline={isOffline} />
                <span>{p.nickname}</span>
                <span
                  className={[
                    "rounded-full px-1.5 py-0.2 text-[10px]",
                    p.cardCount === 1
                      ? "bg-[#e0326a] text-white"
                      : "bg-black/10 text-[#3d2940]",
                  ].join(" ")}
                >
                  {p.cardCount}
                </span>
                {p.unoDeclared && p.cardCount === 1 && (
                  <span className="font-display rounded-full bg-[#ffe047] px-1.5 text-[10px] font-bold text-[#5c1632]">
                    UNO!
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Direction & Active Color Info Bar */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] px-3 py-1.5 text-xs font-extrabold text-[#5c1632]">
          <span className="inline-flex items-center gap-1">
            <RefreshCwIcon
              className={`h-3.5 w-3.5 ${view.direction === -1 ? "-scale-x-100" : ""}`}
            />
            {view.direction === 1 ? "Searah" : "Berlawanan"}
          </span>

          <span
            className={`font-display inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${activeColorMeta.pill}`}
          >
            Warna: {activeColorMeta.label}
          </span>

          {view.config.stacking && (
            <span className="text-[11px] font-bold text-[#6e6049]">Stack +2/+4 ON</span>
          )}
        </div>

        {/* Center Play Table: Draw Pile + Discard Pile + Overlays (Zero ViewHeight Shift!) */}
        <div
          onClick={handleTableClickToPlay}
          className={[
            "relative mb-3 flex min-h-[214px] items-center justify-center gap-6 overflow-hidden rounded-3xl border-2 px-4 pb-11 pt-5 transition",
            canPlaySelectedOnTable
              ? "cursor-pointer border-transparent bg-[#fff5cc] outline-3 outline-dashed -outline-offset-3 outline-[#e0326a]"
              : "border-[#d8cfa3] bg-[#fffbe6]",
          ].join(" ")}
        >
          {/* Draw Pile */}
          <div
            className={`flex flex-col items-center gap-1.5 transition-opacity ${canPlaySelectedOnTable || mustSkip ? "opacity-35" : "opacity-100"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.button
              ref={deckRef}
              type="button"
              disabled={!view.me.canDraw}
              animate={
                mustDrawDeck && !canPlaySelectedOnTable
                  ? { scale: [1, 1.07] }
                  : { scale: 1 }
              }
              transition={
                mustDrawDeck && !canPlaySelectedOnTable
                  ? {
                    repeat: Infinity,
                    repeatType: "mirror",
                    duration: 0.9,
                    ease: "easeInOut",
                  }
                  : { duration: 0.15 }
              }
              whileHover={view.me.canDraw ? { y: -4, scale: 1.04 } : undefined}
              whileTap={view.me.canDraw ? { scale: 0.96 } : undefined}
              onClick={() => {
                setSelectedCardId(null);
                setPendingWildCardId(null);
                onAction("DRAW_CARD", {});
              }}
              className={[
                "font-display relative flex h-32 w-22 flex-col items-center justify-evenly rounded-2xl border-[3px] border-[#3d1736] bg-gradient-to-b from-[#6540bb] to-[#3f2087] text-white shadow-[0_6px_0_#271257] outline-none transition",
                mustDrawDeck
                  ? "cursor-pointer ring-4 ring-[#ffe047]"
                  : view.me.canDraw
                    ? "cursor-pointer ring-2 ring-[#ffe694]/80"
                    : "cursor-default opacity-75",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0.5 rounded-[10px] border-2 border-white/40"
              />
              <span></span>
              <UnoBackLogo />
              <span className="rounded-full bg-black/30 px-2 py-0.2 text-[10px]">
                {view.drawPileCount} kartu
              </span>
            </motion.button>
            <span
              className={`text-[11px] font-extrabold ${mustDrawDeck ? "text-[#c72258]" : "text-[#786b51]"}`}
            >
              {mustDrawDeck ? "Ketuk Deck!" : "Deck"}
            </span>
          </div>

          {/* Discard Pile */}
          <div
            className={`flex flex-col items-center gap-1.5 transition-opacity ${canPlaySelectedOnTable || mustDrawDeck || mustSkip ? "opacity-35" : "opacity-100"}`}
          >
            <div ref={discardRef}>
              <UnoCardTile card={displayedTopDiscard} size="lg" />
            </div>
            <span className="text-[11px] font-extrabold text-[#786b51]">Kartu Teratas</span>
          </div>

          {/* Full-Table Clickable Overlay when a playable card is raised (Never Blocked by Cards!) */}
          {canPlaySelectedOnTable && (
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleTableClickToPlay();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleTableClickToPlay();
                }
              }}
              className="absolute inset-0 z-[25] flex cursor-pointer items-center justify-center px-4"
            >
              <div className="font-display rounded-2xl border-2 border-[#e0326a] bg-[#fffdf0]/95 px-4 py-2 text-center text-sm font-bold text-[#c72258] shadow-lg">
                Klik meja untuk memainkan kartu
              </div>
            </div>
          )}

          {/* Bottom-Center Overlay: UNO!, Dorr! & Skip (Blue, No ViewHeight Shift) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-2.5 z-20 flex items-center justify-center gap-2 px-3">
            {view.me.canCallUno && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction("CALL_UNO", {});
                }}
                className="font-display pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-xl border-2 border-[#fff8a6] bg-gradient-to-b from-[#fff05a] to-[#ffae19] px-3 py-1.5 text-xs font-bold text-[#5c1632] shadow-[0_3px_0_#c9386b] transition hover:brightness-105 active:translate-y-0.5"
              >
                <MegaphoneIcon className="h-3.5 w-3.5" />
                UNO!
              </button>
            )}

            {vulnerablePlayer &&
              vulnerablePlayer.id !== view.me.id &&
              catchReadyForPlayerId === vulnerablePlayer.id && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction("CATCH_UNO", { targetPlayerId: vulnerablePlayer.id });
                  }}
                  className="font-display pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-xl border-2 border-[#ffb4ce] bg-gradient-to-b from-[#ff72a0] to-[#d4245f] px-2.5 py-1.5 text-xs font-bold text-white shadow-[0_3px_0_#8f143e] transition hover:brightness-105 active:translate-y-0.5"
                >
                  <AlertTriangleIcon className="h-3.5 w-3.5" />
                  DORRRR!
                </button>
              )}

            {view.me.canPass && (
              <motion.button
                type="button"
                animate={mustSkip ? { scale: [1, 1.12] } : { scale: 1 }}
                transition={
                  mustSkip
                    ? {
                      repeat: Infinity,
                      repeatType: "mirror",
                      duration: 0.9,
                      ease: "easeInOut",
                    }
                    : { duration: 0.15 }
                }
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCardId(null);
                  setPendingWildCardId(null);
                  onAction("PASS_TURN", {});
                }}
                className={[
                  "font-display pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-xl border-2 border-[#d5dce3] bg-gradient-to-b from-[#ffffff] to-[#eef2f6] px-3.5 py-1.5 text-xs font-bold text-[#3a424c] shadow-[0_3px_0_#9aa5b1] outline-none transition hover:brightness-105",
                  canPlaySelectedOnTable ? "opacity-35" : "opacity-100",
                  mustSkip ? "ring-4 ring-[#ffe047]" : "",
                ].join(" ")}
              >
                <SkipForwardIcon className="h-3.5 w-3.5" />
                Skip
              </motion.button>
            )}
          </div>

          {/* Wild Color Picker Overlay RIGHT ON TOP OF TABLE (No ViewHeight Shift) */}
          <AnimatePresence>
            {pendingWildCardId && (
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.14 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-3xl bg-[#201433]/92 p-4 backdrop-blur-[2px]"
              >
                <div className="font-display text-sm font-bold tracking-wide text-white">
                  Pilih Warna Kartu Wild
                </div>
                <div className="grid w-full max-w-xs grid-cols-2 gap-2">
                  {UNO_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handlePickWildColor(color)}
                      className={`font-display cursor-pointer rounded-xl border-2 bg-gradient-to-b py-2.5 text-sm font-bold shadow-md transition hover:brightness-105 active:translate-y-0.5 ${COLOR_META[color].picker} ${color === "yellow" ? "text-[#4a2b00]" : "text-white"}`}
                    >
                      {COLOR_META[color].label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPendingWildCardId(null)}
                  className="cursor-pointer text-xs font-extrabold text-white/80 underline hover:text-white"
                >
                  Batal
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* My Hand: Progressive Overlap + Dark Unplayable Colors + Dashed Turn Outline */}
        <div
          className={[
            "mb-4 rounded-2xl border-2 p-2.5 transition",
            showHandTurnOutline
              ? "border-transparent bg-[#f6ecd0] outline-3 outline-dashed -outline-offset-3 outline-[#e0326a]"
              : "border-[#d8cfa3] bg-[#ebe4be]",
          ].join(" ")}
        >
          <div className="relative z-0 mb-1 flex items-center justify-between text-[11px] font-extrabold text-[#6e6049]">
            <span>Kartu di Tanganmu ({view.me.hand.length})</span>
            <span className={view.me.isMyTurn ? "text-[#c72258]" : "text-[#8a7d63]"}>
              {view.me.isMyTurn
                ? `${view.me.playableCardIds.length} bisa dimainkan`
                : "Menunggu giliran"}
            </span>
          </div>
          <div
            ref={handBoxRef}
            className={[
              "relative z-10 -mt-5 flex items-end overflow-x-auto px-1 pb-1.5 pt-6",
              isCompactHand ? "justify-start" : "justify-center gap-1",
            ].join(" ")}
          >
            {sortedHand.map((card, idx) => {
              const playable = view.me.isMyTurn && playableSet.has(card.id);
              const isSelected = selectedCardId === card.id;
              const isDrawn = playable && view.me.drawnPlayableCardId === card.id;
              return (
                <UnoCardTile
                  key={card.id}
                  card={card}
                  playable={playable}
                  selected={isSelected}
                  highlighted={isDrawn}
                  unplayable={view.me.isMyTurn && !playable}
                  zIndex={isSelected ? 100 : idx + 1}
                  enterDelay={newHandDelayMap[card.id]}
                  className={idx > 0 ? overlapClass : ""}
                  buttonRef={(el) => {
                    if (el) cardRefs.current.set(card.id, el);
                    else cardRefs.current.delete(card.id);
                  }}
                  onClick={() => handleCardClick(card)}
                />
              );
            })}
          </div>
        </div>

        {/* Activity Log */}
        <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] p-2.5">
          <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-[#6e6049]">
            Log Permainan
          </div>
          <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className={[
                  "rounded-xl px-2.5 py-1 text-xs font-bold leading-snug",
                  log.type === "uno"
                    ? "border border-[#f0a500] bg-[#fff5cc] text-[#6b4400]"
                    : log.type === "catch"
                      ? "border border-[#f26b99] bg-[#ffe3ec] text-[#9b1342]"
                      : "bg-[#fffdf0] text-[#4e3e4d]",
                ].join(" ")}
              >
                {log.message}
              </div>
            ))}
          </div>
        </div>
      </GamePanel>

      {/* Viewport-Level Flying Card Overlay (Never Clipped by Table!) */}
      {(drawFlies.length > 0 || playFlies.length > 0) && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {/* Draw Animations: Nx staggered card backs flying from Deck -> Hand / Player */}
          {drawFlies.map((item) => (
            <motion.div
              key={item.id}
              initial={{
                x: item.fromX,
                y: item.fromY,
                scale: 1.05,
                rotate: -6,
                opacity: 0,
              }}
              animate={{
                x: [item.fromX, item.toX],
                y: [item.fromY, item.toY],
                scale: item.toSelf ? [1.05, 1] : [1.05, 0.42],
                rotate: [-6, item.rotateTo],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 0.48,
                delay: item.delay,
                ease: [0.22, 1, 0.36, 1],
                opacity: {
                  duration: 0.48,
                  delay: item.delay,
                  times: [0, 0.08, 0.82, 1],
                },
              }}
              onAnimationComplete={() => {
                setDrawFlies((prev) => prev.filter((d) => d.id !== item.id));
              }}
              className="fixed left-0 top-0 -ml-9 -mt-13 flex h-26 w-18 items-center justify-center rounded-xl border-[3px] border-[#3d1736] bg-gradient-to-b from-[#6540bb] to-[#3f2087] text-white shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
            >
              <span className="pointer-events-none absolute inset-1 rounded-[9px] border-2 border-white/40" />
              <UnoBackLogo compact />
            </motion.div>
          ))}

          {/* Play Animations: 1x real UNO card flying from raised hand card / opponent -> Discard Pile */}
          {playFlies.map((item) => (
            <motion.div
              key={item.id}
              initial={{
                x: item.fromX,
                y: item.fromY,
                scale: item.fromSelf ? 0.88 : 0.45,
                rotate: item.fromSelf ? -8 : 10,
                opacity: 1,
              }}
              animate={{
                x: item.toX,
                y: item.toY,
                scale: [item.fromSelf ? 0.88 : 0.45, 1.12, 1],
                rotate: 0,
                opacity: 1,
              }}
              transition={{
                duration: 0.44,
                ease: [0.22, 1, 0.36, 1],
              }}
              onAnimationComplete={() => {
                setDisplayedTopDiscard(item.card);
                setPlayFlies((prev) => prev.filter((p) => p.id !== item.id));
              }}
              className="fixed left-0 top-0 -ml-11 -mt-16 drop-shadow-[0_16px_24px_rgba(0,0,0,0.35)]"
            >
              <UnoCardTile card={item.card} size="lg" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
