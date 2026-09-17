import './styles.css';
import { CakeGame } from './game.js';
import { CAKES } from './cakes.js';
import { getState, updateState, generateReclaimCode } from './identity.js';
import { setMuted, isMuted } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const state = getState();
setMuted(!!state.muted);

const canvas = $('#game');
const scoreEl = $('#score');
const bestEl = $('#best');
const nextPreview = $('#next-preview');
const comboToast = $('#combo-toast');
const dropHint = $('#drop-hint');

bestEl.textContent = String(state.bestScore || 0);
$('#nick-input').value = state.nickname || '';

function paintNext(tier) {
  const c = CAKES[tier];
  nextPreview.style.background = `radial-gradient(circle at 35% 30%, #fff, ${c.color})`;
  nextPreview.textContent = c.emoji;
  nextPreview.title = c.name;
}

const game = new CakeGame(canvas, {
  onScore(n) {
    scoreEl.textContent = String(n);
  },
  onNext(tier) {
    paintNext(tier);
  },
  onCombo(n) {
    comboToast.hidden = false;
    comboToast.textContent = n >= 4 ? `¡COMBO x${n}! ✨` : `Combo x${n}!`;
    comboToast.classList.remove('pop');
    void comboToast.offsetWidth;
    comboToast.style.animation = 'none';
    void comboToast.offsetWidth;
    comboToast.style.animation = '';
    setTimeout(() => {
      comboToast.hidden = true;
    }, 700);
  },
  async onGameOver(score) {
    show('screen-over');
    $('#final-score').textContent = String(score);
    const msg = await submitScore(score);
    $('#score-msg').textContent = msg;
  },
});

paintNext(game.nextTier);

// Tier legend
$('#tier-legend').innerHTML = CAKES.map(
  (c) => `<span class="tier-chip" style="background:${c.icing};border:1px solid ${c.color}55">${c.emoji} ${c.name}</span>`
).join('');

function show(id) {
  ['screen-start', 'screen-how', 'screen-over', 'screen-board', 'screen-account'].forEach((s) => {
    $(`#${s}`).classList.toggle('hidden', s !== id);
  });
}

function hideAllOverlays() {
  ['screen-start', 'screen-how', 'screen-over', 'screen-board', 'screen-account'].forEach((s) => {
    $(`#${s}`).classList.add('hidden');
  });
}

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }));
  return data;
}

async function ensurePlayer(nickname) {
  const s = updateState({ nickname });
  await api('/api/player', {
    method: 'POST',
    body: JSON.stringify({ id: s.playerId, nickname }),
  });
}

async function submitScore(score) {
  const s = getState();
  try {
    const data = await api('/api/score', {
      method: 'POST',
      body: JSON.stringify({
        id: s.playerId,
        nickname: s.nickname || 'Jugador',
        score,
      }),
    });
    if (data.bestScore != null) {
      updateState({ bestScore: data.bestScore });
      bestEl.textContent = String(data.bestScore);
    }
    if (data.updated) {
      return data.previousBest > 0
        ? `¡Nuevo récord personal! Antes: ${data.previousBest}`
        : '¡Puntaje guardado en el ranking eterno!';
    }
    return data.message || 'Ya tienes un puntaje mejor guardado.';
  } catch {
    return 'No se pudo guardar el puntaje (sin conexión).';
  }
}

