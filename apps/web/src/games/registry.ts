import { DicesIcon, HatGlassesIcon, MoonIcon, PlayingCardsFanIcon, type LucideIcon } from "lucide-react";

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
    id: "uno",
    name: "UNO",
    description: "Kartu cepat real-time dengan +2/+4, Reverse, dan tombol teriak UNO!",
    minPlayers: 2,
    maxPlayers: 10,
    icon: PlayingCardsFanIcon,
    status: "coming_soon",
    accent: "green",
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
  {
    id: "ludo",
    name: "Ludo",
    description: "Main ludo online",
    minPlayers: 2,
    maxPlayers: 4,
    icon: DicesIcon,
    status: "coming_soon",
    accent: "cyan",
  },
];
