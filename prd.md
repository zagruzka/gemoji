# Product Requirements Document (PRD) — Gemoji! (Web Party Game Platform)

> **Status:** Active v1.1 (Fase 0 & Fase 1 MVP Selesai)  
> **Runtime & Stack:** Full Bun (Bun Workspaces + ElysiaJS + React + Tailwind CSS + `bun:sqlite`)  
> **Target Bahasa Awal:** Bahasa Indonesia (siap i18n)  

---

## 1. Ringkasan Produk & Visi

Membangun platform web **party game ringan real-time** yang dapat langsung dimainkan bersama teman dari browser HP maupun desktop **tanpa perlu registrasi atau instalasi aplikasi**.

Platform dirancang dengan arsitektur **modular (plugin-based)** sehingga sistem lobby, manajemen room, sesi guest, reconnect, timer, dan chat dibangun satu kali untuk melayani banyak game—dimulai dari **Undercover**, dilanjutkan **Werewolf**, **UNO**, dan siap dikembangkan untuk game baru di masa depan (misal: Spyfall, Codenames, Avalon).

### Nilai Utama
- **Zero-Friction Entry:** Masuk ke room lewat link atau kode 4–6 karakter dalam hitungan detik (cukup isi nickname & pilih avatar).
- **Mobile-First & Playful:** Nyaman dimainkan dengan satu tangan di smartphone, baik saat nongkrong tatap muka maupun sambil voice call (Discord/Meet).
- **Server-Authoritative & Fair:** Seluruh state rahasia (kata rahasia, role, kartu di tangan) dikelola di server; tiap klien hanya menerima proyeksi state yang boleh ia lihat.
- **Modular & Extensible:** Setiap game berdiri sebagai modul TypeScript murni yang terisolasi dan mudah dites.

---

## 2. Target Pengguna & Skenario Utama

- **Lingkaran Pertemanan & Komunitas:** Bermain santai saat nongkrong, kumpul keluarga, atau voice call Discord.
- **Tim Kerja / Organisasi:** Aktivitas *ice-breaking* singkat 5–15 menit via browser kantor/HP.

**Alur Utama Pengguna (Happy Path):**
1. Host membuka web → memilih game (misal: *Undercover*) → isi nickname & avatar → klik **Buat Room**.
2. Host membagikan **Link Room** atau **Kode Room** (contoh: `K4M8`) ke grup chat.
3. Pemain lain membuka link → isi nickname & avatar → otomatis masuk ke Lobby.
4. Host menyesuaikan pengaturan game (jumlah role, mode kata, timer & mode vote) → klik **Mulai Game**.
5. Game berjalan secara real-time di browser masing-masing. Setelah selesai, pemain dapat langsung klik **Main Lagi** atau **Ganti Game** tanpa keluar dari room.

---

## 3. Arsitektur & Tech Stack (Full Bun)

| Layer | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Runtime, Monorepo & Test** | **Bun** (`bun workspaces`, `bun test`) | Package manager, bundler, runtime server, dan unit test game engine. |
| **Backend & WebSocket** | **ElysiaJS** + Native `Bun.serve` WS | Memanfaatkan native WebSocket pub/sub Bun dan type-safety (Eden Treaty). |
| **Frontend** | **React + Vite (via Bun) + Tailwind CSS** | SPA mobile-first; menggunakan **Motion** untuk animasi kartu/transisi dan komponen UI modular. |
| **Validasi Schema** | **Zod** *(atau TypeBox)* | Validasi seluruh payload REST & event WebSocket di boundary server. |
| **Active Room State** | **In-Memory (`Map`)** via interface `RoomStore` | Zero-latency & atomic; diabstraksi agar mudah migrasi ke `Bun.redis` jika perlu multi-server. |
| **Database Persisten** | **`bun:sqlite` + Drizzle ORM** | Menyimpan daftar pasangan kata Undercover (Mode Library) dan log ringan (siap migrasi ke Postgres jika perlu). |
| **Deployment** | **Stateful Container (Docker / VPS / Fly.io / Railway)** | Satu instance Bun stateful untuk koneksi WebSocket tahan lama. |

### Struktur Monorepo