async function loadBoard() {
  const list = $('#board-list');
  list.innerHTML = '<li style="justify-content:center">Cargando…</li>';
  try {
    const data = await api('/api/leaderboard');
    const rows = data.leaderboard || [];
    if (!rows.length) {
      list.innerHTML = '<li style="grid-template-columns:1fr;text-align:center;color:#1e4f70aa">Aún no hay puntajes. ¡Sé el primero!</li>';
      return;
    }
    list.innerHTML = rows
      .map(
        (r, i) =>
          `<li><span class="rank">${i + 1}</span><span class="nick">${escapeHtml(r.nickname)}</span><span class="pts">${r.score}</span></li>`
      )
      .join('');
  } catch {
    list.innerHTML = '<li style="grid-template-columns:1fr;text-align:center">Error al cargar ranking</li>';
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function startGame() {
  const nick = ($('#nick-input').value || '').trim().slice(0, 24) || 'Jugador';
  updateState({ nickname: nick });
  ensurePlayer(nick);
  hideAllOverlays();
  dropHint.classList.remove('hide');
  setTimeout(() => dropHint.classList.add('hide'), 3500);
  game.start();
}

$('#btn-play').addEventListener('click', startGame);
$('#btn-how').addEventListener('click', () => show('screen-how'));
$('#btn-how-close').addEventListener('click', () => show('screen-start'));
$('#btn-again').addEventListener('click', () => {
  hideAllOverlays();
  game.start();
});
$('#btn-board').addEventListener('click', async () => {
  await loadBoard();
  show('screen-board');
});
$('#btn-over-board').addEventListener('click', async () => {
  await loadBoard();
  show('screen-board');
});
$('#btn-board-close').addEventListener('click', () => {
  if (game.gameOver) show('screen-over');
  else if (!game.running) show('screen-start');
  else hideAllOverlays();
});

$('#btn-mute').addEventListener('click', () => {
  const next = !isMuted();
  setMuted(next);
  updateState({ muted: next });
  $('#btn-mute').textContent = next ? '🔇' : '🔊';
  $('#btn-mute').classList.toggle('muted', next);
});
if (state.muted) {
  $('#btn-mute').textContent = '🔇';
  $('#btn-mute').classList.add('muted');
}

$('#btn-account').addEventListener('click', () => {
  $('#account-msg').textContent = '';
  $('#account-msg').classList.remove('error');
  show('screen-account');
});
$('#btn-account-close').addEventListener('click', () => {
  if (game.gameOver) show('screen-over');
  else if (!game.running) show('screen-start');
  else hideAllOverlays();
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const name = tab.dataset.tab;
    $('#tab-save').classList.toggle('hidden', name !== 'save');
    $('#tab-reclaim').classList.toggle('hidden', name !== 'reclaim');
  });
});

$('#btn-gen-code').addEventListener('click', () => {
  $('#code-save').value = generateReclaimCode();
});

$('#btn-save-wa').addEventListener('click', async () => {
  const msg = $('#account-msg');
  msg.classList.remove('error');
  const s = getState();
  const whatsapp = $('#wa-save').value;
  const reclaimCode = $('#code-save').value;
  if (!reclaimCode) {
    msg.textContent = 'Genera o escribe un código de recuperación.';
    msg.classList.add('error');
    return;
  }
  await ensurePlayer(s.nickname || 'Jugador');
  const data = await api('/api/identity/save', {
    method: 'POST',
    body: JSON.stringify({ id: s.playerId, whatsapp, reclaimCode }),
  });
  if (data.ok) {
    updateState({ hasWhatsapp: true });
    msg.textContent = data.message || 'Guardado.';
    msg.classList.remove('error');
  } else {
    msg.textContent = data.error || 'No se pudo guardar.';
    msg.classList.add('error');
  }
});

$('#btn-reclaim').addEventListener('click', async () => {
  const msg = $('#account-msg');
  msg.classList.remove('error');
  const data = await api('/api/identity/reclaim', {
    method: 'POST',
    body: JSON.stringify({
      whatsapp: $('#wa-reclaim').value,
      reclaimCode: $('#code-reclaim').value,
    }),
  });
  if (data.ok && data.player) {
    updateState({
      playerId: data.player.id,
      nickname: data.player.nickname,
      bestScore: data.player.bestScore,
      hasWhatsapp: true,
    });
    bestEl.textContent = String(data.player.bestScore || 0);
    $('#nick-input').value = data.player.nickname || '';
    msg.textContent = `¡Cuenta recuperada! Hola, ${data.player.nickname}. Récord: ${data.player.bestScore}`;
    msg.classList.remove('error');
  } else {
    msg.textContent = data.error || 'No se pudo recuperar.';
    msg.classList.add('error');
  }
});

$('#btn-share').addEventListener('click', async () => {
  const score = $('#final-score').textContent;
  const nick = getState().nickname || 'Jugador';
  const text = `🎂 Saqué ${score} puntos en Cake Play de Cake Studio Guatemala. ¿Me superas?\nhttps://juego.cakestudiogt.com`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Cake Play', text });
      return;
    }
  } catch {
    /* user cancelled or failed — fall through */
  }
  try {
    await navigator.clipboard.writeText(text);
    $('#score-msg').textContent = 'Texto copiado. ¡Pégalo en WhatsApp o Instagram!';
  } catch {
    prompt('Copia y comparte:', text);
  }
});

// Prefetch leaderboard quietly
api('/api/leaderboard').catch(() => {});
