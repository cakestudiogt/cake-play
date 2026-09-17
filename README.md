# Cake Play

Waiting-room merge game for **Cake Studio Guatemala** — fuse cupcakes into a wedding cake (Suika-style). Spanish-first, mobile-first, forever global leaderboard.

**Target URL:** https://juego.cakestudiogt.com  
**Repo:** https://github.com/cakestudiogt/cake-play

## Features (v1)

- Merge cakes: Cupcake → Mini → Lonchera → Capa → Torre → Fiesta → Boda
- Matter.js gravity physics, aim / drop, danger line, combos + juice + mute
- One forever leaderboard (nickname + score only — WhatsApp never public)
- Higher score updates; lower score shows a friendly “ya tienes mejor puntaje” message
- localStorage player id + optional WhatsApp (+502) save / reclaim code
- Game-over share (Web Share API + clipboard / text fallback)
- Single deployable Node app: Express + better-sqlite3 + Vite static build

## Brand

Primary `#ea98af` · cream `#f4eae9` · coral `#e97a6f` · navy `#1e4f70` · terracotta `#BF6C58` · accent `#5ca370` · black.

## Local development

```bash
npm install
npm run build          # builds client → client/dist
PORT=3847 npm start    # serves API + static UI
```

Open http://localhost:3847

### Dev mode (hot reload UI)

```bash
npm install
# terminal A — API
PORT=3847 npm run dev:server
# terminal B — Vite (proxies /api → :3847)
npm run dev:client
```

Open http://localhost:5173

### Verify

```bash
curl -s http://localhost:3847/api/health
curl -s http://localhost:3847/api/leaderboard
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3847/
```

## Deploy to juego.cakestudiogt.com

Any Node 18+ host works (Railway, Render, Fly.io, VPS, etc.).

1. **Build & start**
   ```bash
   npm install
   npm run build
   NODE_ENV=production PORT=3847 npm start
   ```
2. **Persist SQLite** — mount a volume on `./data` (or set `DATA_DIR` to a persistent path). The DB file is `cake-play.sqlite`.
3. **Reverse proxy** — point `juego.cakestudiogt.com` → the Node process (HTTPS termination at nginx/Caddy/Cloudflare).
4. **Example Caddy**
   ```
   juego.cakestudiogt.com {
     reverse_proxy 127.0.0.1:3847
   }
   ```
5. **Example nginx**
   ```
   server {
     server_name juego.cakestudiogt.com;
     location / {
       proxy_pass http://127.0.0.1:3847;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```
6. **Process manager** (VPS): `pm2 start server/index.js --name cake-play -i 1` with `NODE_ENV=production` (single instance recommended for SQLite).

### Environment

| Variable   | Default   | Notes                          |
|------------|-----------|--------------------------------|
| `PORT`     | `3847`    | HTTP listen port               |
| `NODE_ENV` | —         | `production` serves `client/dist` |
| `DATA_DIR` | `./data`  | SQLite directory               |

## API (brief)

| Method | Path                 | Purpose                                      |
|--------|----------------------|----------------------------------------------|
| GET    | `/api/health`        | Liveness                                     |
| GET    | `/api/leaderboard`   | Top scores (nickname + score)                |
| POST   | `/api/player`        | Upsert nickname                              |
| POST   | `/api/score`         | Submit score (keeps max only)                |
| POST   | `/api/identity/save` | Link WhatsApp + reclaim code (private)       |
| POST   | `/api/identity/reclaim` | Restore player id across devices          |

## Privacy

WhatsApp numbers are stored only for reclaim and are **never** returned on the leaderboard or public player payloads (only a boolean `has_whatsapp`). Reclaim codes are stored as SHA-256 hashes.

## License

Proprietary © Cake Studio Guatemala. All rights reserved.
