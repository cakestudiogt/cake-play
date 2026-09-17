# Pastel Run · Cake Studio Guatemala

Waiting-room endless runner for **Cake Studio Guatemala** — Subway Surfers–style 3-lane dash through the bakery. Spanish-first, mobile-first, forever global leaderboard.

**Game:** Pastel Run (v4.1)  
**Brand:** Cake Studio GT  
**Target URL:** https://juego.cakestudiogt.com  
**Repo:** https://github.com/cakestudiogt/cake-play

## Features

- Auto-run 3-lane corridor with rising speed
- Swipe / arrows / tap to change lanes; swipe up / ↑ / space to jump
- Collect **Mini** (10), **Lonchera** (25), **Capa** (50), **Boda** (100) — combo multiplies
- Avoid spilled trays, rolling pins, delivery boxes, frosting puddles (3 hearts)
- Game over → score, share/brag card with real logo, WhatsApp save CTA, ranking, replay
- Forever leaderboard (nickname + score only — WhatsApp never public)
- Higher-only score updates + “ya tienes mejor puntaje…”
- localStorage player id + WhatsApp (+502) reclaim code
- Express + better-sqlite3 + Vite · **PORT 3847**

## Brand

Real Cake Studio logos live in `client/public/brand/` (and source copies under `/brand`).

Primary `#ea98af` · cream `#f4eae9` · coral `#e97a6f` · navy `#1e4f70` · café `#BF6C58` · pistacho `#5ca370` · black.

## Local development

```bash
npm install
npm run build
PORT=3847 npm start
```

Open http://localhost:3847

### Dev mode

```bash
PORT=3847 npm run dev:server
npm run dev:client   # http://localhost:5173 proxies /api → :3847
```

### Verify

```bash
curl -s http://localhost:3847/api/health
curl -s http://localhost:3847/api/leaderboard
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3847/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3847/brand/logo-primary.png
```

## Deploy

1. `npm install && npm run build && NODE_ENV=production PORT=3847 npm start`
2. Persist `./data` (SQLite)
3. Proxy `juego.cakestudiogt.com` → Node on **3847**

| Variable   | Default   | Notes                             |
|------------|-----------|-----------------------------------|
| `PORT`     | `3847`    | HTTP listen port                  |
| `NODE_ENV` | —         | `production` serves `client/dist` |
| `DATA_DIR` | `./data`  | SQLite directory                  |

## API

| Method | Path                    | Purpose                          |
|--------|-------------------------|----------------------------------|
| GET    | `/api/health`           | Liveness (`name: Pastel Run`)    |
| GET    | `/api/leaderboard`      | Top scores                       |
| POST   | `/api/player`           | Upsert nickname                  |
| POST   | `/api/score`            | Submit score (keeps max only)    |
| POST   | `/api/identity/save`    | Link WhatsApp + reclaim code     |
| POST   | `/api/identity/reclaim` | Restore player id                |

## Privacy

WhatsApp numbers are stored only for reclaim and are **never** returned on the leaderboard. Reclaim codes are SHA-256 hashed.

## License

Proprietary © Cake Studio Guatemala. All rights reserved.