```text
gemoji/
├── package.json                      # Bun workspaces root
├── tsconfig.base.json
├── prd.md
├── apps/
│   ├── server/                       # ElysiaJS + WS Handler + RoomManager + gemoji.sqlite
│   └── web/                          # React + Tailwind + Lobby UI + Game UI Registry
└── packages/
    ├── shared/                       # Tipe & schema pesan WebSocket, Room, Player, Chat
    ├── game-core/                    # Kontrak GameModule, GameRegistry, RNG helper
    └── games/
        ├── undercover/               # Pure TS engine + default words + bun test
        ├── werewolf/                 # Pure TS engine + roles + bun test
        └── uno/                      # Pure TS engine + deck/rules + bun test
```

### Kontrak Modul Game (`GameModule`)
Setiap game di `packages/games/*` wajib mengimplementasikan kontrak standar di `packages/game-core`:
- `id`, `name`, `description`, `minPlayers`, `maxPlayers`, `defaultConfig`
- `init(players, config, context)` → menghasilkan `FullGameState` awal
- `validateAction(state, playerId, action)` → validasi aturan sebelum mutasi
- `reduce(state, playerId, action)` → transisi state murni (*pure function*)
- `onTimeout(state)` → penanganan otomatis saat timer fase/giliran habis
- `getPlayerView(state, playerId)` → proyeksi state aman khusus untuk `playerId` tertentu
- `getAllowedChatChannels(state, playerId)` → menentukan channel chat yang boleh dibaca/ditulis pemain
- `getWinner(state)` → mengembalikan hasil akhir & pemenang jika game selesai

---

## 4. Fitur Inti Platform (Shared Across All Games)

### 4.1 Guest Identity & Auto-Reconnect (MVP)
- Pemain tidak perlu membuat akun atau login.
- Saat masuk pertama kali, pemain memilih **Nickname** (2–16 karakter) dan **Avatar Preset**.
- Server membuat `playerId` + signed `sessionToken` yang disimpan di `httpOnly` cookie / `localStorage`.
- **Auto-Reconnect:** Jika koneksi terputus atau halaman di-refresh, klien otomatis menyambung kembali ke room dengan posisi, role, dan kartu yang sama.
- **Disconnect Grace Period:** Pemain yang terputus ditandai status *"Offline/Reconnecting"* (misal selama 60 detik) sebelum dianggap AFK atau dilewati gilirannya.
- **Host Migration:** Jika Host keluar secara permanen dari room, hak Host otomatis berpindah ke pemain aktif terlama berikutnya.

### 4.2 Manajemen Private Room & Lobby
- **Buat Room:** Menghasilkan kode room unik 4–6 huruf/angka (mudah dibaca, tanpa karakter ambigu seperti `0/O` atau `1/I`).
- **Gabung Room:** Melalui link langsung (`/room/:code`) atau input kode manual di halaman utama.
- **Lobby Controls:**
  - Daftar pemain real-time dengan badge Host dan status koneksi.
  - Tombol **Salin Link** / **Salin Kode**.
  - Host dapat mengubah **jenis game**, **konfigurasi game**, dan **mengeluarkan (kick)** pemain sebelum game dimulai (pemain yang dikeluarkan langsung dikembalikan ke Beranda disertai floating toast notifikasi).
  - Validasi jumlah pemain minimum & maksimum sebelum tombol **Mulai** aktif.
- **Post-Game Loop:** Setelah game selesai, tampil layar ringkasan hasil & reveal seluruh role/kata, lalu Host dapat memilih **Main Lagi** atau **Kembali ke Lobby (Ganti Game)**.

