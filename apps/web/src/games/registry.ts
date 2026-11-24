export interface GameUiDescriptor {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  status: "available" | "coming_soon";
  accent: "yellow" | "cyan" | "green";
}

export const GAME_UI_CATALOG: readonly GameUiDescriptor[] = [
  {
    id: "undercover",
    name: "Undercover",
    subtitle: "Citizen · Undercover · Mr. Blank",
    description: "Tebak siapa penyusup lewat clue singkat — mode Library acak atau Custom Word 1 pasang/pemain!",
    minPlayers: 3,
    maxPlayers: 12,
    status: "available",
    accent: "yellow",
  },
  {
    id: "werewolf",
    name: "Werewolf",
    subtitle: "Fase 2 · Segera Hadir",
    description: "Aksi Malam rahasia dengan chat khusus Serigala, Penerawang, dan Pelindung.",
    minPlayers: 5,
    maxPlayers: 16,
    status: "coming_soon",
    accent: "cyan",
  },
  {
    id: "uno",
    name: "UNO",
    subtitle: "Fase 3 · Segera Hadir",
    description: "Kartu cepat real-time dengan +2/+4, Reverse, dan tombol teriak UNO!",
    minPlayers: 2,
    maxPlayers: 10,
    status: "coming_soon",
    accent: "green",
  },
];
