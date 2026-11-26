import { AlertTriangleIcon, PlayIcon } from "lucide-react";
import { GameButton, GameModal, GamePanel } from "../components/game-ui";
import { GAME_PLAY_STYLE_LABEL, GAME_UI_CATALOG } from "./registry";

interface GamePickerModalProps {
  open: boolean;
  onClose: () => void;
  selectedGameId: string;
  onSelectGame: (gameId: string) => void;
  onConfirm: (gameId: string) => void;
  title?: string;
  confirmLabel?: string;
  confirming?: boolean;
  confirmingLabel?: string;
  currentGameId?: string;
  currentPlayerCount?: number;
}

export function GamePickerModal({
  open,
  onClose,
  selectedGameId,
  onSelectGame,
  onConfirm,
  title = "Pilih Game",
  confirmLabel = "Pilih Game",
  confirming = false,
  confirmingLabel = "Membuat Room...",
  currentGameId,
  currentPlayerCount,
}: GamePickerModalProps) {
  const selectedGame =
    GAME_UI_CATALOG.find((g) => g.id === selectedGameId) ?? GAME_UI_CATALOG[0]!;
  const isComingSoon = selectedGame.status !== "available";
  const isCurrentGame = Boolean(currentGameId && selectedGame.id === currentGameId);
  const exceedsMaxPlayers =
    typeof currentPlayerCount === "number" &&
    !isComingSoon &&
    currentPlayerCount > selectedGame.maxPlayers;

  const handleClose = () => {
    if (!confirming) onClose();
  };

  return (
    <GameModal open={open} onClose={handleClose}>
      <GamePanel
        title={title}
        ribbonColor="pink"
        onClose={handleClose}
        className="w-full max-w-md"
      >
        <div className="space-y-4">
          {/* List Game */}
          <div className="grid grid-cols-3 gap-2">
            {GAME_UI_CATALOG.map((game) => {
              const isSelected = selectedGame.id === game.id;
              const gameComingSoon = game.status !== "available";
              const gameIsCurrent = currentGameId === game.id;
              const gameOverLimit =
                typeof currentPlayerCount === "number" &&
                !gameComingSoon &&
                currentPlayerCount > game.maxPlayers;

              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => onSelectGame(game.id)}
                  className={[
                    "font-display relative flex cursor-pointer flex-col items-center rounded-2xl border-2 px-2 py-2.5 text-center transition",
                    isSelected
                      ? "border-[#e0326a] bg-[#fff9dc] text-[#5c1632] shadow-[0_4px_0_#e0326a]"
                      : gameComingSoon
                        ? "border-[#d8cfa3] bg-[#ebe4be] text-[#6d624d] opacity-65 hover:bg-[#f7f2d4] hover:opacity-85"
                        : "border-[#d8cfa3] bg-[#ebe4be] text-[#6d624d] hover:bg-[#f7f2d4]",
                  ].join(" ")}
                >
                  {gameIsCurrent && (
                    <span className="absolute -top-2 right-1.5 rounded-full bg-[#e0326a] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-white uppercase">
                      Aktif
                    </span>
                  )}
                  <game.icon className="mb-1 size-5" />
                  <span className="text-sm font-bold leading-tight">{game.name}</span>
                  <span
                    className={[
                      "mt-0.5 text-[10px] font-semibold",
                      gameOverLimit ? "text-[#c72258]" : "",
                    ].join(" ")}
                  >
                    {gameComingSoon
                      ? "Coming Soon"
                      : `${game.minPlayers}–${game.maxPlayers} pemain`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Deskripsi Game Terpilih */}
          <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
              <span className="font-display inline-flex items-center gap-1.5 text-sm font-bold text-[#5c1632]">
                <selectedGame.icon className="size-4 text-[#e0326a]" />
                {selectedGame.name}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                    selectedGame.playStyle === "team"
                      ? "bg-[#e3f4ff] text-[#105f99]"
                      : "bg-[#ffe8ef] text-[#b31b4e]",
                  ].join(" ")}
                >
                  {GAME_PLAY_STYLE_LABEL[selectedGame.playStyle]}
                </span>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                    exceedsMaxPlayers
                      ? "bg-[#ffe0eb] text-[#b82052]"
                      : "bg-[#ebe4be] text-[#6e6049]",
                  ].join(" ")}
                >
                  {selectedGame.minPlayers}–{selectedGame.maxPlayers} pemain
                </span>
              </div>
            </div>
            <p className="text-xs font-bold leading-relaxed text-[#5c4e3d]">
              {selectedGame.description}
            </p>

            {exceedsMaxPlayers && (
              <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-[#f5b4c9] bg-[#fff0f5] px-2.5 py-2 text-[11px] font-extrabold text-[#9e1744]">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Saat ini ada {currentPlayerCount} pemain di lobby (maksimal{" "}
                  {selectedGame.maxPlayers} untuk {selectedGame.name}). Kamu tetap bisa memilih
                  game ini, lalu sesuaikan jumlah pemain sebelum mulai.
                </span>
              </div>
            )}
          </div>

          {/* Tombol Konfirmasi */}
          <GameButton
            variant="yellow"
            size="md"
            fullWidth
            disabled={confirming || isComingSoon || isCurrentGame}
            onClick={() => onConfirm(selectedGame.id)}
          >
            {isComingSoon ? (
              "Coming Soon"
            ) : isCurrentGame ? (
              "Game Sedang Aktif"
            ) : (
              <>
                <PlayIcon className="h-5 w-5 fill-current" />
                {confirming ? confirmingLabel : confirmLabel}
              </>
            )}
          </GameButton>
        </div>
      </GamePanel>
    </GameModal>
  );
}
