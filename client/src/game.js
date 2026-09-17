/**
 * Pastel Run — 3-lane endless runner for Cake Studio Guatemala
 * Canvas pseudo-3D corridor; lane change + optional jump.
 */
import {
  sfxLane,
  sfxCollect,
  sfxHit,
  sfxCombo,
  sfxJump,
  sfxGameOver,
  vibrate,
} from './audio.js';

const LANES = 3;
const MAX_HEARTS = 3;

const PRODUCTS = [
  { id: 'mini', label: 'Mini', points: 10, color: '#ea98af', glow: '#f4c4d0', r: 0.7 },
  { id: 'lonchera', label: 'Lonchera', points: 25, color: '#e97a6f', glow: '#f0a89f', r: 0.85 },
  { id: 'capa', label: 'Capa', points: 50, color: '#5ca370', glow: '#8bc49a', r: 0.95 },
  { id: 'boda', label: 'Boda', points: 100, color: '#1e4f70', glow: '#4a7a9a', r: 1.1 },
];

const OBSTACLES = [
  { id: 'tray', label: 'Bandeja', canJump: true, w: 0.9, h: 0.55 },
  { id: 'pin', label: 'Rodillo', canJump: true, w: 0.95, h: 0.45 },
  { id: 'box', label: 'Caja', canJump: false, w: 0.85, h: 1.0 },
  { id: 'puddle', label: 'Frosting', canJump: true, w: 1.0, h: 0.35 },
];

const COLORS = {
  cream: '#f4eae9',
  rosa: '#ea98af',
  coral: '#e97a6f',
  navy: '#1e4f70',
  cafe: '#BF6C58',
  pistacho: '#5ca370',
  black: '#1a1a1a',
  frosting: '#f7d6de',
};

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

export class PastelRun {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.running = false;
    this.gameOver = false;
    this.raf = 0;
    this.lastTs = 0;
    this.dpr = 1;

    this.score = 0;
    this.hearts = MAX_HEARTS;
    this.combo = 0;
    this.maxCombo = 0;
    this.distance = 0;
    this.speed = 0;
    this.baseSpeed = 6.2;
    this.lane = 1;
    this.targetLane = 1;
    this.laneX = 1;
    this.jumpT = 0;
    this.jumping = false;
    this.invuln = 0;
    this.shake = 0;

    this.entities = [];
    this.spawnDist = 0;
    this.nextSpawnAt = 18;
    this.particles = [];
    this.bgOffset = 0;

    this._onKey = this._onKey.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._touchStart = null;
    this._resize = this._resize.bind(this);

