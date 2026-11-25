export const idLocale = {
  appName: "Gemoji!",
  tagline: "Main game bareng teman langsung di browsermu",
  actions: {
    createRoom: "Buat Room!",
    joinRoom: "Gabung Room",
    rules: "Aturan Main",
    uiKit: "Preview UI Kit",
    back: "Kembali",
    copyLink: "Salin Link",
    startGame: "Mulai Game!",
    playAgain: "Main Lagi",
  },
  games: {
    undercover: {
      name: "Undercover",
      subtitle: "Citizen · Undercover · Mr. Blank",
      description: "Beri clue singkat dan temukan siapa penyusup yang punya kata berbeda!",
    },
    werewolf: {
      name: "Werewolf",
      subtitle: "Segera Hadir · Fase 2",
      description: "Bertahan hidup dari Serigala lewat aksi Malam dan diskusi Siang.",
    },
    uno: {
      name: "UNO",
      subtitle: "Segera Hadir · Fase 3",
      description: "Habiskan kartu di tanganmu lebih cepat dan jangan lupa teriak UNO!",
    },
  },
  roles: {
    citizen: "Citizen",
    undercover: "Undercover",
    mr_blank: "Mr. Blank",
  },
  config: {
    wordModeLibrary: "Library (Acak)",
    wordModeCustom: "Custom Word (1 pasang/pemain)",
    voteOpen: "Terbuka",
    voteSecret: "Rahasia",
    voteUnlimited: "Unlimited",
  },
  status: {
    online: "Server Online",
    offline: "Server Offline",
    comingSoon: "Segera Hadir",
    playable: "Siap Main",
  },
} as const;

export type LocaleDict = typeof idLocale;