### 4.3 Sistem Text Chat Berbasis Channel
Setiap room memiliki fitur text chat real-time yang mendukung **isolasi channel berdasarkan fase & role game**:
- `lobby`: Chat terbuka saat di lobby dan pasca-game.
- `public`: Chat umum saat game berjalan (misal diskusi siang Werewolf, diskusi Undercover, obrolan santai UNO).
- `secret:<team>` (contoh: `werewolf_night`): Hanya pemain dengan role tertentu pada fase tertentu yang bisa mengirim dan menerima pesan di channel ini.
- `dead`: Channel khusus pemain yang sudah tereliminasi agar tetap bisa mengobrol tanpa membocorkan informasi ke pemain yang masih hidup.
- **System Messages:** Notifikasi otomatis di feed chat tampil kecil & samar tanpa background box agar obrolan pemain lebih menonjol.
- **Notifikasi Chat:** Bubble pratinjau di kanan atas dan *unread badge* (notification dot) pada ikon chat hanya muncul untuk **chat dari pemain lain** (bukan system message).
- **Rate Limiting:** Pembatasan spam pesan (maksimal 5 pesan per 5 detik per pemain).

### 4.4 Sinkronisasi Timer
- Timer berjalan di server dan mengirim `phaseEndsAt` (Unix timestamp, atau `null` jika disetel **Unlimited**) ke semua klien agar tampilan countdown tetap akurat meski jaringan fluktuatif.
- Jika durasi berbatas waktu dan timer habis, server memanggil `game.onTimeout(state)` agar permainan tidak pernah macet karena 1 pemain AFK. Jika **Unlimited**, fase berlanjut otomatis setelah seluruh pemain aktif menyelesaikan aksinya.

---

## 5. Spesifikasi Detail per Game

### 5.1 Game 1 — Undercover *(Prioritas Fase 1 / MVP)*

**Ringkasan:** Game deduksi kata rahasia. Mayoritas pemain (*Citizen*) mendapat kata yang sama, sebagian kecil (*Undercover*) mendapat kata yang mirip, dan opsional (*Mr. Blank*) tidak mendapat kata sama sekali.

- **Jumlah Pemain:** 3–12 pemain.
- **Role (Universal):**
  - **Citizen:** Mendapat *Kata A* (misal: `"Kopi"`).
  - **Undercover:** Mendapat *Kata B* yang mirip (misal: `"Teh"`).
  - **Mr. Blank (opsional):** Tidak mendapat kata; harus menebak kata Citizen jika tereliminasi.
- **Konfigurasi Room (diatur Host sebelum mulai):**
  - **Komposisi Role:** Menampilkan jumlah **Citizen** (dihitung otomatis), **Undercover** (bisa disetel `0` untuk bermain Citizen + Mr. Blank saja), dan **Mr. Blank** (bisa `0` atau lebih).
  - **Mode Kata (tanpa kategori):**
    - **Library:** Pasangan kata diambil secara acak langsung dari database `bun:sqlite` (tanpa kategori, tidak mengulang pasangan yang sudah dipakai di sesi room tersebut).
    - **Custom Word:** Pasangan kata dibuat langsung oleh para pemain di dalam room. Masing-masing pemain menginput **1 pasang kata**, lalu seluruh pasangan dikumpulkan ke *pool* room dan diacak oleh server untuk dipakai di tiap ronde hingga semuanya habis terpakai. Setelah seluruh pasangan kata terpakai dan room ingin main lagi, pemain diminta memasukkan 1 pasang kata baru kembali.
  - **Timer Clue:** `Skip` *(langsung ke voting, cocok untuk main tatap muka)*, `30s`, `45s`, atau `60s`.
  - **Waktu Vote:** `Unlimited`, `30s`, `60s`, atau `120s` (jika `Unlimited`, voting berakhir otomatis saat semua pemain hidup sudah memilih; pemain juga dapat memilih **Skip Voting**).
  - **Mode Vote:**
    - **Terbuka:** Pilihan vote setiap pemain langsung terlihat secara real-time oleh semua pemain dengan label `Voter`.
    - **Rahasia:** Pilihan disembunyikan selama voting berlangsung (hanya terlihat indikator *"sudah vote"*), lalu hasil diungkap setelah voting selesai.
  - **Blind Role (Checklist):** Jika dicentang, Citizen dan Undercover tidak diberi tahu role-nya di awal (hanya melihat kata); Mr. Blank tetap tahu dirinya Mr. Blank.
