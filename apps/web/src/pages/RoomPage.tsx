import type { UndercoverConfig, UndercoverPlayerView } from "@gemoji/game-undercover";
import type {
  AvatarId,
  ChatChannel,
  ChatMessage,
  RoomPublicState,
  ServerMessage,
} from "@gemoji/shared";
import {
  ArrowLeft,
  Clock,
  MessageCircle,
  Users,
  Wifi,
  WifiOff,
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
import { UndercoverBoard } from "../games/undercover/UndercoverBoard";

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
  const [gameView, setGameView] = useState<UndercoverPlayerView | null>(null);
  const [phaseEndsAt, setPhaseEndsAt] = useState<number | null>(null);
  const [allowedChannels, setAllowedChannels] = useState<ChatChannel[]>(["lobby"]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatBubble, setChatBubble] = useState<ChatMessage | null>(null);
  const [roomMissing, setRoomMissing] = useState(false);

  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;
  const myPlayerIdRef = useRef(myPlayerId);
  myPlayerIdRef.current = myPlayerId;
  const chatBubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRoundResultKeyRef = useRef<string | null>(null);
  const lastMrBlankGuessKeyRef = useRef<string | null>(null);

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

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "SESSION_READY":
        setMyPlayerId(msg.payload.playerId);
        break;

      case "ROOM_STATE":
        setRoom(msg.payload);
        if (msg.payload.status === "LOBBY") {
          setGameView(null);
          setPhaseEndsAt(null);
          setAllowedChannels(["lobby"]);
        }
        break;

      case "GAME_STATE_VIEW": {
        const nextView = msg.payload.view as UndercoverPlayerView;
        setGameView(nextView);
        setPhaseEndsAt(msg.payload.phaseEndsAt);
        setAllowedChannels(msg.payload.allowedChatChannels);

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
            <ArrowLeft className="h-5 w-5" />
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

  return (
    <div className="relative flex min-h-dvh flex-col px-3 py-4 sm:px-4 sm:py-6">
      <LowPolyBackground theme="arcade" />

      {/* Persistent Top HUD Bar */}
      <header className="relative mx-auto mb-5 flex w-full max-w-2xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {room && (
            <HudPill
              accent="cyan"
              icon={<Users className="h-4 w-4" />}
              label="Pemain"
              value={`${room.players.length}/12`}
            />
          )}

          {room?.status === "PLAYING" && (
            <HudPill
              accent={remainingSec !== null && remainingSec <= 10 ? "pink" : "green"}
              icon={<Clock className="h-4 w-4" />}
              label="Waktu"
              value={remainingSec === null ? "∞" : `${remainingSec}d`}
            />
          )}
        </div>

        <div className="relative flex items-center gap-2">
          <IconButton
            tone={wsStatus === "connected" ? "green" : "red"}
            title={wsStatus === "connected" ? "Terhubung" : "Menyambung ulang..."}
          >
            {wsStatus === "connected" ? (
              <Wifi className="h-5 w-5" />
            ) : (
              <WifiOff className="h-5 w-5" />
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
            <MessageCircle className="h-5 w-5" />
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
            onUpdateConfig={(patch: Partial<UndercoverConfig>) =>
              send({ type: "ROOM_UPDATE_CONFIG", payload: { config: patch } })
            }
            onKickPlayer={(targetPlayerId) =>
              send({ type: "ROOM_KICK_PLAYER", payload: { targetPlayerId } })
            }
            onStartGame={() => send({ type: "ROOM_START_GAME", payload: {} })}
            onLeave={onExitHome}
          />
        ) : (
          <UndercoverBoard
            view={gameView}
            isHost={isHost}
            remainingSec={remainingSec}
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
    </div>
  );
}
