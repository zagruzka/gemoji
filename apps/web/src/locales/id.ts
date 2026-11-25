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
    wordtrap: {
      name: "Wordtrap",
      subtitle: "Reveal · Hidden · Skill Trap",
      description: "Adu tebak kata rahasia A–Z dengan Skill Trap huruf palsu dan rebutan tombol Tebak Kata!",
    },
    uno: {
      name: "UNO",
      subtitle: "108 Kartu · Stacking +2/+4 · UNO!",
      description: "Habiskan kartu di tanganmu lebih cepat dan jangan lupa teriak UNO!",
    },
    spaceteam: {
      name: "Spaceteam",
      subtitle: "Segera Hadir · Fase 4",
      description: "Saling berteriak instruksi dan tekan panel kontrol sebelum pesawat meledak!",
    },
    ludo: {
      name: "Ludo",
      subtitle: "Segera Hadir · Fase 5",
      description: "Balap 4 pion menuju Home lewat lemparan dadu dan kalahkan lawanmu!",
    },
    werewolf: {
      name: "Werewolf",
      subtitle: "Segera Hadir · Fase 6",
      description: "Bertahan hidup dari Serigala lewat aksi Malam dan diskusi Siang.",
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