- **Alur Fase:**
  1. `SUBMIT_CUSTOM_WORDS` *(khusus Mode Custom Word saat pool kosong)*: Setiap pemain mengisi **1 pasang kata** (tidak boleh kosong/identik). Status siapa saja yang sudah mengirim tampil di layar. Setelah semua pemain mengirim, pasangan kata digabung, diacak, dan disimpan di *pool* room (server juga mengacak mana yang jadi kata Citizen vs Undercover, serta menghindari pembuat pasangan kata tersebut mendapat role **Mr. Blank** pada ronde itu).
  2. `REVEAL_WORD`: Setiap pemain wajib **menahan (*press-and-hold*)** kartu untuk mengintip kata rahasianya secara privat (termasuk tombol *Tahan Intip* di fase berikutnya; kartu Mr. Blank tampil bersih tanpa ikon `?`), lalu klik "Saya Siap!".
  3. `CLUE_ROUND` *(dilewati otomatis jika Timer Clue = `Skip` untuk main tatap muka)*: Urutan pemain diacak (Mr. Blank tidak pernah menjadi orang pertama di ronde 1). Tiap pemain mengetik 1 clue singkat secara bergiliran (clue tampil publik agar mudah diingat).
  4. `VOTING`: Semua pemain hidup berdiskusi lalu memilih 1 pemain untuk dieliminasi (atau memilih **Skip Voting**) sesuai **Waktu Vote** (`Unlimited` / `30s` / `60s` / `120s`) dan **Mode Vote** (`Terbuka` / `Rahasia`) yang dikonfigurasi Host. Jika seri atau mayoritas memilih Skip, tidak ada yang tereliminasi.
  5. `ELIMINATION_RESULT`: Hasil tiap ronde (eliminasi + role, Skip, seri, atau hasil tebakan Mr. Blank) diumumkan melalui **floating toast**.
     - Jika yang tereliminasi adalah **Mr. Blank**, masuk sub-fase `MR_BLANK_GUESS` (60 detik / 1 menit untuk menebak kata Citizen; perbandingan case-insensitive & trimmed).
  6. Ulangi dari `CLUE_ROUND` sampai kondisi menang terpenuhi. Saat memilih **Main Lagi** di Mode Custom Word, ronde berikutnya langsung mengambil pasangan kata acak berikutnya dari sisa *pool* (dan hanya kembali ke `SUBMIT_CUSTOM_WORDS` jika seluruh *pool* sudah habis terpakai).
- **Kondisi Menang:**
  - **Mr. Blank Menang:** Berhasil menebak kata Citizen dengan benar saat tereliminasi, atau bertahan hingga tersisa 2 pemain.
  - **Undercover Menang:** Jumlah pemain non-Citizen bertahan hingga tersisa 2 pemain total (atau jumlah Undercover >= jumlah Citizen).
  - **Citizen Menang:** Seluruh Undercover dan Mr. Blank berhasil dieliminasi.
- **Database Awal:** Minimal 100+ pasangan kata Bahasa Indonesia acak (tanpa kategori) di `bun:sqlite`, dengan pencegahan pengulangan pasangan kata yang sama dalam satu sesi room.

---

### 5.2 Game 2 — Werewolf *(Prioritas Fase 2)*

**Ringkasan:** Game deduksi sosial berbasis fase Malam dan Siang.

- **Jumlah Pemain:** 5–16 pemain.
- **Role Awal (v1 Werewolf):**
  - **Villager (Warga):** Tidak punya kemampuan malam; mencari Werewolf lewat diskusi & voting siang.
  - **Werewolf (Serigala):** Saat malam, dapat berdiskusi di channel rahasia `werewolf_night` dan memilih 1 target untuk diserang (konsensus/mayoritas).
  - **Seer (Penerawang):** Saat malam, dapat memeriksa 1 pemain untuk mengetahui apakah ia *Werewolf* atau *Bukan Werewolf*.
  - **Doctor (Pelindung):** Saat malam, dapat memilih 1 pemain untuk dilindungi dari serangan Werewolf (tidak boleh melindungi orang yang sama 2 malam berturut-turut).
  - **Hunter (Pemburu - opsional):** Jika mati, boleh menembak 1 pemain lain untuk ikut tereliminasi.
