import { UndercoverConfigSchema } from "@gemoji/game-undercover";
import { UnoConfigSchema } from "@gemoji/game-uno";
import { WordtrapConfigSchema } from "@gemoji/game-wordtrap";
import type { RoomPublicState } from "@gemoji/shared";
import { CheckIcon, CopyIcon, CrownIcon, HelpCircleIcon, PlayIcon, UserXIcon } from "lucide-react";
import { useState } from "react";
import { AvatarBadge, GameButton, GamePanel } from "../../components/game-ui";
import { GAME_UI_CATALOG } from "../../games/registry";
import { UndercoverSettings } from "../../games/undercover/UndercoverSettings";
import { UnoSettings } from "../../games/uno/UnoSettings";
import { WordtrapSettings } from "../../games/wordtrap/WordtrapSettings";

interface LobbyViewProps {
  room: RoomPublicState;
  myPlayerId: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  onKickPlayer: (targetPlayerId: string) => void;
  onStartGame: () => void;
  onOpenRules: () => void;
  onLeave: () => void;
}

export function LobbyView({
  room,
  myPlayerId,
  onUpdateConfig,
  onKickPlayer,
  onStartGame,
  onOpenRules,
  onLeave,
}: LobbyViewProps) {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === myPlayerId;
  const gameMeta = GAME_UI_CATALOG.find((g) => g.id === room.gameId);
  const minPlayers = gameMeta?.minPlayers ?? 3;
  const maxPlayers = gameMeta?.maxPlayers ?? 12;
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
      <GamePanel title={gameMeta ? `Lobby · ${gameMeta.name}` : "Lobby"} ribbonColor="pink">
        {/* Invite Link Strip */}
        <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border-2 border-[#cfc595] bg-[#fffdf0] px-3.5 py-2.5">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#786b51]">
              Bagikan Link ke Teman
            </div>
            <div className="truncate font-extrabold text-[#3d2940]">Code: {room.roomCode}</div>
          </div>
          <GameButton
            variant={copied ? "green" : "cyan"}
            size="sm"
            onClick={handleCopyLink}
          >
            {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
            {copied ? "Tersalin!" : "Salin"}
          </GameButton>
        </div>

        {/* Player List */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-sm font-bold uppercase tracking-wide text-[#5c1632]">
              Pemain ({room.players.length}/{maxPlayers})
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
                    "flex items-center justify-between gap-2 rounded-2xl border-2 px-3 py-2 transition",
                    !p.isConnected
                      ? "border-dashed border-[#e0326a] bg-[#fff0f5] opacity-80"
                      : isMe
                        ? "border-[#e0326a] bg-[#fff9dc]"
                        : "border-[#d8cfa3] bg-[#fffdf0]",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AvatarBadge avatar={p.avatar} size="sm" offline={!p.isConnected} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 truncate text-sm font-extrabold text-[#3d2940]">
                        <span className="truncate">{p.nickname}</span>
                        {isMe && (
                          <span className="rounded-md bg-[#ffe0eb] px-1.5 py-0.5 text-[10px] font-extrabold text-[#b82052]">
                            Kamu
                          </span>
                        )}
                      </div>
                      {p.isHost && (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#d47a00]">
                          <CrownIcon className="h-3 w-3 fill-current" /> Host
                        </div>
                      )}
                    </div>
                  </div>

                  {isHost && !isMe && (
                    <button
                      type="button"
                      title="Keluarkan pemain"
                      onClick={() => onKickPlayer(p.id)}
                      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#f5b4c9] bg-[#ffe3ec] text-[#b82052] transition hover:bg-[#ffd0df]"
                    >
                      <UserXIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Game Settings */}
        <div className="mb-2">
          {room.gameId === "wordtrap" ? (
            <WordtrapSettings
              config={WordtrapConfigSchema.parse(room.config ?? {})}
              isHost={isHost}
              onChange={(patch) => onUpdateConfig(patch)}
            />
          ) : room.gameId === "uno" ? (
            <UnoSettings
              config={UnoConfigSchema.parse(room.config ?? {})}
              isHost={isHost}
              onChange={(patch) => onUpdateConfig(patch)}
            />
          ) : (
            <UndercoverSettings
              config={UndercoverConfigSchema.parse(room.config ?? {})}
              isHost={isHost}
              playerCount={room.players.length}
              onChange={(patch) => onUpdateConfig(patch)}
            />
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex flex-col gap-3">
          {isHost ? (
            <GameButton
              variant="yellow"
              size="md"
              fullWidth
              disabled={!canStart}
              onClick={onStartGame}
            >
              <PlayIcon className="h-6 w-6 fill-current" />
              {canStart
                ? "Mulai Game!"
                : `Butuh ${minPlayers - room.players.length} Pemain Lagi`}
            </GameButton>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[#c8bf94] bg-[#ebe4be] py-3 text-center text-sm font-extrabold text-[#6e6049]">
              Menunggu Host memulai permainan...
            </div>
          )}

          <GameButton variant="white" size="sm" fullWidth onClick={onOpenRules}>
            <HelpCircleIcon className="h-4 w-4" />
            Cara Bermain
          </GameButton>

          <GameButton variant="pink" size="sm" fullWidth onClick={onLeave}>
            Keluar ke Beranda
          </GameButton>
        </div>
      </GamePanel>
    </div>
  );
}
