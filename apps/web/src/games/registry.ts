import {
  DicesIcon,
  HatGlassesIcon,
  KeyboardIcon,
  MoonIcon,
  PlayingCardsFanIcon,
  RocketIcon,
  type LucideIcon,
} from "lucide-react";

export interface GameUiDescriptor {
  id: string;
  name: string;
  description: string;
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
    description: "Tebak siapa penyusup lewat clue singkat — mode Library acak atau Custom Word 1 pasang/pemain!",
    minPlayers: 3,
    maxPlayers: 12,
    icon: HatGlassesIcon,
    status: "available",
    accent: "yellow",
  },
  {
    id: "wordtrap",
    name: "Wordtrap",
    description: "Adu tebak kata rahasia A–Z dengan Skill Trap huruf palsu dan rebutan tombol Tebak Kata!",
    minPlayers: 2,
    maxPlayers: 8,
    icon: KeyboardIcon,
    status: "available",
    accent: "cyan",
  },
  {
    id: "uno",
    name: "UNO",
    description: "Kartu cepat real-time dengan +2/+4, Reverse, dan tombol teriak UNO!",
    minPlayers: 2,
    maxPlayers: 10,
    icon: PlayingCardsFanIcon,
    status: "available",
    accent: "green",
  },
  {
    id: "spaceteam",
    name: "Spaceteam",
    description: "Kerja sama panik menekan tombol & tuas di layar teman sebelum pesawat meledak!",
    minPlayers: 2,
    maxPlayers: 8,
    icon: RocketIcon,
    status: "coming_soon",
    accent: "yellow",
  },
  {
    id: "ludo",
    name: "Ludo",
    description: "Balap 4 pion ke garis finish lewat lemparan dadu — makan pion lawan & rebut kemenangan!",
    minPlayers: 2,
    maxPlayers: 4,
    icon: DicesIcon,
    status: "coming_soon",
    accent: "cyan",
  },
  {
    id: "werewolf",
    name: "Werewolf",
    description: "Aksi Malam rahasia dengan chat khusus Serigala, Penerawang, dan Pelindung.",
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