- **Konfigurasi Room:** Preset otomatis berdasarkan jumlah pemain atau kustomisasi jumlah tiap role, durasi Malam, durasi Diskusi Siang, **Waktu Vote** (`Unlimited` / `30s` / `60s` / `120s`), dan **Mode Vote** (`Terbuka` / `Rahasia`).
- **Alur Fase:**
  1. `ROLE_REVEAL`: Pemain melihat kartu role masing-masing (Werewolf melihat siapa sesama Werewolf).
  2. `NIGHT`: Chat publik dikunci; channel `werewolf_night` dibuka untuk Werewolf. Role aktif mengirim aksi malam secara simultan sebelum timer habis.
  3. `DAWN`: Server memproses resolusi malam (serangan vs perlindungan Doctor) dan mengumumkan korban (atau *"Malam yang damai"*).
  4. `DAY_DISCUSSION`: Chat publik dibuka untuk diskusi (pemain mati hanya bisa chat di channel `dead`).
  5. `DAY_VOTING`: Pemain hidup melakukan voting eliminasi (dapat memilih *Skip*).
  6. `EXECUTION`: Pemain dengan suara terbanyak dieksekusi & role-nya dibuka (opsional sesuai setting).
- **Kondisi Menang:**
  - **Tim Warga Menang:** Semua Werewolf tereliminasi.
  - **Tim Werewolf Menang:** Jumlah Werewolf yang hidup >= jumlah non-Werewolf yang hidup.

---

### 5.3 Game 3 — UNO *(Prioritas Fase 3)*

**Ringkasan:** Game kartu real-time cepat dengan aksi spesial dan mekanisme teriak "UNO!".

- **Jumlah Pemain:** 2–10 pemain.
- **Deck Standar (108 Kartu):**
  - 4 Warna (Merah, Kuning, Hijau, Biru): angka `0` (1x), `1–9` (2x), `Skip` (2x), `Reverse` (2x), `Draw Two / +2` (2x).
  - Kartu Wild: `Wild` (4x), `Wild Draw Four / +4` (4x).
- **Aturan Utama:**
  - Tiap pemain mulai dengan 7 kartu; 1 kartu angka dibuka di *Discard Pile*.
  - Pemain hanya boleh memainkan kartu yang cocok warna, angka/simbol, atau kartu Wild.
  - Mode 2 pemain: kartu `Reverse` berfungsi sebagai `Skip`.
  - Jika tidak ada kartu cocok (atau memilih ambil), pemain mengambil 1 kartu dari Deck; jika kartu baru tersebut valid, boleh langsung dimainkan.
  - **Mekanisme "UNO!":** Saat pemain akan menyisakan 1 kartu, ia harus menekan tombol **UNO!**; jika lupa sebelum pemain berikutnya jalan, pemain lain bisa menekan tombol **Tangkap!** untuk memberi penalti +2 kartu.
  - **Reshuffle Otomatis:** Jika Draw Deck habis, Discard Pile (selain kartu teratas) dikocok ulang menjadi Draw Deck baru.
  - **Timeout Giliran:** Jika waktu habis, server otomatis melakukan *draw 1 kartu* dan lanjut ke pemain berikutnya.
- **Konfigurasi Room:** Durasi timer giliran (15/20/30 detik), aturan opsional *Stacking +2/+4* (on/off).
- **Kondisi Menang:** Pemain pertama yang kartunya habis (0 kartu) menang.

---

## 6. Protokol WebSocket & Model Data

### 6.1 Event WebSocket (Ringkasan)

**Client → Server:**
- `ROOM_JOIN`: `{ roomCode, nickname, avatar }`
- `ROOM_UPDATE_CONFIG`: `{ gameId?, config? }` *(Host only)*
- `ROOM_KICK_PLAYER`: `{ targetPlayerId }` *(Host only)*
- `ROOM_START_GAME`: `{}` *(Host only)*
- `ROOM_RETURN_LOBBY`: `{}` *(Host only)*
- `GAME_ACTION`: `{ type, payload }` *(diteruskan ke `GameModule.reduce`)*
- `CHAT_SEND`: `{ channel, content }`

