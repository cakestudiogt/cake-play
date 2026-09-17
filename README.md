# Cake Play · Cake Blast

Waiting-room puzzle for **Cake Studio Guatemala** — Block Blast–style place-and-clear with cake blocks. Spanish-first, mobile-first, forever global leaderboard.

**Game mode:** Cake Blast  
**Shell brand:** Cake Play · Cake Studio GT  
**Target URL:** https://juego.cakestudiogt.com  
**Repo:** https://github.com/cakestudiogt/cake-play

## Features (v2 — Cake Blast)

- 8×8 board · 3 cake-block polyominoes at a time · drag / tap-place
- Clear full **rows and columns** with frosting burst particles + combo juice
- Multi-line clears: ¡Doble! ¡Triple! ¡Mega clear! · streak combo bonus
- No Tetris gravity — pure Block Blast place-and-clear
- One forever leaderboard (nickname + score only — WhatsApp never public)
- Higher score updates; lower score shows “ya tienes mejor puntaje…”
- localStorage player id + optional WhatsApp (+502) save / reclaim code
- Game-over share + WhatsApp save CTA
- Express + better-sqlite3 + Vite static build · PORT 3847

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
2. **Persist SQLite** — mount a volume on `./data` (or set `DATA_DIR`).
3. **Reverse proxy** — `juego.cakestudiogt.com` → Node on 3847.

### Environment

| Variable   | Default   | Notes                             |
|------------|-----------|-----------------------------------|
| `PORT`     | `3847`    | HTTP listen port                  |
| `NODE_ENV` | —         | `production` serves `client/dist` |
| `DATA_DIR` | `./data`  | SQLite directory                  |

## API (brief)

| Method | Path                    | Purpose                                |
|--------|-------------------------|----------------------------------------|
| GET    | `/api/health`           | Liveness                               |
| GET    | `/api/leaderboard`      | Top scores (nickname + score)          |
| POST   | `/api/player`           | Upsert nickname                        |
| POST   | `/api/score`            | Submit score (keeps max only)          |
| POST   | `/api/identity/save`    | Link WhatsApp + reclaim code (private) |
| POST   | `/api/identity/reclaim` | Restore player id across devices       |

## Privacy

WhatsApp numbers are stored only for reclaim and are **never** returned on the leaderboard. Reclaim codes are stored as SHA-256 hashes.

## License

Proprietary © Cake Studio Guatemala. All rights reserved.
