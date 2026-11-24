# Gemoji!

Platform web party game real-time ringan berbasis **Full Bun** (`Bun Workspaces` + `ElysiaJS` + `React` + `Tailwind CSS` + `bun:sqlite`). Bisa langsung dimainkan bersama teman dari browser HP maupun desktop tanpa login.

### Daftar Game
- **Undercover** *(Aktif)* — Citizen · Undercover · Mr. Blank (Mode Library acak & Custom Word 1 pasang/pemain, Timer Clue `Skip`/`30d`/`45d`/`60d`, Vote `Terbuka`/`Rahasia` + `Skip Voting`, Mr. Blank guess 1 menit).
- **Werewolf** *(Segera Hadir)*
- **UNO** *(Segera Hadir)*

---

## Quick Start

Prasyarat: **[Bun](https://bun.sh) v1.2+**

```bash
# 1. Install dependensi workspace
bun install

# 2. Jalankan mode development (Server :3001 + Web :5173)
bun run dev
```

Buka `http://localhost:5173` di browser. Untuk mencoba mode production secara lokal (1 server, port `3001`):

```bash
bun run prod
```

---

## Scripts

| Perintah | Fungsi |
| :--- | :--- |
| `bun run dev` | Menjalankan server (`@gemoji/server`) dan web (`@gemoji/web`) secara paralel |
| `bun run dev:server` | Menjalankan backend ElysiaJS + WebSocket dalam mode watch (`:3001`) |
| `bun run dev:web` | Menjalankan frontend Vite dev server (`:5173`) |
| `bun run build` | Build produksi frontend ke `apps/web/dist` |
| `bun run start` | Menjalankan server produksi (melayani `apps/web/dist`, `/api/*`, dan `/ws`) |
| `bun run prod` | Menjalankan `build` lalu `start` |
| `bun test` | Menjalankan unit & integration test (`bun:sqlite` otomatis `:memory:`) |
| `bun run db:seed` | Mengisi database `apps/server/gemoji.sqlite` dengan 110 pasangan kata default |
| `bun run typecheck` | Typecheck TypeScript di seluruh workspace `@gemoji/*` |

---

## Environment Variables

| Variable | Default | Keterangan |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Set ke `production` di server VPS |
| `HOST` | `0.0.0.0` | Host bind server (`127.0.0.1` jika di belakang Caddy/Nginx) |
| `PORT` | `3001` | Port HTTP & WebSocket |
| `DATABASE_PATH` | `apps/server/gemoji.sqlite` | Lokasi file SQLite persisten |
| `SESSION_SECRET` | *(dev default)* | **Wajib diganti** di production (`openssl rand -hex 32`) |

---

## Deploy di VPS Ubuntu (Tanpa Docker)

### 1. Install Bun & Build
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

cd /var/www/gemoji
bun install --frozen-lockfile
bun run build
mkdir -p /var/www/gemoji/data
```

### 2. Buat `.env`
Buat `/var/www/gemoji/.env`:
```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3001
DATABASE_PATH=/var/www/gemoji/data/gemoji.sqlite
SESSION_SECRET=ganti-dengan-output-openssl-rand-hex-32
```

### 3. Jalankan via `systemd`
Buat `/etc/systemd/system/gemoji.service` *(sesuaikan `User` dan path binary dari `which bun`)*:
```ini
[Unit]
Description=Gemoji! Party Game Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/gemoji
EnvironmentFile=/var/www/gemoji/.env
ExecStart=/home/ubuntu/.bun/bin/bun run apps/server/src/index.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Aktifkan service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gemoji
sudo systemctl status gemoji
```

### 4. Reverse Proxy HTTPS + WebSocket

**Opsi A — Caddy (SSL otomatis):**
```caddy
gemoji.domainmu.com {
    reverse_proxy 127.0.0.1:3001
}
```
```bash
sudo systemctl reload caddy
```

**Opsi B — Nginx (+ Certbot):**
```nginx
server {
    listen 80;
    server_name gemoji.domainmu.com;

    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/gemoji /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d gemoji.domainmu.com
```

### 5. Update di VPS
```bash
cd /var/www/gemoji
git pull
bun install --frozen-lockfile
bun run build
sudo systemctl restart gemoji
```