**Server → Client:**
- `SESSION_READY`: `{ playerId, isHost }`
- `ROOM_STATE`: `{ roomCode, status, gameId, config, players, hostId }`
- `GAME_STATE_VIEW`: `{ gameId, phase, phaseEndsAt, view }` *(unik per player!)*
- `CHAT_MESSAGE`: `{ id, channel, senderId, senderName, content, timestamp, isSystem }`
- `CHAT_HISTORY`: `{ messages }` *(dikirim otomatis saat join/reconnect)*
- `ERROR`: `{ code, message }`

### 6.2 Skema SQLite Awal (`bun:sqlite` + Drizzle)
- Lokasi file tunggal: `apps/server/gemoji.sqlite` (otomatis memakai `:memory:` saat `bun test`).
- `word_pairs`: `id`, `word_a`, `word_b`, `language` (`"id"`), `is_active` *(tanpa kategori; diambil acak untuk Mode Library Undercover)*.
- `match_logs` *(opsional/ringan)*: `id`, `game_id`, `player_count`, `duration_sec`, `created_at` (untuk statistik internal sederhana).
- *(Catatan: Pool pasangan kata untuk Mode Custom Word disimpan in-memory pada state room selama sesi berlangsung).*

---

## 7. Kebutuhan Non-Fungsional

- **UI/UX Mobile-First — Casual Arcade / Game UI Kit:**
  - Layout optimal di layar `360px` ke atas tanpa horizontal scroll yang mengganggu; tombol aksi besar di area jangkauan ibu jari (*thumb zone*).
  - **Design System (100% Tailwind CSS + SVG ringan):**
    - **Panel Kartu Krem + Header Ribbon:** Panel *rounded* krem hangat (`#F3EDC9`) dengan garis tepi lembut & bayangan, dilengkapi pita judul (*ribbon banner*) kontras dan tombol tutup bulat.
    - **Tombol 3D Pushable (*Juicy Buttons*):** Gradient cerah (Kuning-Oranye untuk aksi utama, Cyan-Biru untuk pengaturan, Hijau Lime untuk aksi konfirmasi/vote, Putih-Silver untuk aksi sekunder) dengan kilau atas (*glossy highlight*) dan bibir bawah 3D yang memendek saat ditekan (`active:translate-y-1`).
    - **HUD Pill, Floating Toast & Tombol Ikon Bulat Glossy:** Indikator Jumlah Pemain dan Timer di bar atas (salin link berada di dalam panel Lobby), tombol cepat Chat (*unread badge* + bubble pratinjau kanan atas khusus chat pemain), serta **Floating Toast** beranimasi *swipe from top + spring bounce* (bisa di-swipe ke atas untuk menutup).
    - **Tipografi:** Font display rounded tebal (`Fredoka` / `Baloo 2`) untuk judul & tombol dengan outline kontras lembut, dipadu `Nunito` untuk chat, clue, dan input agar nyaman dibaca di HP.
    - **Background Low-Poly Adaptif:** Latar belakang geometris halus berbasis SVG — Teal–Biru cerah untuk Home/Lobby/Undercover, Indigo Malam untuk fase *Night* Werewolf, dan aksen vibran untuk UNO.
  - Panel chat mudah dibuka-tutup (*drawer/collapsible*) di layar HP agar tidak menutupi papan permainan, dengan indikator *unread badge*.
- **Siap Internasionalisasi (i18n):**
  - Seluruh label UI dipisahkan ke file kamus teks (`locales/id.ts`) agar penambahan Bahasa Inggris (`en.ts`) di masa depan tidak perlu refactor komponen.
- **Keamanan & Anti-Cheat:**
  - Identitas pemain selalu diambil dari `ws.data` hasil verifikasi `sessionToken`, bukan dari payload klien.
  - Tidak pernah mengirim `FullGameState` ke klien; wajib selalu melewati `getPlayerView(state, playerId)`.
  - Sanitasi teks nickname, clue, dan pesan chat untuk mencegah XSS serta batasi panjang karakter.
- **Pengujian & Reliabilitas:**
  - Setiap modul di `packages/games/*` wajib memiliki unit test (`bun test`) yang mencakup alur penuh permainan, kondisi menang, *edge cases* (seri, disconnect, reshuffle deck, Mr. Blank guess), dan validasi kebocoran data pada `getPlayerView`.

