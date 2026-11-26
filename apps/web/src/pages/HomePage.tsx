import type { AvatarId } from "@gemoji/shared";
import {
  HelpCircleIcon,
  InfoIcon,
  PlayIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  AvatarBadge,
  AvatarPicker,
  GameButton,
  GameModal,
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
import { GamePickerModal } from "../games/GamePickerModal";
import {
  loadSelectedGameId,
  saveSelectedGameId,
} from "../games/registry";
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
  const [selectedGameId, setSelectedGameId] = useState<string>(() => loadSelectedGameId());

  const handleSelectGame = (gameId: string) => {
    setSelectedGameId(gameId);
    saveSelectedGameId(gameId);
  };
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
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
        const errData = (await res.json().catch(() => null)) as { message?: string } | null;
        onNotify(errData?.message ?? "Gagal membuat room. Pastikan server aktif.", "error");
        return;
      }
      const data = (await res.json()) as { roomCode: string };
      setShowCreateModal(false);
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
    <div className="relative flex min-h-dvh flex-col items-center justify-between px-2 py-4 sm:py-8">
      <LowPolyBackground theme="arcade" />

      {/* Top HUD Bar */}
      <header className="flex w-full max-w-xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <HudPill
            accent={health?.ok ? "green" : "pink"}
            icon={<SparklesIcon className="size-4" />}
            label="Status"
            value={health?.ok ? idLocale.status.online : idLocale.status.offline}
          />
        </div>

        <IconButton tone="gold" title="Tentang Gemoji" onClick={() => setShowAboutModal(true)}>
          <InfoIcon className="size-5" />
        </IconButton>
      </header>

      {/* Main Panel */}
      <main className="my-2 w-full max-w-md">
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

          {/* Main 3D Action Buttons */}
          <div className="flex flex-col gap-3.5">
            <GameButton
              variant="yellow"
              size="lg"
              fullWidth
              disabled={creating}
              onClick={() => {
                if (ensureProfile()) setShowCreateModal(true);
              }}
            >
              <PlayIcon className="h-6 w-6 fill-current" />
              {idLocale.actions.createRoom}
            </GameButton>

            <GameButton
              variant="green"
              size="md"
              fullWidth
              onClick={() => {
                if (ensureProfile()) setShowJoinModal(true);
              }}
            >
              <UsersIcon className="h-5 w-5" />
              {idLocale.actions.joinRoom}
            </GameButton>

            <GameButton
              variant="white"
              size="md"
              fullWidth
              onClick={() => setShowRulesModal(true)}
            >
              <HelpCircleIcon className="h-5 w-5" />
              {idLocale.actions.rules}
            </GameButton>
          </div>
        </GamePanel>
      </main>

      <div className="h-2" />

      {/* Create Room: Game Picker Modal */}
      <GamePickerModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        selectedGameId={selectedGameId}
        onSelectGame={handleSelectGame}
        onConfirm={handleCreateRoom}
        title="Pilih Game"
        confirmLabel="Pilih Game"
        confirming={creating}
        confirmingLabel="Membuat Room..."
      />

      {/* Join Room Modal */}
      <GameModal
        open={showJoinModal}
        align="top"
        onClose={() => setShowJoinModal(false)}
      >
        <GamePanel
          title="Gabung Room"
          ribbonColor="pink"
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
                className="font-display w-full rounded-2xl border-3 border-[#cfc595] bg-[#fffdf0] py-3 text-center text-3xl font-bold tracking-[0.25em] text-[#3d2940] uppercase outline-none focus:border-[#e0326a]"
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
      </GameModal>

      {/* About Modal */}
      <GameModal open={showAboutModal} onClose={() => setShowAboutModal(false)}>
        <GamePanel
          title="Tentang Gemoji"
          ribbonColor="pink"
          onClose={() => setShowAboutModal(false)}
          className="w-full max-w-md"
        >
          <div className="space-y-3 overflow-y-auto pr-1 text-sm font-bold text-[#4e3e4d]">
            <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
              <div className="font-display text-base text-[#c72258]">Apa itu Gemoji?</div>
              <p>
                <strong>Gemoji!</strong> adalah platform party game multiplayer berbasis web untuk
                main bareng teman secara real-time langsung dari browser HP maupun laptop tanpa
                perlu install aplikasi atau buat akun.
              </p>
            </div>
            <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
              <div className="font-display text-base text-[#1b6d34]">Fitur Utama</div>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>Masuk cepat cukup dengan nickname &amp; avatar pilihanmu.</li>
                <li>Buat room privat dengan kode &amp; link undangan instan.</li>
                <li>Obrolan room real-time &amp; auto-reconnect jika koneksi terputus.</li>
                <li>Mendukung berbagai game seru yang akan terus bertambah.</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] p-3 text-xs leading-relaxed">
              <strong>Catatan:</strong> Aturan dan cara bermain masing-masing game dapat dibuka
              langsung dari dalam room game yang dipilih.
            </div>
          </div>
        </GamePanel>
      </GameModal>

      {/* Rules Modal */}
      <GameModal open={showRulesModal} onClose={() => setShowRulesModal(false)}>
        <GamePanel
          title="Aturan Main Gemoji"
          ribbonColor="pink"
          onClose={() => setShowRulesModal(false)}
          className="w-full max-w-md"
        >
          <div className="space-y-3 overflow-y-auto pr-1 text-sm font-bold text-[#4e3e4d]">
            <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
              <div className="font-display text-base text-[#1b6d34]">1. Siapkan Profil &amp; Pilih Game</div>
              <p>
                Isi nickname dan pilih avatarmu tanpa perlu akun. Pilih game yang ingin dimainkan,
                lalu buat room baru atau gabung memakai kode room dari teman.
              </p>
            </div>
            <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
              <div className="font-display text-base text-[#c72258]">2. Kumpul di Lobby</div>
              <p>
                Bagikan kode atau link room ke teman-temanmu. Host dapat mengatur aturan dan
                pengaturan game di lobby sebelum menekan <strong>Mulai Game!</strong>
              </p>
            </div>
            <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#fffbe6] p-3">
              <div className="font-display text-base text-[#6540bb]">3. Main Bareng Real-Time</div>
              <p>
                Semua giliran, timer, dan obrolan berjalan langsung di browser. Jika koneksi
                sempat terputus, kamu akan tersambung kembali otomatis selama room masih aktif.
              </p>
            </div>
            <div className="rounded-2xl border-2 border-[#d8cfa3] bg-[#ebe4be] p-3 text-xs leading-relaxed">
              <strong>Etika Bermain:</strong> Main dengan sportif, jangan mengintip layar teman
              saat bermain tatap muka, dan gunakan obrolan room dengan sopan. Pengaturan spesifik
              tiap game bisa diatur Host langsung di Lobby.
            </div>
          </div>
        </GamePanel>
      </GameModal>
    </div>
  );
}
