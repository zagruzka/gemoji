import {
  DicesIcon,
  HatGlassesIcon,
  KeyboardIcon,
  MoonIcon,
  PlayingCardsFanIcon,
  RocketIcon,
  type LucideIcon,
} from "lucide-react";

export type GamePlayStyle = "team" | "ffa";

export const GAME_PLAY_STYLE_LABEL: Record<GamePlayStyle, string> = {
  team: "Tim",
  ffa: "Lawan Semua",
};

export interface GameUiDescriptor {
  id: string;
  name: string;
  description: string;
  playStyle: GamePlayStyle;
  minPlayers: number;
  maxPlayers: number;
  icon: LucideIcon;
  status: "available" | "coming_soon";
  accent: "yellow" | "cyan" | "green";
}

export const GAME_UI_CATALOG: readonly GameUiDescriptor[] = [
  {
    id: "undercover",
    name: "Undercover",
    description:
      "Cari tahu siapa penyusup di antara temanmu lewat petunjuk singkat. Bisa pakai kata acak atau buat kata sendiri!",
    playStyle: "team",
    minPlayers: 3,
    maxPlayers: 12,
    icon: HatGlassesIcon,
    status: "available",
    accent: "yellow",
  },
  {
    id: "wordtrap",
    name: "Wordtrap",
    description:
      "Tebak kata rahasia dari huruf yang terbuka, rebut kesempatan menjawab, dan kecoh lawan dengan huruf jebakan.",
    playStyle: "ffa",
    minPlayers: 2,
    maxPlayers: 8,
    icon: KeyboardIcon,
    status: "available",
    accent: "cyan",
  },
  {
    id: "uno",
    name: "UNO",
    description:
      "Adu cepat menghabiskan kartu dengan kombinasi warna, aksi Skip dan Reverse, tumpuk +2/+4, serta teriak UNO!",
    playStyle: "ffa",
    minPlayers: 2,
    maxPlayers: 10,
    icon: PlayingCardsFanIcon,
    status: "available",
    accent: "green",
  },
  {
    id: "spaceteam",
    name: "Spaceteam",
    description:
      "Kerja sama di tengah kepanikan, tekan tombol sesuai instruksi teman sebelum pesawatmu meledak!",
    playStyle: "team",
    minPlayers: 2,
    maxPlayers: 8,
    icon: RocketIcon,
    status: "available",
    accent: "yellow",
  },
  {
    id: "ludo",
    name: "Ludo",
    description:
      "Lempar dadu dan balap 4 pion sampai garis akhir, lalu singkirkan pion lawan di sepanjang jalur.",
    playStyle: "ffa",
    minPlayers: 2,
    maxPlayers: 4,
    icon: DicesIcon,
    status: "coming_soon",
    accent: "cyan",
  },
  {
    id: "werewolf",
    name: "Werewolf",
    description:
      "Bertahan hidup dari Serigala lewat aksi rahasia di malam hari dan diskusi penuh curiga saat siang.",
    playStyle: "team",
    minPlayers: 5,
    maxPlayers: 16,
    icon: MoonIcon,
    status: "coming_soon",
    accent: "cyan",
  },
];

const SELECTED_GAME_STORAGE_KEY = "gemoji:selected_game_id";

export function loadSelectedGameId(): string {
  try {
    const saved = localStorage.getItem(SELECTED_GAME_STORAGE_KEY);
    if (saved && GAME_UI_CATALOG.some((g) => g.id === saved && g.status === "available")) {
      return saved;
    }
  } catch {
    // Ignore storage access issues
  }
  return "undercover";
}

export function saveSelectedGameId(gameId: string): void {
  if (!GAME_UI_CATALOG.some((g) => g.id === gameId && g.status === "available")) return;
  try {
    localStorage.setItem(SELECTED_GAME_STORAGE_KEY, gameId);
  } catch {
    // Ignore storage access issues
  }
}
