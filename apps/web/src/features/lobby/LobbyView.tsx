import { SpaceteamConfigSchema } from "@gemoji/game-spaceteam";
import { UndercoverConfigSchema } from "@gemoji/game-undercover";
import { UnoConfigSchema } from "@gemoji/game-uno";
import { WordtrapConfigSchema } from "@gemoji/game-wordtrap";
import type { RoomPublicState } from "@gemoji/shared";
import {
  AlertTriangleIcon,
  ArrowLeftRightIcon,
  CheckIcon,
  CopyIcon,
  CrownIcon,
  HelpCircleIcon,
  PlayIcon,
  UserXIcon,
} from "lucide-react";
import { useState } from "react";
import { AvatarBadge, GameButton, GamePanel } from "../../components/game-ui";
import { GamePickerModal } from "../../games/GamePickerModal";
import { GAME_UI_CATALOG } from "../../games/registry";
import { SpaceteamSettings } from "../../games/spaceteam/SpaceteamSettings";
import { UndercoverSettings } from "../../games/undercover/UndercoverSettings";
import { UnoSettings } from "../../games/uno/UnoSettings";
import { WordtrapSettings } from "../../games/wordtrap/WordtrapSettings";

interface LobbyViewProps {
  room: RoomPublicState;
  myPlayerId: string;
  onChangeGame: (gameId: string) => void;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  onKickPlayer: (targetPlayerId: string) => void;
  onStartGame: () => void;
  onOpenRules: () => void;
  onLeave: () => void;
}

export function LobbyView({
  room,
  myPlayerId,
  onChangeGame,
  onUpdateConfig,
  onKickPlayer,
  onStartGame,
  onOpenRules,
  onLeave,
}: LobbyViewProps) {
  const [copied, setCopied] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [draftGameId, setDraftGameId] = useState(room.gameId);

  const isHost = room.hostId === myPlayerId;
  const gameMeta = GAME_UI_CATALOG.find((g) => g.id === room.gameId);
  const minPlayers = gameMeta?.minPlayers ?? 3;
  const maxPlayers = gameMeta?.maxPlayers ?? 12;
  const tooFewPlayers = room.players.length < minPlayers;
  const tooManyPlayers = room.players.length > maxPlayers;
  const canStart = !tooFewPlayers && !tooManyPlayers;

  const shareUrl = `${window.location.origin}/room/${room.roomCode}`;

  const handleOpenGamePicker = () => {
    setDraftGameId(room.gameId);
    setShowGamePicker(true);
  };

  const handleConfirmGameChange = (nextGameId: string) => {
    if (nextGameId !== room.gameId) {
      onChangeGame(nextGameId);
    }
    setShowGamePicker(false);
  };

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
            <span
              className={[
                "font-display text-sm font-bold uppercase tracking-wide",
                tooManyPlayers ? "text-[#c72258]" : "text-[#5c1632]",
              ].join(" ")}
            >
              Pemain ({room.players.length}/{maxPlayers})
            </span>
            <span
              className={[
                "text-xs font-extrabold",
                tooManyPlayers ? "text-[#c72258]" : "text-[#786b51]",
              ].join(" ")}
            >
              {tooManyPlayers ? `Maksimal ${maxPlayers} pemain` : `Minimal ${minPlayers} pemain`}
            </span>
          </div>

          {tooManyPlayers && (
            <div className="mb-2.5 flex items-start gap-2 rounded-2xl border-2 border-[#f5b4c9] bg-[#fff0f5] px-3 py-2 text-xs font-extrabold text-[#9e1744]">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              <span>
                Terlalu banyak pemain untuk {gameMeta?.name ?? "game ini"} ({room.players.length}/
                {maxPlayers}).{" "}
                {isHost
                  ? `Keluarkan ${room.players.length - maxPlayers} pemain atau ganti ke game lain.`
                  : "Menunggu Host menyesuaikan jumlah pemain atau mengganti game."}
              </span>
            </div>
          )}

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
          ) : room.gameId === "spaceteam" ? (
            <SpaceteamSettings
              config={SpaceteamConfigSchema.parse(room.config ?? {})}
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
                : tooManyPlayers
                  ? `Kelebihan ${room.players.length - maxPlayers} Pemain (Maks ${maxPlayers})`
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

          {isHost ? (
            <div className="grid grid-cols-2 gap-2.5">
              <GameButton
                variant="cyan"
                size="sm"
                fullWidth
                onClick={handleOpenGamePicker}
                className="px-2.5 text-sm sm:px-4 sm:text-base"
              >
                <ArrowLeftRightIcon className="h-4 w-4 shrink-0" />
                Ganti Game
              </GameButton>
              <GameButton
                variant="pink"
                size="sm"
                fullWidth
                onClick={onLeave}
                className="px-2.5 text-sm sm:px-4 sm:text-base"
              >
                Keluar ke Beranda
              </GameButton>
            </div>
          ) : (
            <GameButton variant="pink" size="sm" fullWidth onClick={onLeave}>
              Keluar ke Beranda
            </GameButton>
          )}
        </div>
      </GamePanel>

      {/* Host Game Switcher Modal */}
      <GamePickerModal
        open={showGamePicker && isHost}
        onClose={() => setShowGamePicker(false)}
        selectedGameId={draftGameId}
        onSelectGame={setDraftGameId}
        onConfirm={handleConfirmGameChange}
        title="Ganti Game"
        confirmLabel="Ganti ke Game Ini"
        currentGameId={room.gameId}
        currentPlayerCount={room.players.length}
      />
    </div>
  );
}
