const KEY = 'cakeplay.v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getState() {
  const s = load();
  if (!s.playerId) {
    s.playerId = crypto.randomUUID();
    s.nickname = s.nickname || '';
    s.bestScore = s.bestScore || 0;
    s.muted = !!s.muted;
    s.hasWhatsapp = !!s.hasWhatsapp;
    save(s);
  }
  return s;
}

export function updateState(patch) {
  const s = { ...getState(), ...patch };
  save(s);
  return s;
}

export function generateReclaimCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'CAKE';
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
