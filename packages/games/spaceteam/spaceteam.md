# Spaceteam: Game Design & Technical Specification

## 1. Konsep Inti & Alur Permainan

- **Genre:** Real-time Co-op Party Game (berbasis komunikasi suara langsung / *voice call*).
- **Jenis Permainan:** **Tim** (seluruh pemain menang atau kalah bersama).
- **Prinsip Utama:** Informasi dan eksekusi dipecah ke layar yang berbeda.
  - **3–8 Pemain:** **Pemain A (Instruktor)** membaca instruksi, **Pemain B** memegang parameter kondisi visual, dan **Pemain C (Aktor)** mengeksekusi modul aksi.
  - **2 Pemain:** Pembagian parameter bersifat **acak**. Parameter kondisi bisa muncul di layar **Instruktor** maupun di layar **Aktor**.
- **Tujuan:** Bekerja sama menyelesaikan rangkaian instruksi sebelum waktu habis untuk membawa pesawat luar angkasa melintasi **3 atau 5 Sektor** (default **5 Sektor**) tanpa membuat nyawa pesawat (*Hull Integrity*) menyentuh `0 HP`.
- **Konsekuensi Koneksi:** Pemain yang terputus/offline di tengah ronde tidak dilewati secara khusus; itu menjadi bagian dari risiko komunikasi tim.

---

## 2. Arsitektur UI: Sistem 3 Panel (Mobile-First, Tema Kokpit Gelap)

Layar setiap pemain menggunakan tema **kokpit luar angkasa gelap** (kontras tinggi untuk lampu, status, dan tombol) yang dibagi secara vertikal menjadi 3 zona tetap agar mudah dibaca sekilas dan nyaman dijangkau jempol tanpa perlu scroll berlebih:

- **Header Ringkas Kokpit:** Menampilkan nomor Sektor, bar progres sektor, dan *Hull Integrity* (`HP`) dalam satu strip tipis di atas (HUD "Waktu" global disembunyikan khusus saat bermain Spaceteam).

### Panel 1: Instruksi (*Top Banner*)
- Menampilkan **1 teks perintah aktif** beserta *progress bar countdown* horizontal tepat di bawahnya.
- **Waktu Mulai Countdown:** Berjalan seketika saat instruksi muncul di layar.
- **Sinkronisasi Waktu:** Server mengirimkan `serverNow` (serta `expiresAt` dan `durationMs`) agar animasi progress bar akurat di semua perangkat meski ada selisih jam lokal.
- **Konfirmasi Ready & Countdown Layar Penuh:** Sebelum Sektor 1 dimulai dan setiap kali naik sektor, seluruh pemain wajib menekan tombol **Ready**. Setelah semua kru siap, muncul overlay hitungan mundur `5 detik` yang menutupi layar game sebelum instruksi mulai berjalan.

### Panel 2: Parameter (*Middle Strip*)
- Panel baca-saja (*read-only*) yang menampilkan **1 indikator status** per pemain.
- Nilainya dikendalikan secara acak oleh server dan **dikunci selama masih dirujuk oleh instruksi `IF-ELSE` aktif** agar kondisi tidak berubah di tengah eksekusi.
- **Daftar 10 Indikator:**
  - **Lampu Sinyal (`SIGNAL_LAMP`):** `BIRU` | `KUNING` | `MERAH` | `HIJAU` | `HITAM` | `PUTIH` | `UNGU` (dengan border kontras tinggi untuk `PUTIH` dan `HITAM`).
  - **Suhu Mesin (`CORE_TEMP`):** $10^\circ\text{C}$ hingga $99^\circ\text{C}$.
  - **Mode Daya (`POWER_MODE`):** `ECO` | `TURBO` | `OVERLOAD`.
  - **Arah Kompas (`COMPASS`):** `UTARA` | `TIMUR` | `SELATAN` | `BARAT` | `TENGGARA` | `TIMUR LAUT` | `BARAT LAUT` | `BARAT DAYA`.
  - **Simbol/Bentuk (`SYMBOL_SHAPE`):** `HATI` | `BULAT` | `KOTAK` | `BINTANG` | `SEGITIGA` (varian `SOLID` / `HOLLOW`).
  - **Bar Baterai (`BATTERY_BARS`):** `1` hingga `5`.
  - **Bar Sinyal (`SIGNAL_BARS`):** `1` hingga `5`.
  - **Persentase Oksigen (`OXYGEN_PERCENTAGE`):** `1%` hingga `100%`.
  - **Lampu Berkedip (`BLINKING_LIGHTS`):** `ALWAYS_ON` (nyala terus) | `ALWAYS_OFF` (mati terus) | Pola kedip `1`, `2`, atau `3` kali (`280ms` nyala, `220ms` mati, `850ms` jeda lalu berulang).
  - **Jam Analog (`CLOCK`):** `1` hingga `12` (1 jarum jam tegas dengan penanda `12, 3, 6, 9` dan titik jam).

