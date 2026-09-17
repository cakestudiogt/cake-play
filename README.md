# Cake Play · Flechas de Azúcar

Waiting-room puzzle for **Cake Studio Guatemala** — Arrows / Puzzle Escape–style clear-the-board with frosting arrows. Spanish-first, mobile-first, forever global leaderboard.

**Game mode:** Flechas de Azúcar (v3)  
**Shell brand:** Cake Play · Cake Studio GT  
**Target URL:** https://juego.cakestudiogt.com  
**Repo:** https://github.com/cakestudiogt/cake-play

## Features (v3)

- Grid of frosting arrows (↑↓←→); tap only when the path to the edge is clear
- Arrow slides into a **frosting portal** and clears — clear the whole board
- Blocked tap costs a life (3 per run); 0 lives → game over
- 80 generated + hand-tuned solvable levels with a brutal forced-order curve (order matters; hints only on L1–3)
- Undo last clear + restart current level
- **Run score** climbs with levels cleared (see Scoring)
- Forever leaderboard (nickname + score only — WhatsApp never public)
- Higher score updates; lower score shows “ya tienes mejor puntaje…”
- localStorage player id + optional WhatsApp (+502) save / reclaim code
- Share on game over and big-win milestones
- Express + better-sqlite3 + Vite static build · PORT 3847

## Scoring

Session / run score (what goes on the leaderboard):

- Clear level **N**: `100×N + 15×arrows + 40×heartsLeft + timeBonus(0–80) + comboBonus`
- Quick successive clears build combo (`+25` per streak step after the first)
- Finish all 80 levels: `+500` bonus, then run ends as a win
- Mistaps do not add points; they only cost hearts

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
