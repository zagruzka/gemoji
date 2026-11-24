import { UndercoverConfigSchema, type UndercoverConfig } from "@gemoji/game-undercover";
import type { RoomPublicState } from "@gemoji/shared";
import { Check, Copy, Crown, Play, UserX, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { AvatarBadge, GameButton, GamePanel } from "../../components/game-ui";
import { UndercoverSettings } from "../../games/undercover/UndercoverSettings";

interface LobbyViewProps {
  room: RoomPublicState;
  myPlayerId: string;
  onUpdateConfig: (patch: Partial<UndercoverConfig>) => void;
  onKickPlayer: (targetPlayerId: string) => void;
  onStartGame: () => void;
  onLeave: () => void;
}

export function LobbyView({
  room,
  myPlayerId,
  onUpdateConfig,
  onKickPlayer,
  onStartGame,
  onLeave,
}: LobbyViewProps) {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === myPlayerId;
  const parsedConfig = UndercoverConfigSchema.parse(room.config ?? {});
  const minPlayers = 3;
  const canStart = room.players.length >= minPlayers;

  const shareUrl = `${window.location.origin}/room/${room.roomCode}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <GamePanel title={`Lobby · ${room.roomCode}`} ribbonColor="pink">
        {/* Invite Link Strip */}
        <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border-2 border-[#cfc595] bg-[#fffdf0] px-3.5 py-2.5">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#786b51]">
              Bagikan Link ke Teman
            </div>
            <div className="truncate text-sm font-extrabold text-[#3d2940]">{shareUrl}</div>
          </div>
          <GameButton
            variant={copied ? "green" : "cyan"}
            size="sm"
            onClick={handleCopyLink}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Tersalin!" : "Salin"}
          </GameButton>
        </div>

        {/* Player List */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-sm font-bold uppercase tracking-wide text-[#5c1632]">
              Pemain ({room.players.length}/12)
            </span>
            <span className="text-xs font-extrabold text-[#786b51]">
              Minimal {minPlayers} pemain
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {room.players.map((p) => {
              const isMe = p.id === myPlayerId;
              return (
                <div
                  key={p.id}
                  className={[
                    "flex items-center justify-between gap-2 rounded-2xl border-2 px-3 py-2",
                    isMe
                      ? "border-[#e0326a] bg-[#fff9dc]"
                      : "border-[#d8cfa3] bg-[#fffdf0]",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AvatarBadge avatar={p.avatar} size="sm" dimmed={!p.isConnected} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 truncate text-sm font-extrabold text-[#3d2940]">
                        <span className="truncate">{p.nickname}</span>
                        {isMe && (
                          <span className="rounded-md bg-[#ffe0eb] px-1.5 py-0.5 text-[10px] font-extrabold text-[#b82052]">
                            Kamu
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-[#7a6d54]">
                        {p.isHost && (
                          <span className="inline-flex items-center gap-0.5 text-[#d47a00]">
                            <Crown className="h-3 w-3 fill-current" /> Host
                          </span>
                        )}
                        {p.isConnected ? (
                          <span className="inline-flex items-center gap-0.5 text-[#2b8a3e]">
                            <Wifi className="h-3 w-3" /> Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[#c92a2a]">
                            <WifiOff className="h-3 w-3" /> Reconnecting
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isHost && !isMe && (
                    <button
                      type="button"
                      title="Keluarkan pemain"
                      onClick={() => onKickPlayer(p.id)}
                      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#f5b4c9] bg-[#ffe3ec] text-[#b82052] transition hover:bg-[#ffd0df]"
                    >
                      <UserX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Game Settings */}
        <div className="mb-5">
          <UndercoverSettings
            config={parsedConfig}
            isHost={isHost}
            playerCount={room.players.length}
            onChange={onUpdateConfig}
          />
        </div>

        {/* Footer Controls */}
        <div className="flex flex-col gap-3">
          {isHost ? (
            <GameButton
              variant="yellow"
              size="lg"
              fullWidth
              disabled={!canStart}
              onClick={onStartGame}
            >
              <Play className="h-6 w-6 fill-current" />
              {canStart
                ? "Mulai Game!"
                : `Butuh ${minPlayers - room.players.length} Pemain Lagi`}
            </GameButton>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[#c8bf94] bg-[#ebe4be] py-3 text-center text-sm font-extrabold text-[#6e6049]">
              Menunggu Host memulai permainan...
            </div>
          )}

          <GameButton variant="white" size="sm" fullWidth onClick={onLeave}>
            Keluar ke Beranda
          </GameButton>
        </div>
      </GamePanel>
    </div>
  );
}
