import './styles.css';
import { CakeGame } from './game.js';
import { getState, updateState, generateReclaimCode } from './identity.js';
import { setMuted, isMuted } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const state = getState();
setMuted(!!state.muted);

const canvas = $('#game');
const scoreEl = $('#score');
const levelEl = $('#level');
const heartsEl = $('#hearts');
const comboToast = $('#combo-toast');
const dropHint = $('#drop-hint');

$('#nick-input').value = state.nickname || '';

function paintHearts(n, max) {
  heartsEl.textContent = '❤'.repeat(Math.max(0, n)) + '♡'.repeat(Math.max(0, max - n));
}

const game = new CakeGame(canvas, {
  onScore(n) {
    scoreEl.textContent = String(n);
  },
  onLevel(n, total) {
    levelEl.textContent = String(n);
    levelEl.title = `${n} / ${total}`;
  },
  onHearts(n, max) {
    paintHearts(n, max);
  },
  onCombo(label) {
    showToast(label);
  },
  onToast(label) {
    showToast(label);
  },
  onBigWin(level, score) {
    $('#win-msg').textContent = `Completaste el nivel ${level}`;
    $('#win-score').textContent = String(score);
    show('screen-win');
  },
  async onGameOver(score, meta) {
    show('screen-over');
    $('#over-title').textContent = meta?.won ? '¡Pack completo!' : '¡Se acabó el azúcar!';
    $('#final-score').textContent = String(score);
    const s = getState();
    $('#over-best').textContent = `Nivel alcanzado: ${meta?.level || 1} · Tu récord: ${Math.max(
      score,
      s.bestScore || 0
    )}`;
    const msg = await submitScore(score);
    $('#score-msg').textContent = msg;
  },
});

function showToast(label) {
  if (!label) return;
  comboToast.hidden = false;
  comboToast.textContent = label;
  comboToast.style.animation = 'none';
  void comboToast.offsetWidth;
  comboToast.style.animation = '';
  clearTimeout(comboToast._t);
  comboToast._t = setTimeout(() => {
    comboToast.hidden = true;
  }, 900);
}

function show(id) {
  ['screen-start', 'screen-how', 'screen-over', 'screen-board', 'screen-account', 'screen-win'].forEach(
    (s) => {
      $(`#${s}`).classList.toggle('hidden', s !== id);
    }
  );
}

function hideAllOverlays() {
  ['screen-start', 'screen-how', 'screen-over', 'screen-board', 'screen-account', 'screen-win'].forEach(
    (s) => {
      $(`#${s}`).classList.add('hidden');
    }
  );
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
      list.innerHTML =
        '<li style="grid-template-columns:1fr;text-align:center;color:#1e4f70aa">Aún no hay puntajes. ¡Sé el primero!</li>';
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

async function paintLandingBoard() {
  const el = $('#landing-board');
  if (!el) return;
  try {
    const data = await api('/api/leaderboard');
    const rows = (data.leaderboard || []).slice(0, 5);
    if (!rows.length) {
      el.innerHTML = '<p class="landing-empty">Sé el primero en el ranking 🏆</p>';
      return;
    }
    el.innerHTML =
      '<p class="landing-title">Top 5</p><ol class="landing-list">' +
      rows
        .map(
          (r, i) =>
            `<li><span>${i + 1}. ${escapeHtml(r.nickname)}</span><strong>${r.score}</strong></li>`
        )
        .join('') +
      '</ol>';
  } catch {
    el.innerHTML = '';
  }
}

function shareText(score, extra = '') {
  return `🍬 Saqué ${score} puntos en Flechas de Azúcar (Cake Play) de Cake Studio Guatemala.${extra} ¿Me superas?\nhttps://juego.cakestudiogt.com`;
}

async function doShare(score, extra = '') {
  const text = shareText(score, extra);
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Flechas de Azúcar', text });
      return;
    }
  } catch {
    /* cancelled */
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('¡Texto copiado!');
  } catch {
    prompt('Copia y comparte:', text);
  }
}

function startGame() {
  const nick = ($('#nick-input').value || '').trim().slice(0, 24) || 'Jugador';
  updateState({ nickname: nick });
  ensurePlayer(nick);
  hideAllOverlays();
  document.getElementById('app').classList.add('playing');
  dropHint.classList.remove('hide');
  setTimeout(() => dropHint.classList.add('hide'), 3500);
  game.start();
}

$('#btn-play').addEventListener('click', startGame);
$('#btn-how').addEventListener('click', () => show('screen-how'));
$('#btn-how-close').addEventListener('click', () => show('screen-start'));
$('#btn-again').addEventListener('click', () => {
  hideAllOverlays();
  document.getElementById('app').classList.add('playing');
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

$('#btn-undo').addEventListener('click', () => {
  if (!game.undo()) showToast('Nada que deshacer');
});
$('#btn-restart').addEventListener('click', () => {
  game.restartLevel();
  showToast('Nivel reiniciado');
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
$('#btn-save-cta')?.addEventListener('click', () => {
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
    $('#nick-input').value = data.player.nickname || '';
    msg.textContent = `¡Cuenta recuperada! Hola, ${data.player.nickname}. Récord: ${data.player.bestScore}`;
    msg.classList.remove('error');
  } else {
    msg.textContent = data.error || 'No se pudo recuperar.';
    msg.classList.add('error');
  }
});

$('#btn-share').addEventListener('click', () => {
  doShare($('#final-score').textContent);
});
$('#btn-win-share').addEventListener('click', () => {
  doShare($('#win-score').textContent, ' ¡Gran racha!');
});
$('#btn-win-continue').addEventListener('click', () => {
  hideAllOverlays();
});

paintLandingBoard();
api('/api/leaderboard').catch(() => {});
