import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'cake-play.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    whatsapp TEXT UNIQUE,
    reclaim_code_hash TEXT,
    best_score INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_players_best_score ON players(best_score DESC);
  CREATE INDEX IF NOT EXISTS idx_players_whatsapp ON players(whatsapp);
`);

export function hashCode(code) {
  return crypto.createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
}

export function normalizeWhatsApp(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('502') && digits.length === 11) return digits;
  if (digits.length === 8) return '502' + digits;
  if (digits.startsWith('0') && digits.length === 9) return '502' + digits.slice(1);
  return digits.length >= 8 ? digits : null;
}

export function getLeaderboard(limit = 50) {
  return db
    .prepare(
      `SELECT nickname, best_score AS score
       FROM players
       WHERE best_score > 0
       ORDER BY best_score DESC, updated_at ASC
       LIMIT ?`
    )
    .all(limit);
}

export function getPlayer(id) {
  return db.prepare('SELECT id, nickname, best_score, whatsapp IS NOT NULL AS has_whatsapp FROM players WHERE id = ?').get(id);
}

export function upsertPlayer({ id, nickname }) {
  const existing = db.prepare('SELECT id FROM players WHERE id = ?').get(id);
  if (existing) {
    db.prepare(
      `UPDATE players SET nickname = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(nickname.slice(0, 24), id);
  } else {
    db.prepare(
      `INSERT INTO players (id, nickname) VALUES (?, ?)`
    ).run(id, nickname.slice(0, 24));
  }
  return getPlayer(id);
}

export function submitScore({ id, nickname, score }) {
  const safeScore = Math.max(0, Math.floor(Number(score) || 0));
  const safeNick = String(nickname || 'Jugador').trim().slice(0, 24) || 'Jugador';

  let player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
  if (!player) {
    db.prepare(`INSERT INTO players (id, nickname, best_score) VALUES (?, ?, ?)`).run(
      id,
      safeNick,
      safeScore
    );
    return {
      ok: true,
      updated: true,
      bestScore: safeScore,
      previousBest: 0,
      message: null,
      leaderboard: getLeaderboard(),
    };
  }

  db.prepare(`UPDATE players SET nickname = ?, updated_at = datetime('now') WHERE id = ?`).run(
    safeNick,
    id
  );

  if (safeScore > player.best_score) {
    db.prepare(
      `UPDATE players SET best_score = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(safeScore, id);
    return {
      ok: true,
      updated: true,
      bestScore: safeScore,
      previousBest: player.best_score,
      message: null,
      leaderboard: getLeaderboard(),
    };
  }

  return {
    ok: true,
    updated: false,
    bestScore: player.best_score,
    previousBest: player.best_score,
    message:
      'Ya tienes un puntaje mejor guardado (' +
      player.best_score +
      '). ¡Sigue intentando superar tu récord!',
    leaderboard: getLeaderboard(),
  };
}

export function saveWhatsApp({ id, whatsapp, reclaimCode }) {
  const wa = normalizeWhatsApp(whatsapp);
  if (!wa) {
    return { ok: false, error: 'WhatsApp inválido. Usa un número de Guatemala (+502).' };
  }
  if (!reclaimCode || String(reclaimCode).trim().length < 4) {
    return { ok: false, error: 'El código de recuperación debe tener al menos 4 caracteres.' };
  }

  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
  if (!player) {
    return { ok: false, error: 'Jugador no encontrado. Juega una partida primero.' };
  }

  const taken = db.prepare('SELECT id FROM players WHERE whatsapp = ? AND id != ?').get(wa, id);
  if (taken) {
    return {
      ok: false,
      error: 'Ese WhatsApp ya está vinculado a otra cuenta. Usa Recuperar cuenta.',
    };
  }

  db.prepare(
    `UPDATE players SET whatsapp = ?, reclaim_code_hash = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(wa, hashCode(reclaimCode), id);

  return {
    ok: true,
    message: '¡Listo! Guarda tu código de recuperación. Tu WhatsApp nunca se muestra en público.',
  };
}

export function reclaimAccount({ whatsapp, reclaimCode }) {
  const wa = normalizeWhatsApp(whatsapp);
  if (!wa) {
    return { ok: false, error: 'WhatsApp inválido.' };
  }
  const player = db
    .prepare('SELECT * FROM players WHERE whatsapp = ? AND reclaim_code_hash = ?')
    .get(wa, hashCode(reclaimCode));

  if (!player) {
    return { ok: false, error: 'No encontramos esa cuenta. Revisa WhatsApp y código.' };
  }

  return {
    ok: true,
    player: {
      id: player.id,
      nickname: player.nickname,
      bestScore: player.best_score,
      hasWhatsapp: true,
    },
  };
}

export default db;