---

## 8. Roadmap Implementasi Bertahap

### Fase 0 — Fondasi Monorepo & Infrastruktur ✅
- Inisialisasi Bun Workspaces (`apps/server`, `apps/web`, `packages/shared`, `packages/game-core`, `packages/games/undercover`).
- Setup ElysiaJS + native WebSocket pub/sub + Guest `sessionToken` + `InMemoryRoomStore`.
- Setup `bun:sqlite` (`apps/server/gemoji.sqlite`) + Drizzle ORM + seed 110 pasangan kata Undercover Bahasa Indonesia (acak, tanpa kategori).
- Setup React + Vite + Tailwind CSS + Game UI Kit + struktur i18n (`id.ts`) + WebSocket auto-reconnect client.

### Fase 1 (MVP) — Platform Lobby + Chat + Undercover ✅
- Implementasi penuh Lobby (buat room, gabung via kode/link, copy link, kick langsung kembali ke Beranda, ganti setting, host migration, auto-reconnect).
- Implementasi sistem Text Chat multi-channel (bubble kanan atas & unread dot khusus chat pemain, system chat samar tanpa box, rate limit).
- Implementasi engine `packages/games/undercover` + unit/integration test lengkap + UI mobile-first (Mode Library & Mode Custom Word 1 pasang/pemain, hold-to-peek kartu rahasia, komposisi Citizen/Undercover/Mr. Blank termasuk mode tanpa Undercover, Timer Clue `Skip`/`30d`/`45d`/`60d`, voting Terbuka/Rahasia + Skip Voting + timer `Unlimited`/`30d`/`60d`/`120d`, Mr. Blank guess 1 menit, hasil ronde via floating toast, layar hasil).
- **Target rilis:** Bisa dimainkan 3–12 orang secara online maupun tatap muka di HP/desktop.

### Fase 2 — Game Kedua: Werewolf
- Implementasi engine `packages/games/werewolf` + unit test (Villager, Werewolf, Seer, Doctor, Hunter).
- Aktifkan channel chat rahasia (`werewolf_night`, `dead`) dan animasi transisi Malam/Siang.
- Integrasi ke `GameRegistry` server & web tanpa mengubah logika inti lobby.

### Fase 3 — Game Ketiga: UNO
- Implementasi engine `packages/games/uno` + unit test (deck 108 kartu, Wild, Skip/Reverse/+2/+4, UNO call/catch, reshuffle).
- UI interaktif kartu tangan (kipas/scroll horizontal mobile-friendly) + animasi Motion + warna aktif.

### Fase 4 — Ekspansi (Post-MVP)
- Optional Login via **Better Auth** (Google & Discord OAuth) dengan fitur upgrade dari Guest.
- Simpan koleksi Custom Word permanen ke akun pengguna.
- Quick Emoji Reactions & Sound Effects (toggle mute).
- Penambahan Bahasa Inggris (`en.ts`) & game baru ke-4+.

---

## 9. Kriteria Keberhasilan (Definition of Done — MVP Fase 1)

- [x] Pengguna baru dapat membuat atau bergabung ke room dan siap bermain dalam **< 15 detik** tanpa login.
- [x] Refresh browser di tengah permainan Undercover mengembalikan pemain ke state & kata rahasia yang sama tanpa memutus game.
- [x] Pemain tidak dapat melihat kata atau role pemain lain melalui inspeksi jaringan (Network/WS tab).
- [x] Mode **Library** (acak tanpa kategori) dan Mode **Custom Word** (tiap pemain input 1 pasang kata → diacak sampai habis → minta input ulang) berjalan mulus.
- [x] Permainan Undercover 3–12 pemain berjalan lancar dari Lobby → Hold-to-Peek Reveal → Clue (atau `Skip` tatap muka) → Voting (Terbuka/Rahasia, Skip Voting, Unlimited/30s/60s/120s) → Mr. Blank Guess (1 menit) → Menang/Kalah → Main Lagi.
- [x] Seluruh unit & integration test lulus via `bun test`.
