import type { UndercoverPlayerView } from "@gemoji/game-undercover";
import type { UnoPlayerView } from "@gemoji/game-uno";
import type { WordtrapPlayerView } from "@gemoji/game-wordtrap";
import type {
  AvatarId,
  ChatChannel,
  ChatMessage,
  RoomPublicState,
  ServerMessage,
} from "@gemoji/shared";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ClockIcon,
  LogOutIcon,
  MessageCircleIcon,
  UsersIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AvatarBadge,
  AvatarPicker,
  GameButton,
  GamePanel,
  HudPill,
  IconButton,
  LowPolyBackground,
  type ToastTone,
} from "../components/game-ui";
import { ChatDrawer } from "../features/chat/ChatDrawer";
import {
  loadGuestProfile,
  randomAvatar,
  saveGuestProfile,
  type GuestProfile,
} from "../features/connection/profile";
import { useCountdown } from "../features/connection/useCountdown";
import { useGameSocket } from "../features/connection/useGameSocket";
import { LobbyView } from "../features/lobby/LobbyView";
import { GAME_UI_CATALOG, saveSelectedGameId } from "../games/registry";
import { UndercoverBoard } from "../games/undercover/UndercoverBoard";
import { UnoBoard } from "../games/uno/UnoBoard";
import { WordtrapBoard } from "../games/wordtrap/WordtrapBoard";

interface RoomPageProps {
  roomCode: string;
  onExitHome: () => void;
  onNotify: (message: string, tone?: ToastTone) => void;
}

