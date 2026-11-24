import type { AvatarId } from "@gemoji/shared";
import {
  BookOpen,
  Gamepad2,
  HelpCircle,
  Play,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import {
  loadGuestProfile,
  randomAvatar,
  saveGuestProfile,
} from "../features/connection/profile";
import { GAME_UI_CATALOG } from "../games/registry";
import { idLocale } from "../locales/id";

interface HealthResponse {
  ok: boolean;
  runtime: string;
  wordsLoaded: number;
}

interface HomePageProps {
  onEnterRoom: (roomCode: string) => void;
  onNotify: (message: string, tone?: ToastTone) => void;
}

export function HomePage({ onEnterRoom, onNotify }: HomePageProps) {
  const saved = loadGuestProfile();
  const [nickname, setNickname] = useState(saved?.nickname ?? "");
  const [avatar, setAvatar] = useState<AvatarId>(saved?.avatar ?? randomAvatar());
  const [selectedGameId, setSelectedGameId] = useState("undercover");
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const [creating, setCreating] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: HealthResponse | null) => setHealth(data))
      .catch(() => setHealth(null));
  }, []);

  const ensureProfile = (): boolean => {
    const clean = nickname.trim();
    if (clean.length < 2) {
      onNotify("Isi nickname dulu minimal 2 karakter ya!", "error");
      return false;
    }
    if (clean.length > 16) {
      onNotify("Nickname maksimal 16 karakter.", "error");
      return false;
    }
    saveGuestProfile({ nickname: clean, avatar });
    return true;
  };

  const handleCreateRoom = async () => {
    if (!ensureProfile()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: selectedGameId }),
      });
      if (!res.ok) {
        onNotify("Gagal membuat room. Pastikan server aktif.", "error");
        return;
      }
      const data = (await res.json()) as { roomCode: string };
      onEnterRoom(data.roomCode);
    } catch {
      onNotify("Tidak bisa terhubung ke server.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!ensureProfile()) return;
    const cleanCode = joinCode.trim().toUpperCase();
    if (!/^[A-Z2-9]{4,6}$/.test(cleanCode)) {
      onNotify("Masukkan kode room 4–6 karakter yang valid.", "error");
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/rooms/${cleanCode}`);
      if (!res.ok) {
        onNotify(`Room "${cleanCode}" tidak ditemukan.`, "error");
        return;
      }
      onEnterRoom(cleanCode);
    } catch {
      onNotify("Gagal memeriksa room ke server.", "error");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-between px-4 py-5 sm:py-8">
      <LowPolyBackground theme="arcade" />

      {/* Top HUD Bar */}
      <header className="flex w-full max-w-xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <HudPill
            accent={health?.ok ? "green" : "pink"}
            icon={<Sparkles className="h-4 w-4" />}
            label="Status"
            value={health?.ok ? idLocale.status.online : idLocale.status.offline}
          />
          <HudPill
            accent="gold"
            icon={<BookOpen className="h-4 w-4" />}
            label="Library"
            value={health ? `${health.wordsLoaded} kata` : "110 kata"}
          />
        </div>

        <IconButton tone="gold" title="Aturan Main" onClick={() => setShowRulesModal(true)}>
          <HelpCircle className="h-5 w-5" />
        </IconButton>
      </header>

      {/* Main Panel */}
      <main className="my-5 w-full max-w-md">
        <GamePanel title={idLocale.appName} ribbonColor="pink">
          <p className="mb-4 text-center text-sm font-bold text-[#6e6049]">
            {idLocale.tagline}
          </p>

          {/* Guest Profile Box */}
          <div className="mb-4 rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] p-3.5">
            <div className="mb-3 flex items-center gap-3">
              <AvatarBadge avatar={avatar} size="lg" />
              <div className="flex-1">
                <label
                  htmlFor="guest-nickname"
                  className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-[#726449]"
                >
                  Nickname Kamu
                </label>
                <input
                  id="guest-nickname"
                  type="text"
                  maxLength={16}
                  placeholder="Contoh: Budi"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#cfc595] bg-[#fffdf0] px-3 py-2 text-base font-extrabold text-[#3d2940] outline-none focus:border-[#e0326a]"
                />
              </div>
            </div>
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>

          {/* Game Picker */}
          <div className="mb-4">
            <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-[#726449]">
              Pilih Game
            </div>
            <div className="grid grid-cols-3 gap-2">
              {GAME_UI_CATALOG.map((game) => {
                const isSelected = selectedGameId === game.id;
                const disabled = game.status !== "available";
                return (
                  <button
                    key={game.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedGameId(game.id)}
                    className={[
                      "font-display flex flex-col items-center rounded-2xl border-2 px-2 py-2.5 text-center transition",
                      isSelected
                        ? "border-[#e0326a] bg-[#fff9dc] text-[#5c1632] shadow-[0_4px_0_#e0326a]"
                        : "border-[#d8cfa3] bg-[#ebe4be] text-[#6d624d] hover:bg-[#f7f2d4]",
                      disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <Gamepad2 className="mb-1 h-5 w-5" />
                    <span className="text-sm font-bold leading-tight">{game.name}</span>
                    <span className="mt-0.5 text-[10px] font-semibold">
                      {disabled ? "Segera" : `${game.minPlayers}–${game.maxPlayers} org`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main 3D Action Buttons */}
          <div className="flex flex-col gap-3.5">
            <GameButton
              variant="yellow"
              size="lg"
              fullWidth
              disabled={creating}
              onClick={handleCreateRoom}
            >
              <Play className="h-6 w-6 fill-current" />
              {creating ? "Membuat Room..." : idLocale.actions.createRoom}
            </GameButton>

            <GameButton
              variant="cyan"
              size="md"
              fullWidth
              onClick={() => {
                if (ensureProfile()) setShowJoinModal(true);
              }}
            >
              <Users className="h-5 w-5" />
              {idLocale.actions.joinRoom}
            </GameButton>

            <GameButton
              variant="green"
              size="md"
              fullWidth
              onClick={() => setShowRulesModal(true)}
            >
              <HelpCircle className="h-5 w-5" />
              {idLocale.actions.rules}
            </GameButton>
          </div>
        </GamePanel>
      </main>

      <div className="h-2" />

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
          <GamePanel
            title="Gabung Room"
            ribbonColor="cyan"
            onClose={() => setShowJoinModal(false)}
            className="w-full max-w-sm"
          >
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="room-code-input"
                  className="mb-1.5 block text-center text-xs font-extrabold uppercase tracking-wider text-[#6e6049]"
                >
                  Masukkan Kode Room dari Host
                </label>
                <input
                  id="room-code-input"
                  type="text"
                  maxLength={6}
                  autoFocus
                  placeholder="K4M8"
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJoinRoom();
                  }}
                  className="font-display w-full rounded-2xl border-3 border-[#cfc595] bg-[#fffdf0] py-3 text-center text-3xl font-bold tracking-[0.25em] text-[#3d2940] uppercase outline-none focus:border-[#17a3db]"
                />
              </div>

              <GameButton
                variant="yellow"
                size="md"
                fullWidth
                disabled={joining || joinCode.length < 4}
                onClick={handleJoinRoom}
              >
                {joining ? "Mengecek..." : "Masuk Room!"}
              </GameButton>
            </div>
          </GamePanel>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
          <GamePanel
            title="Aturan Undercover"
            ribbonColor="pink"
            onClose={() => setShowRulesModal(false)}
            className="w-full max-w-md"
          >
            <div className="max-h-[65dvh] space-y-3 overflow-y-auto pr-1 text-sm font-bold text-[#4e3e4d]">
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
                <div className="font-display text-base text-[#1b6d34]">1. Citizen</div>
                <p>Mendapat kata utama yang sama. Cari & eliminasi semua Undercover dan Mr. Blank!</p>
              </div>
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
                <div className="font-display text-base text-[#c72258]">2. Undercover</div>
                <p>Mendapat kata yang mirip tapi berbeda. Berbaurlah dan bertahan hidup sampai akhir!</p>
              </div>
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
                <div className="font-display text-base text-[#6540bb]">3. Mr. Blank</div>
                <p>
                  Tidak mendapat kata sama sekali! Jika tereliminasi, Mr. Blank punya 1 kesempatan
                  menebak kata Citizen untuk <strong>langsung menang</strong>.
                </p>
              </div>
              <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] p-3 text-xs leading-relaxed">
                <strong>Mode Kata:</strong> Host bisa memilih <em>Library (Acak)</em> atau{" "}
                <em>Custom Word</em> (tiap pemain menyumbang 1 pasang kata, diacak sampai habis
                baru input ulang). Host juga bisa mengatur <strong>Timer Clue</strong>{" "}
                (termasuk <em>Skip</em> untuk main tatap muka), <strong>Waktu Vote</strong>{" "}
                (Unlimited / 30s / 60s / 120s), dan <strong>Mode Vote</strong> (Terbuka / Rahasia,
                bisa Skip).
              </div>
            </div>
          </GamePanel>
        </div>
      )}
    </div>
  );
}