### Panel 3: Aksi / Modul Kontrol (*Bottom Grid*)
- Area interaktif utama di bagian bawah layar berupa kumpulan **Modul Kontrol** (arsitektur ekstensibel berbasis registry modul).
- **Aturan Konfirmasi & Reset Otomatis:**
  - Modul `TOGGLE`, `SLIDER`, dan `SELECTOR` memiliki tombol Konfirmasi (`OK`) besar di bagian bawah modul.
  - Modul `BUTTON` berupa keypad kode 4 digit (`1`, `2`, `3`, `4` + reset) yang **submit otomatis** saat 4 kode terisi (tanpa tombol `OK`).
  - Setiap selesai konfirmasi (benar maupun salah), state modul langsung ter-reset (`TOGGLE` semua `OFF`, `SLIDER` kembali ke `0`, `SELECTOR` kembali ke `null`, `BUTTON` kosong). Tombol `OK` otomatis nonaktif saat nilai masih kosong (`TOGGLE` semua `OFF`, `SLIDER` di `0`, `SELECTOR` masih `null`).
- **Skala Jumlah Modul per Layar:**
  - **2 Pemain:** `6` modul per pemain (grid `2 kolom × 3 baris`, total `12` modul di ruangan).
  - **3–8 Pemain:** `4` modul per pemain (grid `2 kolom × 2 baris`, total `12–32` modul di ruangan).
- **Bank Nama Modul:** Minimal `40` nama modul sci-fi berbahasa Inggris yang unik dan berbeda secara fonetik agar tidak membingungkan di voice call (tidak ada nama modul kembar dalam 1 sektor).
- **Modul v1 (4 Modul Dasar):**
  - `BUTTON`: Keypad angka `1`, `2`, `3`, `4` dan tombol reset (`↺`) untuk memasukkan kode 4 digit (misal `3324`), submit otomatis ketika 4 digit terisi.
  - `TOGGLE`: 5 saklar biner `ON`/`OFF` tanpa label angka, misal `[ON OFF ON OFF ON]`.
  - `SLIDER`: Penggeser angka bulat `1` sampai `10` (default/reset `1`).
  - `SELECTOR`: Pilihan 3 tingkat (`LOW` / `MED` / `HIGH`, default/reset `null`).
- **Modul Lanjutan (Ekspansi Berikutnya):**
  - `COLOR_SEQUENCE`: Tombol input urutan warna (misal `["MERAH", "BIRU", "KUNING"]`) dengan reset lokal saat salah konfirmasi.
  - `MAZE_NAV`: Navigasi bidak (`ATAS`, `KIRI`, `BAWAH`, `KANAN`) menuju koordinat target.

---

## 3. Progresi Tipe Instruksi & Aturan Anti-Konflik

1. **Aturan Generator Instruksi:**
   - **No Duplicate Target:** Tidak boleh ada 2 instruksi aktif yang menargetkan modul yang sama secara bersamaan.
   - **No No-Op Target:** Target value baru harus selalu berbeda dari nilai modul saat ini.
2. **Progresi Berdasarkan Sektor:**
   - **Sektor 1 – 2 (`DIRECT`):** Perintah langsung tanpa syarat agar pemain beradaptasi dengan posisi modul.
     - *Contoh:* *"Setel **Deretan Saklar Daya** ke **[1:ON, 2:OFF, 3:OFF, 4:ON]** lalu tekan OK."*
   - **Sektor 3 (`IF-ELSE` 2 Cabang):** Perintah bersyarat dengan maksimal **2 cabang** (`JIKA ...`, `SELAIN ITU ...`) yang merujuk pada Parameter di Panel 2 milik pemain lain (atau acak di mode 2 pemain).
   - **Sektor 4 – 5 (`IF-ELSE` 2–3 Cabang):** Perintah bersyarat hingga **3 cabang** (`JIKA ...`, `JIKA ...`, `SELAIN ITU ...`).
   - Parameter numerik (`CORE_TEMP`, `OXYGEN_PERCENTAGE`, `BATTERY_BARS`, `SIGNAL_BARS`, `CLOCK`) menggunakan syarat rentang/sifat sederhana (`< 50` / `>= 50`, `<= 2` / `>= 3`, `1–6` / `7–12`, ganjil/genap) agar cepat dibaca saat panik.

---

## 4. Pengaturan Lobby & Rumus Skala Waktu

### Pengaturan Host di Lobby (`SpaceteamConfig`)
- **Tingkat Kesulitan (`difficulty`):**
  - `practice` (**Latihan**): tanpa timer instruksi (`expiresAt = null`)
  - `relaxed` (**Santai**): faktor waktu `×1.25`
  - `normal` (**Normal**, default): faktor waktu `×1.00`
  - `panic` (**Panik**): faktor waktu `×0.85`
- **Jumlah Sektor (`totalSectors`):** `3` (Cepat) atau `5` (Standar, default).

### Rumus Perhitungan Durasi Instruksi

$$D = \max\Big(D_{\min},\; \text{round}\big((D_{\text{base}} - (S - 1) \cdot \Delta_{\text{sektor}} + (P - 2) \cdot \Delta_{\text{pemain}} + B_{\text{cond}}) \cdot M_{\text{diff}}\big)\Big)$$