    window.addEventListener('keydown', this._onKey);
    canvas.addEventListener('pointerdown', this._onPointerDown, { passive: true });
    canvas.addEventListener('pointerup', this._onPointerUp, { passive: true });
    canvas.addEventListener('pointercancel', this._onPointerUp, { passive: true });
    canvas.addEventListener('pointermove', this._onPointerMove, { passive: true });
    window.addEventListener('resize', this._resize);
    this._resize();
  }

  destroy() {
    this.stopLoop();
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('resize', this._resize);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('pointercancel', this._onPointerUp);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
  }

  _resize() {
    const shell = this.canvas.parentElement;
    const w = Math.min(shell?.clientWidth || 390, 480);
    const h = Math.min(Math.max(shell?.clientHeight || 560, 420), 720);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.w = w;
    this.h = h;
    if (!this.running) this.draw(0);
  }

  start() {
    this.score = 0;
    this.hearts = MAX_HEARTS;
    this.combo = 0;
    this.maxCombo = 0;
    this.distance = 0;
    this.speed = this.baseSpeed;
    this.lane = 1;
    this.targetLane = 1;
    this.laneX = 1;
    this.jumpT = 0;
    this.jumping = false;
    this.invuln = 0;
    this.shake = 0;
    this.entities = [];
    this.spawnDist = 0;
    this.nextSpawnAt = 10;
    this.particles = [];
    this.bgOffset = 0;
    this.running = true;
    this.gameOver = false;
    this.lastTs = 0;
    this._emitHud();
    this.hooks.onToast?.('¡Corre por el pastel!');
    this.stopLoop();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  _emitHud() {
    this.hooks.onScore?.(this.score);
    this.hooks.onHearts?.(this.hearts, MAX_HEARTS);
    this.hooks.onCombo?.(this.combo);
    this.hooks.onDistance?.(Math.floor(this.distance));
  }

  _onKey(e) {
    if (!this.running || this.gameOver) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      this.changeLane(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      this.changeLane(1);
    } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
      e.preventDefault();
      this.jump();
    }
  }

  _onPointerDown(e) {
    if (!this.running || this.gameOver) return;
    this._touchStart = { x: e.clientX, y: e.clientY, t: performance.now() };
  }

  _onPointerMove() {
    /* swipe resolved on up */
  }

  _onPointerUp(e) {
    if (!this._touchStart || !this.running || this.gameOver) {
      this._touchStart = null;
      return;
    }
    const dx = e.clientX - this._touchStart.x;
    const dy = e.clientY - this._touchStart.y;
    const dt = performance.now() - this._touchStart.t;
    this._touchStart = null;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (dt > 500) return;
    if (absX < 18 && absY < 18) {
      // tap: change lane toward tap side
      const rect = this.canvas.getBoundingClientRect();
      const rel = (e.clientX - rect.left) / rect.width;
      if (rel < 0.38) this.changeLane(-1);
      else if (rel > 0.62) this.changeLane(1);
      else this.jump();
      return;
    }
    if (absX > absY && absX > 28) {
      this.changeLane(dx < 0 ? -1 : 1);
    } else if (absY > absX && dy < -28) {
      this.jump();
    }
  }

  changeLane(dir) {
    const next = clamp(this.targetLane + dir, 0, LANES - 1);
    if (next === this.targetLane) return;
    this.targetLane = next;
    sfxLane();
    vibrate(8);
  }

  jump() {
    if (this.jumping) return;
    this.jumping = true;
    this.jumpT = 0;
    sfxJump();
    vibrate(10);
  }

  loop(ts) {
    if (!this.running) return;
    if (!this.lastTs) this.lastTs = ts;
    let dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    dt = clamp(dt, 0, 0.05);
    this.update(dt);
    this.draw(dt);
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    if (this.gameOver) return;

    // ramp speed slowly
    this.speed = this.baseSpeed + Math.min(7.5, this.distance * 0.012);
    const move = this.speed * dt * 10;
    this.distance += move * 0.35;
    this.bgOffset = (this.bgOffset + move * 2.2) % 120;

    // smooth lane lerp
    this.laneX += (this.targetLane - this.laneX) * clamp(14 * dt, 0, 1);
    this.lane = Math.round(this.laneX);

    // jump parabola ~0.42s
    if (this.jumping) {
      this.jumpT += dt;
      if (this.jumpT >= 0.42) {
        this.jumping = false;
        this.jumpT = 0;
      }
    }

    if (this.invuln > 0) this.invuln -= dt;
    if (this.shake > 0) this.shake -= dt;

    this.spawnDist += move;
    while (this.spawnDist >= this.nextSpawnAt) {
      this.spawnDist -= this.nextSpawnAt;
      this.spawnWave();
      // denser over time, still fair
      const dens = clamp(14 - this.distance * 0.008, 7.5, 16);
      this.nextSpawnAt = dens + rand(-1.5, 2.2);
    }

    const playerZ = 1.05;
    for (const e of this.entities) {
      e.z -= move * 0.055;
    }

    // collisions near player
    for (const e of this.entities) {
      if (e.hit || e.z > 1.35 || e.z < 0.72) continue;
      if (Math.round(this.laneX) !== e.lane && Math.abs(this.laneX - e.lane) > 0.45) continue;

      if (e.kind === 'collect') {
        e.hit = true;
        this.collect(e);
      } else if (e.kind === 'obstacle') {
        const jumpClear = this.jumping && e.canJump && this.jumpHeight() > 0.35;
        if (!jumpClear && this.invuln <= 0) {
          e.hit = true;
          this.takeHit();
        }
      }
    }

    this.entities = this.entities.filter((e) => e.z > -0.2 && !e.hit);

    // particles
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // distance score trickle
    this._distAcc = (this._distAcc || 0) + move * 0.15;
    if (this._distAcc >= 1) {
      const add = Math.floor(this._distAcc);
      this._distAcc -= add;
      this.score += add;
      this.hooks.onScore?.(this.score);
    }
    this.hooks.onDistance?.(Math.floor(this.distance));
  }

  jumpHeight() {
    if (!this.jumping) return 0;
    const t = this.jumpT / 0.42;
    return Math.sin(Math.PI * t);
  }

  spawnWave() {
    const difficulty = clamp(this.distance / 400, 0, 1);
    const lanes = [0, 1, 2];
    // shuffle
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }

    const pattern = Math.random();
    if (pattern < 0.45) {
      // single collect
      this.spawnCollect(lanes[0], 8 + rand(0, 1));
      if (Math.random() < 0.55 + difficulty * 0.3) {
        this.spawnObstacle(lanes[1], 8 + rand(0.8, 2.2));
      }
    } else if (pattern < 0.7) {
      // two collects, one obstacle
      this.spawnCollect(lanes[0], 8);
      this.spawnCollect(lanes[1], 8.6);
      this.spawnObstacle(lanes[2], 8.3);
    } else if (pattern < 0.88) {
      // obstacle wall with gap
      this.spawnObstacle(lanes[0], 8);
      this.spawnObstacle(lanes[1], 8);
      if (Math.random() < 0.5) this.spawnCollect(lanes[2], 8.4);
    } else {
      // boda / capa tease with flanking hazards
      this.spawnCollect(lanes[0], 8, difficulty > 0.35 ? 'boda' : 'capa');
      this.spawnObstacle(lanes[1], 7.6);
      this.spawnObstacle(lanes[2], 8.5);
    }
  }

  spawnCollect(lane, z, forceId) {
    let prod;
    if (forceId) {
      prod = PRODUCTS.find((p) => p.id === forceId) || PRODUCTS[0];
    } else {
      const r = Math.random();
      if (r < 0.42) prod = PRODUCTS[0];
      else if (r < 0.72) prod = PRODUCTS[1];
      else if (r < 0.92) prod = PRODUCTS[2];
      else prod = PRODUCTS[3];
    }
    this.entities.push({
      kind: 'collect',
      lane,
      z,
      hit: false,
      ...prod,
    });
  }

  spawnObstacle(lane, z) {
    const obs = pick(OBSTACLES);
    this.entities.push({
      kind: 'obstacle',
      lane,
      z,
      hit: false,
      canJump: obs.canJump,
      obsId: obs.id,
      label: obs.label,
      ow: obs.w,
      oh: obs.h,
    });
  }

  collect(e) {
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = 1 + Math.min(4, Math.floor(this.combo / 3)) * 0.25;
    const gained = Math.round(e.points * mult);
    this.score += gained;
    const tier = PRODUCTS.findIndex((p) => p.id === e.id) + 1;
    sfxCollect(tier);
    if (this.combo >= 3 && this.combo % 3 === 0) {
      sfxCombo(this.combo / 3);
      this.hooks.onToast?.(`Combo ×${this.combo}!`);
    } else {
      this.hooks.onToast?.(`+${gained} ${e.label}`);
    }
    vibrate(10);
    this.burst(e.lane, e.z, e.color || COLORS.rosa);
    this._emitHud();
  }

  takeHit() {
    this.hearts -= 1;
    this.combo = 0;
    this.invuln = 1.1;
    this.shake = 0.35;
    sfxHit();
    vibrate([20, 40, 20]);
    this.hooks.onToast?.('¡Ups!');
    this._emitHud();
    if (this.hearts <= 0) {
      this.endGame();
    }
  }

  endGame() {
    this.gameOver = true;
    this.running = false;
    sfxGameOver();
    this.stopLoop();
    this.draw(0);
    this.hooks.onGameOver?.(this.score, {
      distance: Math.floor(this.distance),
      maxCombo: this.maxCombo,
    });
  }

  burst(lane, z, color) {
    const { x, y, s } = this.project(lane, z);
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x,
        y: y - 20 * s,
        vx: rand(-120, 120),
        vy: rand(-220, -40),
        life: rand(0.35, 0.7),
        color,
        r: rand(2, 5) * s,
      });
    }
  }

  /** Map lane + depth z (far~10 → near~1) to screen */
  project(lane, z) {
    const w = this.w;
    const h = this.h;
    const depth = clamp(z, 0.4, 14);
    const persp = 1 / depth;
    const roadW = w * 0.78 * persp * 4.2;
    const cx = w * 0.5;
    const laneSpacing = roadW / 3;
    const x = cx + (lane - 1) * laneSpacing;
    const horizon = h * 0.22;
    const nearY = h * 0.88;
    const t = clamp((14 - depth) / 13.2, 0, 1);
    const y = horizon + (nearY - horizon) * Math.pow(t, 1.15);
    const s = clamp(persp * 3.4, 0.15, 1.6);
    return { x, y, s, roadW, persp };
  }

  draw() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    let shakeX = 0;
    let shakeY = 0;
    if (this.shake > 0) {
      shakeX = rand(-5, 5) * this.shake * 3;
      shakeY = rand(-4, 4) * this.shake * 3;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.drawBackground(ctx, w, h);
    this.drawRoad(ctx, w, h);

    // entities far → near
    const sorted = [...this.entities].sort((a, b) => b.z - a.z);
    for (const e of sorted) {
      if (e.kind === 'collect') this.drawCollect(ctx, e);
      else this.drawObstacle(ctx, e);
    }

    this.drawPlayer(ctx);
    this.drawParticles(ctx);

    ctx.restore();

    // soft vignette
    const g = ctx.createRadialGradient(w / 2, h * 0.55, w * 0.2, w / 2, h * 0.5, w * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(30,79,112,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  drawBackground(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    sky.addColorStop(0, '#f7d6de');
    sky.addColorStop(0.55, COLORS.cream);
    sky.addColorStop(1, '#efe0de');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // soft distant hills
    ctx.fillStyle = 'rgba(234,152,175,0.28)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.38);
    ctx.quadraticCurveTo(w * 0.25, h * 0.28, w * 0.5, h * 0.36);
    ctx.quadraticCurveTo(w * 0.75, h * 0.44, w, h * 0.34);
    ctx.lineTo(w, h * 0.5);
    ctx.lineTo(0, h * 0.5);
    ctx.fill();

    ctx.fillStyle = 'rgba(92,163,112,0.18)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.42);
    ctx.quadraticCurveTo(w * 0.3, h * 0.34, w * 0.55, h * 0.4);
    ctx.quadraticCurveTo(w * 0.8, h * 0.46, w, h * 0.4);
    ctx.lineTo(w, h * 0.55);
    ctx.lineTo(0, h * 0.55);
    ctx.fill();
  }

  drawRoad(ctx, w, h) {
    const far = this.project(1, 12);
    const near = this.project(1, 0.85);
    const farW = far.roadW;
    const nearW = near.roadW;

    // road trapezoid
    const path = new Path2D();
    path.moveTo(far.x - farW / 2, far.y);
    path.lineTo(far.x + farW / 2, far.y);
    path.lineTo(near.x + nearW / 2, near.y + 20);
    path.lineTo(near.x - nearW / 2, near.y + 20);
    path.closePath();

    const roadGrad = ctx.createLinearGradient(0, far.y, 0, near.y);
    roadGrad.addColorStop(0, '#e8d5d2');
    roadGrad.addColorStop(1, '#dcc4bf');
    ctx.fillStyle = roadGrad;
    ctx.fill(path);

    // frosting edge ribbons
    ctx.strokeStyle = COLORS.rosa;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(far.x - farW / 2, far.y);
    ctx.lineTo(near.x - nearW / 2, near.y + 20);
    ctx.moveTo(far.x + farW / 2, far.y);
    ctx.lineTo(near.x + nearW / 2, near.y + 20);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // lane dividers with scroll
    for (const laneEdge of [-0.5, 0.5]) {
      ctx.save();
      ctx.strokeStyle = 'rgba(30,79,112,0.22)';
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 16]);
      ctx.lineDashOffset = -this.bgOffset;
      ctx.beginPath();
      const f = this.project(1 + laneEdge, 12);
      const n = this.project(1 + laneEdge, 0.85);
      // approximate lane edge x
      const fx = far.x + laneEdge * (farW / 3) * 2;
      const nx = near.x + laneEdge * (nearW / 3) * 2;
      ctx.moveTo(fx, far.y);
      ctx.lineTo(nx, near.y + 10);
      ctx.stroke();
      ctx.restore();
    }

    // side counters / bakery walls
    ctx.fillStyle = 'rgba(191,108,88,0.2)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.35);
    ctx.lineTo(far.x - farW / 2, far.y);
    ctx.lineTo(near.x - nearW / 2, near.y + 20);
    ctx.lineTo(0, h);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w, h * 0.35);
    ctx.lineTo(far.x + farW / 2, far.y);
    ctx.lineTo(near.x + nearW / 2, near.y + 20);
    ctx.lineTo(w, h);
    ctx.fill();
  }

  drawCollect(ctx, e) {
    const { x, y, s } = this.project(e.lane, e.z);
    const r = 16 * s * (e.r || 1);
    const bob = Math.sin(performance.now() / 220 + e.lane) * 4 * s;

    ctx.save();
    ctx.translate(x, y - r - bob);

    // glow
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2);
    ctx.fillStyle = e.glow || 'rgba(234,152,175,0.35)';
    ctx.globalAlpha = 0.45;
    ctx.fill();
    ctx.globalAlpha = 1;

    // cake body
    ctx.fillStyle = e.color || COLORS.rosa;
    this.roundRect(ctx, -r * 0.95, -r * 0.2, r * 1.9, r * 1.1, r * 0.25);
    ctx.fill();

    // frosting top
    ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.15, r * 0.95, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // cherry
    ctx.beginPath();
    ctx.arc(0, -r * 0.55, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.coral;
    ctx.fill();
    ctx.strokeStyle = COLORS.pistacho;
    ctx.lineWidth = Math.max(1.5, 2 * s);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.75);
    ctx.quadraticCurveTo(r * 0.25, -r * 1.05, r * 0.35, -r * 0.85);
    ctx.stroke();

    // label for bigger items
    if (s > 0.55 && (e.id === 'boda' || e.id === 'capa')) {
      ctx.font = `600 ${Math.max(9, 11 * s)}px Nunito,sans-serif`;
      ctx.fillStyle = COLORS.navy;
      ctx.textAlign = 'center';
      ctx.fillText(e.label, 0, r * 1.35);
    }

    ctx.restore();
  }

  drawObstacle(ctx, e) {
    const { x, y, s } = this.project(e.lane, e.z);
    const bw = 28 * s * (e.ow || 1);
    const bh = 22 * s * (e.oh || 1);

    ctx.save();
    ctx.translate(x, y);

    if (e.obsId === 'puddle') {
      ctx.fillStyle = 'rgba(234,152,175,0.75)';
      ctx.beginPath();
      ctx.ellipse(0, -bh * 0.2, bw, bh * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(244,234,233,0.5)';
      ctx.beginPath();
      ctx.ellipse(-bw * 0.2, -bh * 0.3, bw * 0.35, bh * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.obsId === 'pin') {
      ctx.fillStyle = COLORS.cafe;
      this.roundRect(ctx, -bw, -bh * 0.7, bw * 2, bh * 0.55, bh * 0.25);
      ctx.fill();
      ctx.fillStyle = '#8a4a3a';
      ctx.beginPath();
      ctx.arc(-bw, -bh * 0.42, bh * 0.35, 0, Math.PI * 2);
      ctx.arc(bw, -bh * 0.42, bh * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.obsId === 'box') {
      ctx.fillStyle = COLORS.navy;
      this.roundRect(ctx, -bw * 0.85, -bh * 1.6, bw * 1.7, bh * 1.5, 4 * s);
      ctx.fill();
      ctx.fillStyle = COLORS.rosa;
      ctx.fillRect(-bw * 0.85, -bh * 1.15, bw * 1.7, bh * 0.22);
      ctx.fillStyle = COLORS.cream;
      ctx.font = `700 ${Math.max(8, 10 * s)}px Nunito,sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('CAKE', 0, -bh * 0.7);
    } else {
      // spilled tray
      ctx.fillStyle = '#c9b0a8';
      this.roundRect(ctx, -bw, -bh * 0.9, bw * 2, bh * 0.7, 3 * s);
      ctx.fill();
      ctx.fillStyle = COLORS.rosa;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(bw * 0.15, -bh * 0.35, bw * 0.7, bh * 0.4, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (e.canJump && s > 0.5) {
      ctx.font = `${Math.max(8, 9 * s)}px Nunito,sans-serif`;
      ctx.fillStyle = 'rgba(30,79,112,0.55)';
      ctx.textAlign = 'center';
      ctx.fillText('↑', 0, -bh * 1.75);
    }

    ctx.restore();
  }

  drawPlayer(ctx) {
    const jh = this.jumpHeight();
    const { x, y, s } = this.project(this.laneX, 1.05);
    const lift = jh * 58 * s;
    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;

    ctx.save();
    ctx.translate(x, y - lift);
    if (blink) ctx.globalAlpha = 0.35;

    // shadow
    ctx.fillStyle = 'rgba(30,79,112,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 4 * s, 18 * s * (1 - jh * 0.4), 7 * s * (1 - jh * 0.35), 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = Math.sin(performance.now() / 90) * 2.5 * s * (this.jumping ? 0 : 1);

    // body — pastry runner silhouette
    ctx.translate(0, -28 * s + bob);

    // legs
    const legSwing = Math.sin(performance.now() / 70) * 8 * s * (this.jumping ? 0.2 : 1);
    ctx.strokeStyle = COLORS.navy;
    ctx.lineWidth = Math.max(2, 3.5 * s);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5 * s, 18 * s);
    ctx.lineTo(-5 * s - legSwing, 32 * s);
    ctx.moveTo(5 * s, 18 * s);
    ctx.lineTo(5 * s + legSwing, 32 * s);
    ctx.stroke();

    // torso dress / apron
    ctx.fillStyle = COLORS.rosa;
    this.roundRect(ctx, -14 * s, -4 * s, 28 * s, 26 * s, 8 * s);
    ctx.fill();
    ctx.fillStyle = COLORS.cream;
    this.roundRect(ctx, -10 * s, 2 * s, 20 * s, 14 * s, 4 * s);
    ctx.fill();

    // head
    ctx.beginPath();
    ctx.arc(0, -14 * s, 11 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#f2d4c8';
    ctx.fill();

    // chef hat / frosting swirl
    ctx.fillStyle = COLORS.cream;
    this.roundRect(ctx, -10 * s, -30 * s, 20 * s, 12 * s, 4 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -32 * s, 9 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.coral;
    ctx.beginPath();
    ctx.arc(6 * s, -36 * s, 3.2 * s, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    ctx.fillStyle = COLORS.navy;
    ctx.beginPath();
    ctx.arc(-3.5 * s, -14 * s, 1.6 * s, 0, Math.PI * 2);
    ctx.arc(3.5 * s, -14 * s, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}

export { MAX_HEARTS, PRODUCTS };
