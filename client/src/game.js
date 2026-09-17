import {
  LEVELS,
  cloneLevel,
  countArrows,
  pathClear,
  listMovable,
} from './levels.js';
import {
  sfxSlide,
  sfxClear,
  sfxBlocked,
  sfxCombo,
  sfxLevelUp,
  sfxGameOver,
  vibrate,
} from './audio.js';

const DELTA = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
const ARROW_GLYPH = { U: '↑', D: '↓', L: '←', R: '→' };
const COLORS = {
  U: '#1e4f70',
  D: '#BF6C58',
  L: '#e97a6f',
  R: '#5ca370',
};
const MAX_HEARTS = 3;

/**
 * Scoring (documented in UI):
 * - Run score climbs across levels until you lose all hearts.
 * - Clear a level: 100 × nivel + 15 × flechas + 40 × vidas restantes + time bonus (0–80).
 * - Quick clears within 1.2s of each other add combo (+25 per streak step).
 * - Mistap (blocked path): −1 vida. 0 vidas → fin de partida.
 * - Leaderboard stores best run score (higher only).
 */
export class CakeGame {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.running = false;
    this.gameOver = false;
    this.levelIndex = 0;
    this.score = 0;
    this.hearts = MAX_HEARTS;
    this.grid = null;
    this.size = 0;
    this.undoStack = [];
    this.anim = null; // { r,c,dir, progress, fromR, fromC, trail[] }
    this.flash = null; // { r,c, t, kind }
    this.particles = [];
    this.comboStreak = 0;
    this.lastClearAt = 0;
    this.levelStartedAt = 0;
    this.arrowsAtStart = 0;
    this.dpr = 1;
    this.boardRect = { x: 0, y: 0, w: 0, h: 0, cell: 0 };
    this._raf = 0;
    this._bind();
    this._resize();
  }

  _bind() {
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    this.canvas.addEventListener('pointerdown', (e) => this._onPointer(e));
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    cancelAnimationFrame(this._raf);
  }

  start() {
    this.running = true;
    this.gameOver = false;
    this.levelIndex = 0;
    this.score = 0;
    this.hearts = MAX_HEARTS;
    this.undoStack = [];
    this.anim = null;
    this.flash = null;
    this.particles = [];
    this.comboStreak = 0;
    this.lastClearAt = 0;
    this._loadLevel(0);
    this.hooks.onScore?.(this.score);
    this.hooks.onLevel?.(1, LEVELS.length);
    this.hooks.onHearts?.(this.hearts, MAX_HEARTS);
    this._loop();
  }

  _loadLevel(idx) {
    const src = LEVELS[idx % LEVELS.length];
    const level = cloneLevel(src);
    this.levelIndex = idx;
    this.grid = level.grid;
    this.size = level.size;
    this.undoStack = [];
    this.anim = null;
    this.arrowsAtStart = countArrows(this.grid);
    this.levelStartedAt = performance.now();
    this.hooks.onLevel?.(idx + 1, LEVELS.length);
    this._resize();
  }

  undo() {
    if (!this.running || this.gameOver || this.anim) return false;
    if (!this.undoStack.length) return false;
    this.grid = this.undoStack.pop();
    vibrate(8);
    return true;
  }

  restartLevel() {
    if (!this.running || this.gameOver || this.anim) return;
    this._loadLevel(this.levelIndex);
    vibrate(10);
  }

  _snapshot() {
    return this.grid.map((row) => row.slice());
  }

  _cellAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) * this.dpr - this.boardRect.x) / this.boardRect.cell;
    const y = ((clientY - rect.top) * this.dpr - this.boardRect.y) / this.boardRect.cell;
    const c = Math.floor(x);
    const r = Math.floor(y);
    if (r < 0 || c < 0 || r >= this.size || c >= this.size) return null;
    return { r, c };
  }

  _onPointer(e) {
    if (!this.running || this.gameOver || this.anim) return;
    e.preventDefault();
    const cell = this._cellAt(e.clientX, e.clientY);
    if (!cell) return;
    const { r, c } = cell;
    const dir = this.grid[r][c];
    if (!dir) return;

    if (!pathClear(this.grid, r, c)) {
      this.flash = { r, c, t: 1, kind: 'bad' };
      sfxBlocked();
      vibrate([20, 40, 20]);
      this.hearts -= 1;
      this.hooks.onHearts?.(this.hearts, MAX_HEARTS);
      this.hooks.onToast?.('¡Camino bloqueado!');
      if (this.hearts <= 0) {
        this._endRun();
      }
      return;
    }

    this.undoStack.push(this._snapshot());
    this._startSlide(r, c, dir);
  }

  _startSlide(r, c, dir) {
    const [dr, dc] = DELTA[dir];
    const trail = [];
    let nr = r;
    let nc = c;
    // include start + empties until off-board
    while (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
      trail.push({ r: nr, c: nc });
      nr += dr;
      nc += dc;
    }
    // exit cell just outside
    trail.push({ r: nr, c: nc });

    this.anim = {
      r,
      c,
      dir,
      progress: 0,
      duration: Math.min(0.55, 0.12 + trail.length * 0.045),
      trail,
      fromR: r,
      fromC: c,
    };
    // remove from grid immediately so path updates; draw via anim
    this.grid[r][c] = null;
    sfxSlide();
    vibrate(10);
  }

  _finishSlide(anim) {
    const now = performance.now();
    if (now - this.lastClearAt < 1200) this.comboStreak += 1;
    else this.comboStreak = 1;
    this.lastClearAt = now;

    sfxClear();
    if (this.comboStreak >= 2) {
      sfxCombo(this.comboStreak);
      this.hooks.onCombo?.(
        this.comboStreak === 2 ? '¡Doble!' : this.comboStreak === 3 ? '¡Triple!' : `¡x${this.comboStreak}!`
      );
    }

    // frosting pop at exit
    const last = anim.trail[anim.trail.length - 1];
    this._burst(last.r, last.c, COLORS[anim.dir]);

    if (countArrows(this.grid) === 0) {
      this._completeLevel();
    }
  }

  _completeLevel() {
    const elapsed = (performance.now() - this.levelStartedAt) / 1000;
    const levelNum = this.levelIndex + 1;
    const timeBonus = Math.max(0, Math.min(80, Math.round(80 - elapsed * 2)));
    const comboBonus = Math.max(0, (this.comboStreak - 1) * 25);
    const gained =
      100 * levelNum + 15 * this.arrowsAtStart + 40 * this.hearts + timeBonus + comboBonus;
    this.score += gained;
    this.hooks.onScore?.(this.score);
    sfxLevelUp();
    vibrate([10, 30, 10]);
    this.hooks.onToast?.(`¡Nivel ${levelNum}! +${gained}`);
    this.hooks.onLevelComplete?.(levelNum, gained, this.score);

    // Big win share prompt every 5 levels starting at 5
    if (levelNum >= 5 && levelNum % 5 === 0) {
      this.hooks.onBigWin?.(levelNum, this.score);
    }

    const next = this.levelIndex + 1;
    if (next >= LEVELS.length) {
      // Completed all — continue with denser wrap or celebrate run end as win
      this.hooks.onToast?.('¡Pack completo! +500');
      this.score += 500;
      this.hooks.onScore?.(this.score);
      this._endRun(true);
      return;
    }
    setTimeout(() => {
      if (!this.running || this.gameOver) return;
      this._loadLevel(next);
    }, 480);
  }

  _endRun(won = false) {
    this.gameOver = true;
    this.running = false;
    if (!won) sfxGameOver();
    this.hooks.onGameOver?.(this.score, {
      level: this.levelIndex + 1,
      won,
      hearts: this.hearts,
    });
  }

  _burst(r, c, color) {
    const { x, y, cell } = this.boardRect;
    const cx = x + (c + 0.5) * cell;
    const cy = y + (r + 0.5) * cell;
    for (let i = 0; i < 14; i++) {
      const ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
      const sp = 40 + Math.random() * 90;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 1,
        color,
        size: 3 + Math.random() * 4,
      });
    }
  }

  _resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(w * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(h * this.dpr));
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    const pad = 28 * this.dpr;
    const topHud = 8 * this.dpr;
    const availW = this.canvas.width - pad * 2;
    const availH = this.canvas.height - pad * 2 - topHud;
    const n = Math.max(this.size || 4, 2);
    const cell = Math.floor(Math.min(availW / n, availH / n));
    const bw = cell * n;
    const bh = cell * n;
    this.boardRect = {
      x: Math.floor((this.canvas.width - bw) / 2),
      y: Math.floor((this.canvas.height - bh) / 2 + topHud * 0.3),
      w: bw,
      h: bh,
      cell,
    };
  }

  _loop = () => {
    this._raf = requestAnimationFrame(this._loop);
    this._tick(1 / 60);
    this._draw();
  };

  _tick(dt) {
    if (this.anim) {
      this.anim.progress += dt / this.anim.duration;
      if (this.anim.progress >= 1) {
        const a = this.anim;
        this.anim = null;
        this._finishSlide(a);
      }
    }
    if (this.flash) {
      this.flash.t -= dt * 2.2;
      if (this.flash.t <= 0) this.flash = null;
    }
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.life -= dt * 1.6;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  _draw() {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);

    // soft plate background
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#fff7f5');
    g.addColorStop(1, '#f3e0db');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    if (!this.grid) return;

    const { x, y, cell, w, h } = this.boardRect;
    const n = this.size;

    // board shadow + plate
    ctx.save();
    roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 18 * this.dpr);
    ctx.fillStyle = 'rgba(30,79,112,0.08)';
    ctx.fill();
    roundRect(ctx, x, y, w, h, 14 * this.dpr);
    ctx.fillStyle = '#faf3f0';
    ctx.fill();
    ctx.strokeStyle = 'rgba(234,152,175,0.55)';
    ctx.lineWidth = 2 * this.dpr;
    ctx.stroke();
    ctx.restore();

    // frosting portals on edges (sugar swirls)
    this._drawPortals();

    // grid cells
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cx = x + c * cell;
        const cy = y + r * cell;
        const inset = cell * 0.06;
        roundRect(ctx, cx + inset, cy + inset, cell - inset * 2, cell - inset * 2, cell * 0.18);
        ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(234,152,175,0.12)' : 'rgba(30,79,112,0.04)';
        ctx.fill();

        const dir = this.grid[r][c];
        if (dir) this._drawArrow(cx, cy, cell, dir, 1);

        if (this.flash && this.flash.r === r && this.flash.c === c) {
          ctx.save();
          roundRect(ctx, cx + inset, cy + inset, cell - inset * 2, cell - inset * 2, cell * 0.18);
          ctx.fillStyle = `rgba(233,122,111,${0.45 * this.flash.t})`;
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // hint glow on movable (subtle)
    if (!this.anim && this.running && !this.gameOver) {
      const moves = listMovable(this.grid);
      for (const [r, c] of moves) {
        const cx = x + c * cell + cell / 2;
        const cy = y + r * cell + cell / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.42, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(92,163,112,0.35)';
        ctx.lineWidth = 2 * this.dpr;
        ctx.stroke();
      }
    }

    // sliding arrow + trail
    if (this.anim) {
      const a = this.anim;
      const t = Math.min(1, a.progress);
      const eased = 1 - Math.pow(1 - t, 2.4);
      const idx = eased * (a.trail.length - 1);
      const i0 = Math.floor(idx);
      const i1 = Math.min(a.trail.length - 1, i0 + 1);
      const frac = idx - i0;
      const p0 = a.trail[i0];
      const p1 = a.trail[i1];
      const pr = p0.r + (p1.r - p0.r) * frac;
      const pc = p0.c + (p1.c - p0.c) * frac;

      // frosting trail
      for (let i = 0; i <= i0; i++) {
        const p = a.trail[i];
        const tx = x + p.c * cell + cell / 2;
        const ty = y + p.r * cell + cell / 2;
        ctx.beginPath();
        ctx.arc(tx, ty, cell * 0.12 * (1 - i / a.trail.length), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(234,152,175,${0.35 * (1 - t * 0.5)})`;
        ctx.fill();
      }

      const ax = x + pc * cell;
      const ay = y + pr * cell;
      this._drawArrow(ax, ay, cell, a.dir, 1 - t * 0.15);

      // portal suck near end
      if (t > 0.7) {
        const exit = a.trail[a.trail.length - 1];
        const ex = x + exit.c * cell + cell / 2;
        const ey = y + exit.r * cell + cell / 2;
        ctx.beginPath();
        ctx.arc(ex, ey, cell * 0.35 * (t - 0.7) * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(234,152,175,${0.4 * (1 - t)})`;
        ctx.fill();
      }
    }

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * this.dpr * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  _drawPortals() {
    const ctx = this.ctx;
    const { x, y, cell, w, h } = this.boardRect;
    ctx.save();
    // Soft frosting portal rings on four edges (cake metaphor: sugar swirl exits)
    const rings = [
      [x + w / 2, y - cell * 0.22],
      [x + w / 2, y + h + cell * 0.22],
      [x - cell * 0.22, y + h / 2],
      [x + w + cell * 0.22, y + h / 2],
    ];
    for (const [px, py] of rings) {
      ctx.beginPath();
      ctx.arc(px, py, cell * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(234,152,175,0.35)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, cell * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(233,122,111,0.55)';
      ctx.fill();
    }
    ctx.restore();
  }

  _drawArrow(cx, cy, cell, dir, alpha = 1) {
    const ctx = this.ctx;
    const inset = cell * 0.1;
    const x = cx + inset;
    const y = cy + inset;
    const s = cell - inset * 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    roundRect(ctx, x, y, s, s, s * 0.28);
    const grad = ctx.createLinearGradient(x, y, x + s, y + s);
    grad.addColorStop(0, '#fffdfb');
    grad.addColorStop(1, COLORS[dir] + '33');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = COLORS[dir];
    ctx.lineWidth = Math.max(2, cell * 0.06);
    ctx.stroke();

    // frosting dollop
    ctx.beginPath();
    ctx.arc(x + s * 0.5, y + s * 0.5, s * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[dir];
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + s * 0.38, y + s * 0.38, s * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();

    ctx.fillStyle = '#fffdfb';
    ctx.font = `bold ${Math.floor(s * 0.42)}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ARROW_GLYPH[dir], x + s * 0.5, y + s * 0.52);
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