Keterangan variabel:
- $D$: Durasi akhir instruksi (ms).
- $D_{\text{base}} = 10000\text{ ms}$ ($10\text{ detik}$): durasi dasar di Sektor 1 untuk 2 pemain.
- $D_{\min} = 5500\text{ ms}$ ($5.5\text{ detik}$): batas tercepat agar tetap manusiawi.
- $S$: Nomor sektor saat ini ($1 \le S \le \text{totalSectors}$).
- $\Delta_{\text{sektor}} = 1100\text{ ms}$: pengurangan waktu tiap naik 1 sektor.
- $P$: Jumlah pemain aktif ($2 \le P \le 8$).
- $\Delta_{\text{pemain}} = 1000\text{ ms}$: tambahan waktu per pemain ekstra di atas 2 orang.
- $B_{\text{cond}}$: Bonus waktu membaca aturan bersyarat (`0 ms` di Sektor 1–2; `+2500 ms` di Sektor 3–5).
- $M_{\text{diff}}$: Pengali kesulitan (`1.25` Santai, `1.0` Normal, `0.85` Panik).

### Simulasi Durasi Normal (Detik)

| Sektor | Tipe | 2 Pemain | 4 Pemain | 8 Pemain |
| :--- | :--- | :---: | :---: | :---: |
| **Sektor 1** | `DIRECT` | 10.0 dtk | 12.0 dtk | 16.0 dtk |
| **Sektor 2** | `DIRECT` | 8.9 dtk | 10.9 dtk | 14.9 dtk |
| **Sektor 3** | `IF-ELSE` (2 cabang) | 10.3 dtk | 12.3 dtk | 16.3 dtk |
| **Sektor 4** | `IF-ELSE` (2–3 cabang) | 9.2 dtk | 11.2 dtk | 15.2 dtk |
| **Sektor 5** | `IF-ELSE` (2–3 cabang) | 8.1 dtk | 10.1 dtk | 14.1 dtk |

---

## 5. Alur Aksi, Validasi & Konsekuensi Penalti

### 1. Eksekusi Benar (*Correct Action*)
- Bar progres sektor bertambah `+1`.
- Pemilik Panel 1 (Instruktor) dan Panel 3 (Aktor) menerima kilat hijau (*success flash*).
- Instruksi lama dihapus, lalu setelah jeda `500 ms` server mengirim instruksi baru.

### 2. Salah Konfirmasi (*Wrong Value*)
Jika pemain menekan tombol Konfirmasi (`OK`) pada modul yang tidak sedang ditargetkan atau mengirim *value* yang salah:
- **Base Hull Damage:** Nyawa pesawat berkurang `-10 HP`.
- **Konsekuensi Spesifik Modul:** Setiap modul mendukung hook konsekuensi lokalnya sendiri (untuk ekspansi seperti reset `COLOR_SEQUENCE` / `MAZE_NAV`).
- **Instruksi Tetap Aktif:** Instruksi **tidak** langsung dihapus agar tim bisa segera mengoreksi kesalahannya sebelum waktu habis.

### 3. Instruksi Timeout (`0 detik`)
Jika *countdown* di Panel 1 menyentuh `0` sebelum dikonfirmasi dengan benar:
- **Hull Damage:** Nyawa pesawat berkurang `-10 HP`.
- **Reset:** Instruksi hangus, dan server memunculkan instruksi baru setelah jeda `500 ms`.

> **Visual Feedback Global:** Setiap kali terjadi pengurangan *Hull Integrity* (baik dari salah konfirmasi maupun *timeout*), seluruh layar pemain berkedip merah.

---

## 6. Progresi Sektor, Menang/Kalah & Statistik Akhir

- **Nyawa Pesawat (*Hull Integrity*):** Dimulai dari `100 HP` (maksimal `100 HP`).
- **Target Progres per Sektor:**
  $$\text{TargetSektor}(S, P) = 8 + (S - 1) \times 3 + (P - 2) \times 2$$
  *(Contoh: 2 pemain = `8, 11, 14, 17, 20`; 4 pemain = `12, 15, 18, 21, 24`; 8 pemain = `20, 23, 26, 29, 32`).*
- **Transisi Sektor:** Saat sektor selesai, nyawa pesawat pulih `+15 HP` (maksimal `100 HP`), seluruh parameter dan modul diacak ulang, lalu seluruh kru menekan tombol **Ready** sebelum hitungan mundur `5 detik` memulai sektor berikutnya.
- **Kondisi Menang (*Victory*):** Menyelesaikan sektor terakhir (`totalSectors`).
- **Kondisi Kalah (*Game Over*):** *Hull Integrity* mencapai `0 HP`.
- **Layar Hasil (*Post-Game Summary*):**
  - Ringkasan misi: Sektor tercapai, total instruksi selesai, dan sisa Hull HP.
  - **MVP:** Pemain dengan jumlah eksekusi benar terbanyak.
  - **Biang Kerok:** Pemain dengan jumlah salah konfirmasi terbanyak (jika semua pemain `0` salah, tampilkan lencana *"Kru Sempurna: 0 Kesalahan!"*).
