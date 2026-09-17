import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getLeaderboard,
  getPlayer,
  upsertPlayer,
  submitScore,
  saveWhatsApp,
  reclaimAccount,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3847;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '32kb' }));

function rateKey(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown') + ':' + (req.body?.id || '');
}

const recent = new Map();
function softRateLimit(req, res, next) {
  const key = rateKey(req) + req.path;
  const now = Date.now();
  const last = recent.get(key) || 0;
  if (now - last < 250) {
    return res.status(429).json({ ok: false, error: 'Demasiado rápido. Espera un momento.' });
  }
  recent.set(key, now);
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'Pastel Run', version: '4.1.0', brand: 'Cake Studio Guatemala' });
});

app.get('/api/leaderboard', (_req, res) => {
  try {
    res.json({ ok: true, leaderboard: getLeaderboard(50) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al cargar ranking' });
  }
});

app.get('/api/player/:id', (req, res) => {
  try {
    const player = getPlayer(req.params.id);
    if (!player) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, player });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error' });
  }
});

app.post('/api/player', softRateLimit, (req, res) => {
  try {
    const { id, nickname } = req.body || {};
    if (!id || typeof id !== 'string' || id.length > 64) {
      return res.status(400).json({ ok: false, error: 'id inválido' });
    }
    const nick = String(nickname || 'Jugador').trim().slice(0, 24) || 'Jugador';
    const player = upsertPlayer({ id, nickname: nick });
    res.json({ ok: true, player });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al guardar jugador' });
  }
});

app.post('/api/score', softRateLimit, (req, res) => {
  try {
    const { id, nickname, score } = req.body || {};
    if (!id || typeof id !== 'string' || id.length > 64) {
      return res.status(400).json({ ok: false, error: 'id inválido' });
    }
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 10_000_000) {
      return res.status(400).json({ ok: false, error: 'puntaje inválido' });
    }
    const result = submitScore({ id, nickname, score });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al guardar puntaje' });
  }
});

app.post('/api/identity/save', softRateLimit, (req, res) => {
  try {
    const { id, whatsapp, reclaimCode } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id requerido' });
    const result = saveWhatsApp({ id, whatsapp, reclaimCode });
    res.status(result.ok ? 200 : 400).json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al vincular WhatsApp' });
  }
});

app.post('/api/identity/reclaim', softRateLimit, (req, res) => {
  try {
    const { whatsapp, reclaimCode } = req.body || {};
    const result = reclaimAccount({ whatsapp, reclaimCode });
    res.status(result.ok ? 200 : 400).json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al recuperar cuenta' });
  }
});

const dist = path.join(__dirname, '..', 'client', 'dist');
if (isProd) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('html').send(`
      <h1>Pastel Run API</h1>
      <p>Dev mode: open the Vite client (default http://localhost:5173).</p>
      <p>API: <a href="/api/leaderboard">/api/leaderboard</a></p>
    `);
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pastel Run (Cake Studio) listening on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'api-dev'})`);
});