export function RoomPage({ roomCode, onExitHome, onNotify }: RoomPageProps) {
  const [profile, setProfile] = useState<GuestProfile | null>(() => loadGuestProfile());
  const [draftNickname, setDraftNickname] = useState("");
  const [draftAvatar, setDraftAvatar] = useState<AvatarId>(() => randomAvatar());

  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [gameView, setGameView] = useState<{ gameId: string; view: unknown } | null>(null);
  const [phaseEndsAt, setPhaseEndsAt] = useState<number | null>(null);
  const [allowedChannels, setAllowedChannels] = useState<ChatChannel[]>(["lobby"]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatBubble, setChatBubble] = useState<ChatMessage | null>(null);
  const [roomMissing, setRoomMissing] = useState(false);
  const [wordsLoaded, setWordsLoaded] = useState<number | null>(null);
  const [wordtrapWordsLoaded, setWordtrapWordsLoaded] = useState<number | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;
  const myPlayerIdRef = useRef(myPlayerId);
  myPlayerIdRef.current = myPlayerId;
  const chatBubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRoundResultKeyRef = useRef<string | null>(null);
  const lastMrBlankGuessKeyRef = useRef<string | null>(null);
  const lastWordtrapLogIdRef = useRef<string | null>(null);
  const lastUnoLogIdRef = useRef<string | null>(null);
  const prevRoomPlayersRef = useRef<Map<string, { nickname: string; isConnected: boolean }> | null>(null);

  // Check if room exists on mount
  useEffect(() => {
    fetch(`/api/rooms/${roomCode}`)
      .then((res) => {
        if (!res.ok) setRoomMissing(true);
      })
      .catch(() => {
        // Let WebSocket handle reconnect errors
      });
  }, [roomCode]);

  // Fetch word library counts when inside Undercover or Wordtrap room
  useEffect(() => {
    if (
      (room?.gameId !== "undercover" && room?.gameId !== "wordtrap") ||
      (room.gameId === "undercover" && wordsLoaded !== null) ||
      (room.gameId === "wordtrap" && wordtrapWordsLoaded !== null)
    ) {
      return;
    }
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { wordsLoaded?: number; wordtrapWordsLoaded?: number } | null) => {
        if (typeof data?.wordsLoaded === "number") {
          setWordsLoaded(data.wordsLoaded);
        }
        if (typeof data?.wordtrapWordsLoaded === "number") {
          setWordtrapWordsLoaded(data.wordtrapWordsLoaded);
        }
      })
      .catch(() => { });
  }, [room?.gameId, wordsLoaded, wordtrapWordsLoaded]);

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "SESSION_READY":
        setMyPlayerId(msg.payload.playerId);
        break;

      case "ROOM_STATE": {
        const nextPlayers = msg.payload.players;
        const prevMap = prevRoomPlayersRef.current;
        if (prevMap) {
          const nextIds = new Set(nextPlayers.map((p) => p.id));
          for (const [prevId, prevInfo] of prevMap.entries()) {
            if (prevId !== myPlayerIdRef.current && !nextIds.has(prevId)) {
              onNotify(`${prevInfo.nickname} keluar dari room.`, "info");
            }
          }
          for (const p of nextPlayers) {
            if (p.id === myPlayerIdRef.current) continue;
            const prevInfo = prevMap.get(p.id);
            if (prevInfo && prevInfo.isConnected && !p.isConnected) {
              onNotify(`${p.nickname} sedang offline.`, "error");
            } else if (prevInfo && !prevInfo.isConnected && p.isConnected) {
              onNotify(`${p.nickname} kembali online.`, "success");
            }
          }
        }
        prevRoomPlayersRef.current = new Map(
          nextPlayers.map((p) => [p.id, { nickname: p.nickname, isConnected: p.isConnected }]),
        );

        setRoom(msg.payload);
        saveSelectedGameId(msg.payload.gameId);
        if (msg.payload.status === "LOBBY") {
          setGameView(null);
          setPhaseEndsAt(null);
          setAllowedChannels(["lobby"]);
          lastWordtrapLogIdRef.current = null;
          lastUnoLogIdRef.current = null;
        }
        break;
      }

      case "GAME_STATE_VIEW": {
        const gameId = msg.payload.gameId;
        setGameView({ gameId, view: msg.payload.view });
        setPhaseEndsAt(msg.payload.phaseEndsAt);
        setAllowedChannels(msg.payload.allowedChatChannels);

        if (gameId === "wordtrap") {
          const wtView = msg.payload.view as WordtrapPlayerView;
          const latestLog = wtView.logs[wtView.logs.length - 1];
          if (latestLog && latestLog.id !== lastWordtrapLogIdRef.current) {
            lastWordtrapLogIdRef.current = latestLog.id;
            if (latestLog.type === "trap_expired" || latestLog.type === "trap_busted") {
              onNotify(latestLog.message, "info");
            } else if (latestLog.type === "guess_correct") {
              onNotify(latestLog.message, "success");
            } else if (latestLog.type === "guess_wrong") {
              onNotify(latestLog.message, "error");
            }
          }
          break;
        }

        if (gameId === "uno") {
          const unoView = msg.payload.view as UnoPlayerView;
          const latestLog = unoView.logs[unoView.logs.length - 1];
          if (latestLog && latestLog.id !== lastUnoLogIdRef.current) {
            lastUnoLogIdRef.current = latestLog.id;
            if (latestLog.type === "uno") {
              onNotify(latestLog.message, "info");
            } else if (latestLog.type === "catch") {
              onNotify(latestLog.message, "error");
            }
          }
          break;
        }

        const nextView = msg.payload.view as UndercoverPlayerView;

        // Reset round result tracker when starting fresh round 1 without elimination
        if (!nextView.lastElimination) {
          lastRoundResultKeyRef.current = null;
          lastMrBlankGuessKeyRef.current = null;
        } else {
          const elim = nextView.lastElimination;
          const elimKey = `${elim.round}:${elim.reason}:${elim.eliminatedPlayerId ?? "none"}`;
          if (lastRoundResultKeyRef.current !== elimKey) {
            lastRoundResultKeyRef.current = elimKey;
            if (elim.reason === "skipped") {
              onNotify(`Ronde ${elim.round}: Voting memilih Skip — tidak ada yang tereliminasi.`, "info");
            } else if (elim.reason === "tie") {
              onNotify(`Ronde ${elim.round}: Hasil voting seri — tidak ada yang tereliminasi.`, "info");
            } else if (elim.reason === "no_votes") {
              onNotify(`Ronde ${elim.round}: Tidak ada suara masuk — lanjut ronde berikutnya.`, "info");
            } else if (elim.reason === "voted" && elim.eliminatedPlayerId) {
              const target = nextView.players.find((p) => p.id === elim.eliminatedPlayerId);
              const name = target?.nickname ?? "Pemain";
              const roleLabel =
                elim.eliminatedRole === "undercover"
                  ? "Undercover"
                  : elim.eliminatedRole === "mr_blank"
                    ? "Mr. Blank"
                    : "Citizen";
              if (elim.eliminatedRole === "mr_blank" && nextView.phase === "MR_BLANK_GUESS") {
                onNotify(`${name} tereliminasi & ternyata Mr. Blank! Kesempatan menebak kata Citizen.`, "info");
              } else {
                onNotify(`Ronde ${elim.round}: ${name} tereliminasi (${roleLabel})!`, "error");
              }
            }
          }
        }

        if (nextView.mrBlankLastGuess && nextView.phase !== "MR_BLANK_GUESS") {
          const guessKey = `${nextView.round}:${nextView.mrBlankLastGuess}:${nextView.phase}`;
          if (lastMrBlankGuessKeyRef.current !== guessKey) {
            lastMrBlankGuessKeyRef.current = guessKey;
            if (nextView.winner?.winnerTeam === "mr_blank") {
              onNotify(nextView.winner.reason, "success");
            } else {
              onNotify(`Tebakan Mr. Blank ("${nextView.mrBlankLastGuess}") salah!`, "info");
            }
          }
        }
        break;
      }

      case "CHAT_HISTORY":
        setMessages(msg.payload.messages);
        break;

      case "CHAT_MESSAGE":
        setMessages((prev) => [...prev.slice(-99), msg.payload]);
        if (
          !chatOpenRef.current &&
          !msg.payload.isSystem &&
          msg.payload.senderId !== myPlayerIdRef.current
        ) {
          setUnreadCount((c) => c + 1);
          setChatBubble(msg.payload);
          if (chatBubbleTimerRef.current) {
            clearTimeout(chatBubbleTimerRef.current);
          }
          chatBubbleTimerRef.current = setTimeout(() => {
            setChatBubble(null);
          }, 4500);
        }
        break;

      case "ERROR":
        if (msg.payload.code === "KICKED") {
          onNotify(msg.payload.message, "error");
          onExitHome();
          return;
        }
        if (msg.payload.code === "JOIN_FAILED" && msg.payload.message.includes("tidak ditemukan")) {
          setRoomMissing(true);
        }
        onNotify(msg.payload.message, "error");
        break;
    }
  }, [onExitHome, onNotify]);

  const { status: wsStatus, send } = useGameSocket(handleServerMessage);

  // Auto-join (and auto-rejoin on reconnect) whenever WS is connected + profile exists
  useEffect(() => {
    if (wsStatus === "connected" && profile && !roomMissing) {
      send({
        type: "ROOM_JOIN",
        payload: {
          roomCode,
          nickname: profile.nickname,
          avatar: profile.avatar,
        },
      });
    }
  }, [wsStatus, profile, roomCode, roomMissing, send]);

  const remainingSec = useCountdown(phaseEndsAt);

  const handleConfirmProfile = () => {
    const clean = draftNickname.trim();
    if (clean.length < 2) {
      onNotify("Nickname minimal 2 karakter ya!", "error");
      return;
    }
    const nextProfile: GuestProfile = { nickname: clean, avatar: draftAvatar };
    saveGuestProfile(nextProfile);
    setProfile(nextProfile);
  };

  useEffect(() => {
    return () => {
      if (chatBubbleTimerRef.current) {
        clearTimeout(chatBubbleTimerRef.current);
      }
    };
  }, []);

  if (roomMissing) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center px-4">
        <LowPolyBackground theme="arcade" />
        <GamePanel title="Room Tidak Ada" ribbonColor="pink" className="w-full max-w-sm">
          <p className="mb-5 text-center text-sm font-bold text-[#6e6049]">
            Kode room <strong>{roomCode}</strong> tidak ditemukan atau sudah ditutup.
          </p>
          <GameButton variant="yellow" size="md" fullWidth onClick={onExitHome}>
            <ArrowLeftIcon className="h-5 w-5" />
            Kembali ke Beranda
          </GameButton>
        </GamePanel>
      </div>
    );
  }

  // Prompt direct-link visitor for nickname + avatar first
  if (!profile) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center px-4 py-6">
        <LowPolyBackground theme="arcade" />
        <GamePanel title={`Gabung · ${roomCode}`} ribbonColor="cyan" className="w-full max-w-md">
          <p className="mb-4 text-center text-sm font-bold text-[#6e6049]">
            Isi nickname dan pilih avatarmu untuk langsung masuk room!
          </p>

          <div className="mb-4 rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] p-3.5">
            <div className="mb-3 flex items-center gap-3">
              <AvatarBadge avatar={draftAvatar} size="lg" />
              <input
                type="text"
                maxLength={16}
                autoFocus
                placeholder="Nama kamu..."
                value={draftNickname}
                onChange={(e) => setDraftNickname(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmProfile();
                }}
                className="flex-1 rounded-xl border-2 border-[#cfc595] bg-[#fffdf0] px-3 py-2.5 text-base font-extrabold text-[#3d2940] outline-none focus:border-[#17a3db]"
              />
            </div>
            <AvatarPicker value={draftAvatar} onChange={setDraftAvatar} />
          </div>

          <div className="flex flex-col gap-2.5">
            <GameButton variant="yellow" size="lg" fullWidth onClick={handleConfirmProfile}>
              Masuk Room!
            </GameButton>
            <GameButton variant="white" size="sm" fullWidth onClick={onExitHome}>
              Batal
            </GameButton>
          </div>
        </GamePanel>
      </div>
    );
  }

  const isHost = Boolean(room && myPlayerId && room.hostId === myPlayerId);
  const currentGameMeta = GAME_UI_CATALOG.find((g) => g.id === room?.gameId);
  const maxPlayers = currentGameMeta?.maxPlayers ?? 12;
  const onlineById: Record<string, boolean> = {};
  if (room) {
    for (const p of room.players) {
      onlineById[p.id] = p.isConnected;
    }
  }

  const handleLeaveRoom = () => {
    send({ type: "ROOM_LEAVE", payload: {} });
    setTimeout(() => {
      onExitHome();
    }, 60);
  };

  return (
    <div className="relative flex min-h-dvh flex-col px-2 py-4 sm:px-4 sm:py-6">
      <LowPolyBackground theme={room?.gameId === "uno" ? "uno" : "arcade"} />

      {/* Persistent Top HUD Bar */}
      <header className="relative mx-auto mb-4 flex w-full max-w-2xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {room && (
            <HudPill
              accent="cyan"
              icon={<UsersIcon className="h-4 w-4" />}
              label="Pemain"
              value={`${room.players.length}/${maxPlayers}`}
            />
          )}

          {room?.status !== "PLAYING" && room?.gameId === "undercover" && (
            <HudPill
              accent="gold"
              icon={<BookOpenIcon className="h-4 w-4" />}
              label="Library"
              value={wordsLoaded !== null ? `${wordsLoaded} kata` : "110 kata"}
            />
          )}

          {room?.status !== "PLAYING" && room?.gameId === "wordtrap" && (
            <HudPill
              accent="gold"
              icon={<BookOpenIcon className="h-4 w-4" />}
              label="Library"
              value={wordtrapWordsLoaded !== null ? `${wordtrapWordsLoaded} kata` : "125+ kata"}
            />
          )}

          {room?.status === "PLAYING" && (
            <HudPill
              accent={remainingSec !== null && remainingSec <= 10 ? "pink" : "green"}
              icon={<ClockIcon className="h-4 w-4" />}
              label="Waktu"
              value={remainingSec === null ? "∞" : `${remainingSec}d`}
            />
          )}
        </div>

        <div className="relative flex items-center gap-2">
          {room && room.status !== "LOBBY" && (
            <IconButton
              tone="red"
              title="Keluar dari Game"
              onClick={() => setShowLeaveModal(true)}
            >
              <LogOutIcon className="h-5 w-5" />
            </IconButton>
          )}

          <IconButton
            tone={wsStatus === "connected" ? "green" : "red"}
            title={wsStatus === "connected" ? "Terhubung" : "Menyambung ulang..."}
          >
            {wsStatus === "connected" ? (
              <WifiIcon className="h-5 w-5" />
            ) : (
              <WifiOffIcon className="h-5 w-5" />
            )}
          </IconButton>

          <IconButton
            tone="pink"
            badge={unreadCount}
            title="Buka Obrolan Room"
            onClick={() => {
              setChatOpen(true);
              setUnreadCount(0);
              setChatBubble(null);
            }}
          >
            <MessageCircleIcon className="h-5 w-5" />
          </IconButton>

          {/* Floating Incoming Chat Bubble (Top-Right) */}
          <AnimatePresence>
            {chatBubble && !chatOpen && (
              <motion.button
                key={chatBubble.id}
                type="button"
                initial={{ opacity: 0, y: -12, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.9, transition: { duration: 0.16 } }}
                transition={{ type: "spring", stiffness: 480, damping: 22 }}
                onClick={() => {
                  setChatOpen(true);
                  setUnreadCount(0);
                  setChatBubble(null);
                }}
                className="absolute right-0 top-14 z-40 w-60 max-w-[75vw] cursor-pointer rounded-2xl border-[3px] border-[#e0326a] bg-[#fffef4] px-3 py-2 text-left shadow-[0_6px_0_rgba(199,34,88,0.28),0_12px_20px_rgba(32,12,24,0.24)]"
              >
                {/* Speech bubble tail pointing up toward chat icon */}
                <span
                  aria-hidden="true"
                  className="absolute -top-2 right-3.5 h-3.5 w-3.5 rotate-45 border-l-[3px] border-t-[3px] border-[#e0326a] bg-[#fffef4]"
                />
                <div className="relative z-10">
                  <div className="truncate text-[11px] font-extrabold text-[#c72258]">
                    {chatBubble.senderName}
                  </div>
                  <div className="line-clamp-2 break-words text-xs font-extrabold text-[#3d2940]">
                    {chatBubble.content}
                  </div>
                </div>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Connection Status Banner (Self) */}
      {room && wsStatus !== "connected" && (
        <div className="relative z-20 mx-auto mb-3 flex w-full max-w-xl items-center justify-center gap-2 rounded-2xl border-2 border-[#e0326a] bg-[#fff0f5] px-3.5 py-2 text-xs font-extrabold text-[#8a123b] shadow-sm">
          <WifiOffIcon className="h-4 w-4 shrink-0" />
          <span>Koneksimu terputus — mencoba menyambung ulang...</span>
        </div>
      )}

      {/* Room Content: Loading / Lobby / Active Undercover Board */}
      <main className="flex-1">
        {!room || !myPlayerId ? (
          <div className="mx-auto max-w-sm">
            <GamePanel title="Menyambungkan..." ribbonColor="cyan">
              <p className="py-6 text-center text-sm font-extrabold text-[#6e6049]">
                Memasuki room <strong>{roomCode}</strong>...
              </p>
            </GamePanel>
          </div>
        ) : room.status === "LOBBY" || !gameView ? (
          <LobbyView
            room={room}
            myPlayerId={myPlayerId}
            onUpdateConfig={(patch: Record<string, unknown>) =>
              send({ type: "ROOM_UPDATE_CONFIG", payload: { config: patch } })
            }
            onKickPlayer={(targetPlayerId) =>
              send({ type: "ROOM_KICK_PLAYER", payload: { targetPlayerId } })
            }
            onStartGame={() => send({ type: "ROOM_START_GAME", payload: {} })}
            onOpenRules={() => setShowRulesModal(true)}
            onLeave={handleLeaveRoom}
          />
        ) : gameView.gameId === "wordtrap" ? (
          <WordtrapBoard
            view={gameView.view as WordtrapPlayerView}
            isHost={isHost}
            remainingSec={remainingSec}
            onlineById={onlineById}
            onAction={(actionType, data) =>
              send({ type: "GAME_ACTION", payload: { actionType, data } })
            }
            onPlayAgain={() => send({ type: "ROOM_START_GAME", payload: {} })}
            onReturnLobby={() => send({ type: "ROOM_RETURN_LOBBY", payload: {} })}
          />
        ) : gameView.gameId === "uno" ? (
          <UnoBoard
            view={gameView.view as UnoPlayerView}
            isHost={isHost}
            remainingSec={remainingSec}
            onlineById={onlineById}
            onAction={(actionType, data) =>
              send({ type: "GAME_ACTION", payload: { actionType, data } })
            }
            onPlayAgain={() => send({ type: "ROOM_START_GAME", payload: {} })}
            onReturnLobby={() => send({ type: "ROOM_RETURN_LOBBY", payload: {} })}
          />
        ) : (
          <UndercoverBoard
            view={gameView.view as UndercoverPlayerView}
            isHost={isHost}
            remainingSec={remainingSec}
            onlineById={onlineById}
            onAction={(actionType, data) =>
              send({ type: "GAME_ACTION", payload: { actionType, data } })
            }
            onPlayAgain={() => send({ type: "ROOM_START_GAME", payload: {} })}
            onReturnLobby={() => send({ type: "ROOM_RETURN_LOBBY", payload: {} })}
          />
        )}
      </main>

      {/* Multi-Channel Chat Drawer */}
      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={messages}
        allowedChannels={allowedChannels}
        myPlayerId={myPlayerId}
        onSend={(channel, content) =>
          send({ type: "CHAT_SEND", payload: { channel, content } })
        }
      />

      {/* Undercover How-to-Play Modal */}
      {showRulesModal && room?.gameId === "undercover" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
          <GamePanel
            title="Cara Bermain Undercover"
            ribbonColor="pink"
            onClose={() => setShowRulesModal(false)}
            className="w-full max-w-md"
          >
            <div className="space-y-3 overflow-y-auto pr-1 text-sm font-bold text-[#4e3e4d]">
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
                <div className="font-display text-base text-[#1b6d34]">1. Citizen</div>
                <p>
                  Mendapat kata utama yang sama. Beri clue singkat, lalu cari &amp; eliminasi semua
                  Undercover dan Mr. Blank!
                </p>
              </div>
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
                <div className="font-display text-base text-[#c72258]">2. Undercover</div>
                <p>
                  Mendapat kata yang mirip tapi berbeda. Berbaurlah dengan clue yang masuk akal dan
                  bertahan hidup sampai akhir!
                </p>
              </div>
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
                <div className="font-display text-base text-[#6540bb]">3. Mr. Blank</div>
                <p>
                  Tidak mendapat kata sama sekali! Jika tereliminasi, Mr. Blank punya 1 kesempatan
                  menebak kata Citizen untuk <strong>langsung menang</strong>.
                </p>
              </div>
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] p-3 text-xs leading-relaxed">
                <strong>Pengaturan Game:</strong> Host bisa memilih <em>Library (Acak)</em> atau{" "}
                <em>Custom Word</em> (tiap pemain menyumbang 1 pasang kata), mengatur{" "}
                <strong>Timer Clue</strong> (atau <em>Skip</em> untuk main tatap muka),{" "}
                <strong>Waktu Vote</strong> (Unlimited / 30s / 60s / 120s), serta{" "}
                <strong>Mode Vote</strong> (Terbuka / Rahasia, bisa Skip).
              </div>
            </div>
          </GamePanel>
        </div>
      )}

      {/* Wordtrap How-to-Play Modal */}
      {showRulesModal && room?.gameId === "wordtrap" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
          <GamePanel
            title="Cara Bermain Wordtrap"
            ribbonColor="cyan"
            onClose={() => setShowRulesModal(false)}
            className="w-full max-w-md"
          >
            <div className="space-y-3 overflow-y-auto pr-1 text-sm font-bold text-[#4e3e4d]">
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
                <div className="font-display text-base text-[#1b6d34]">1. Tebak Huruf Bergiliran</div>
                <p>
                  1 kata rahasia akan dipilih secara acak. Tiap pemain memilih 1 huruf A–Z. <strong>Hijau</strong> jika ada di kata, <strong>Merah</strong> jika
                  tidak ada.
                </p>
              </div>
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
                <div className="font-display text-base text-[#c72258]">2. Rebutan Tombol Tebak Kata (30d)</div>
                <p>
                  Kapan saja di tengah ronde, siapa pun bisa menekan <strong>Tebak Kata</strong>!
                  Permainan langsung berhenti dan kamu punya <strong>30 detik</strong> untuk
                  menjawab. Benar = <strong>+1 poin</strong>; salah/waktu habis = tereliminasi
                  sampai ronde berikutnya!
                </p>
              </div>
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
                <div className="font-display text-base text-[#6540bb]">3. Skill Trap (1x / Ronde · 1 Putaran)</div>
                <p>
                  Gunakan giliranmu untuk mengecoh lawan: di <strong>Mode Hidden</strong> huruf
                  pilihan tampil Hijau meski salah; di <strong>Mode Reveal</strong> pasang 1 huruf
                  palsu di slot kosong (otomatis hilang jika huruf aslinya ditebak). Setelah 1
                  putaran berakhir, log akan membongkar trap dan mengembalikan warna aslinya!
                </p>
              </div>
            </div>
          </GamePanel>
        </div>
      )}

      {/* UNO How-to-Play Modal */}
      {showRulesModal && room?.gameId === "uno" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
          <GamePanel
            title="Cara Bermain UNO"
            ribbonColor="pink"
            onClose={() => setShowRulesModal(false)}
            className="w-full max-w-md"
          >
            <div className="space-y-3 overflow-y-auto pr-1 text-sm font-bold text-[#4e3e4d]">
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
                <div className="font-display text-base text-[#1b6d34]">1. Cocokkan Warna atau Simbol</div>
                <p>
                  Tiap pemain mendapat 5 atau 7 kartu awal. Pada giliranmu, mainkan kartu yang
                  cocok <strong>warna</strong>, <strong>angka/simbol</strong>, atau kartu{" "}
                  <strong>Wild</strong>. Jika tidak ada, klik <strong>Deck</strong> untuk ambil 1
                  kartu (jika valid, boleh langsung dimainkan atau klik Lewati).
                </p>
              </div>
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
                <div className="font-display text-base text-[#c72258]">2. Kartu Aksi &amp; Stacking +2/+4</div>
                <p>
                  <strong>Skip</strong> melewati lawan, <strong>Reverse</strong> membalik arah
                  (berfungsi sebagai Skip saat 2 pemain), dan <strong>Wild</strong> mengganti warna
                  aktif. Jika <strong>Stacking ON</strong>, +2 bisa ditumpuk +2/+4 dan +4 bisa
                  ditumpuk +4!
                </p>
              </div>
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
                <div className="font-display text-base text-[#6540bb]">3. Teriak UNO! &amp; Tangkap!</div>
                <p>
                  Saat menyisakan 1 kartu, tekan tombol <strong>TERIAK UNO!</strong> Jika lupa
                  sebelum pemain berikutnya jalan, lawan bisa menekan <strong>Tangkap!</strong>{" "}
                  untuk memberi penalti <strong>+2 kartu</strong>. Pemain pertama yang kartunya
                  habis langsung menang!
                </p>
              </div>
            </div>
          </GamePanel>
        </div>
      )}

      {/* Confirm Leave Game Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
          <GamePanel
            title="Keluar dari Game?"
            ribbonColor="pink"
            onClose={() => setShowLeaveModal(false)}
            className="w-full max-w-sm"
          >
            <div className="space-y-4">
              <p className="text-center text-sm font-extrabold text-[#4e3e4d]">
                Kamu yakin ingin keluar dari permainan sekarang?
              </p>

              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3 text-center text-xs font-bold leading-relaxed text-[#6e6049]">
                Kamu tetap bisa <strong>kembali masuk ke room ini</strong> kapan saja dengan kode{" "}
                <strong className="font-display text-[#c72258]">{roomCode}</strong> atau link yang
                sama selama room masih aktif.
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <GameButton
                  variant="white"
                  size="sm"
                  fullWidth
                  onClick={() => setShowLeaveModal(false)}
                >
                  Batal
                </GameButton>
                <GameButton
                  variant="pink"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setShowLeaveModal(false);
                    handleLeaveRoom();
                  }}
                >
                  <LogOutIcon className="h-4 w-4" />
                  Keluar
                </GameButton>
              </div>
            </div>
          </GamePanel>
        </div>
      )}
    </div>
  );
}
