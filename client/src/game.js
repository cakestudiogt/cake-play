/**
 * Pastel Run — Cake Studio Guatemala
 * Visual overhaul: soft pastel bakery street with 2.5D depth.
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
  { id: 'mini', label: 'Mini', points: 10, color: '#ea98af', glow: '#f4c4d0', r: 0.72 },
  { id: 'lonchera', label: 'Lonchera', points: 25, color: '#e97a6f', glow: '#f0a89f', r: 0.88 },
  { id: 'capa', label: 'Capa', points: 50, color: '#5ca370', glow: '#8bc49a', r: 1.0 },
  { id: 'boda', label: 'Boda', points: 100, color: '#1e4f70', glow: '#4a7a9a', r: 1.18 },
];

const OBSTACLES = [
  { id: 'tray', label: 'Bandeja', canJump: true, w: 0.95, h: 0.55 },
  { id: 'pin', label: 'Rodillo', canJump: true, w: 1.0, h: 0.45 },
  { id: 'box', label: 'Caja', canJump: false, w: 0.9, h: 1.05 },
  { id: 'puddle', label: 'Frosting', canJump: true, w: 1.05, h: 0.38 },
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
  blush: '#f2b8c4',
  skin: '#f5d5c8',
  stone: '#d9c4bc',
  stoneDark: '#c4a99f',
};

const SHOP_SIGNS = [
  'DULCE',
  'PASTEL',
  'CAFÉ',
  'MINI',
  'BODA',
  'CREMA',
  'FLOUR',
  'SUGAR',
];

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
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
    this.cloudSeed = Math.random() * 1000;
    this.shopSeed = 7;

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

  _onPointerMove() {}

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

    this.speed = this.baseSpeed + Math.min(7.5, this.distance * 0.012);
    const move = this.speed * dt * 10;
    this.distance += move * 0.35;
    this.bgOffset = (this.bgOffset + move * 2.2) % 240;

    this.laneX += (this.targetLane - this.laneX) * clamp(14 * dt, 0, 1);
    this.lane = Math.round(this.laneX);

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
      const dens = clamp(14 - this.distance * 0.008, 7.5, 16);
      this.nextSpawnAt = dens + rand(-1.5, 2.2);
    }

    for (const e of this.entities) {
      e.z -= move * 0.055;
    }

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

    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      if (p.spin != null) p.spin += p.spinV * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

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
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }

    const pattern = Math.random();
    if (pattern < 0.45) {
      this.spawnCollect(lanes[0], 8 + rand(0, 1));
      if (Math.random() < 0.55 + difficulty * 0.3) {
        this.spawnObstacle(lanes[1], 8 + rand(0.8, 2.2));
      }
    } else if (pattern < 0.7) {
      this.spawnCollect(lanes[0], 8);
      this.spawnCollect(lanes[1], 8.6);
      this.spawnObstacle(lanes[2], 8.3);
    } else if (pattern < 0.88) {
      this.spawnObstacle(lanes[0], 8);
      this.spawnObstacle(lanes[1], 8);
      if (Math.random() < 0.5) this.spawnCollect(lanes[2], 8.4);
    } else {
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
    const kinds = ['crumb', 'heart', 'spark'];
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x,
        y: y - 22 * s,
        vx: rand(-140, 140),
        vy: rand(-260, -50),
        life: rand(0.4, 0.85),
        color,
        r: rand(2.2, 5.5) * s,
        kind: kinds[i % 3],
        spin: rand(0, Math.PI),
        spinV: rand(-8, 8),
      });
    }
  }

  /** Map lane + depth z (far~10 → near~1) to screen */
  project(lane, z) {
    const w = this.w;
    const h = this.h;
    const depth = clamp(z, 0.4, 14);
    const persp = 1 / depth;
    // Cap so near road leaves side gutters for bakery shops
    const roadW = Math.min(w * 0.92, w * 0.82 * persp * 4.35);
    const cx = w * 0.5;
    const laneSpacing = roadW / 3;
    const x = cx + (lane - 1) * laneSpacing;
    const horizon = h * 0.26;
    const nearY = h * 0.9;
    const t = clamp((14 - depth) / 13.2, 0, 1);
    const y = horizon + (nearY - horizon) * Math.pow(t, 1.12);
    const s = clamp(persp * 3.55, 0.14, 1.7);
    return { x, y, s, roadW, persp, horizon };
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

    this.drawSky(ctx, w, h);
    this.drawDistantHills(ctx, w, h);
    this.drawSidewalks(ctx, w, h);
    this.drawRoad(ctx, w, h);
    this.drawShops(ctx, w, h);

    const sorted = [...this.entities].sort((a, b) => b.z - a.z);
    for (const e of sorted) {
      if (e.kind === 'collect') this.drawCollect(ctx, e);
      else this.drawObstacle(ctx, e);
    }

    this.drawPlayer(ctx);
    this.drawParticles(ctx);

    ctx.restore();

    // soft vignette + warm edge light
    const g = ctx.createRadialGradient(w / 2, h * 0.5, w * 0.15, w / 2, h * 0.55, w * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(30,79,112,0.04)');
    g.addColorStop(1, 'rgba(30,79,112,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  drawSky(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    sky.addColorStop(0, '#f9c5d0');
    sky.addColorStop(0.35, '#f7d6de');
    sky.addColorStop(0.7, COLORS.cream);
    sky.addColorStop(1, '#efe0dc');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // soft sun glow near vanishing point
    const sunX = w * 0.5;
    const sunY = h * 0.22;
    const sun = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, w * 0.42);
    sun.addColorStop(0, 'rgba(255,245,230,0.85)');
    sun.addColorStop(0.35, 'rgba(255,220,200,0.35)');
    sun.addColorStop(1, 'rgba(255,200,190,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h * 0.55);

    // fluffy clouds (parallax slow)
    const t = (this.bgOffset * 0.15 + this.cloudSeed) % 400;
    this.drawCloud(ctx, ((w * 0.15 - t * 0.4) % (w + 80)) - 40, h * 0.08, 0.9);
    this.drawCloud(ctx, ((w * 0.62 + t * 0.25) % (w + 100)) - 50, h * 0.12, 1.15);
    this.drawCloud(ctx, ((w * 0.85 - t * 0.2) % (w + 60)) - 30, h * 0.06, 0.7);
  }

  drawCloud(ctx, x, y, s) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#fff8f6';
    ctx.beginPath();
    ctx.ellipse(x, y, 28 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 22 * s, y + 2 * s, 20 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 18 * s, y + 3 * s, 18 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 6 * s, y - 8 * s, 16 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawDistantHills(ctx, w, h) {
    ctx.fillStyle = 'rgba(234,152,175,0.32)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.36);
    ctx.quadraticCurveTo(w * 0.22, h * 0.26, w * 0.48, h * 0.34);
    ctx.quadraticCurveTo(w * 0.72, h * 0.42, w, h * 0.3);
    ctx.lineTo(w, h * 0.48);
    ctx.lineTo(0, h * 0.48);
    ctx.fill();

    ctx.fillStyle = 'rgba(92,163,112,0.2)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.4);
    ctx.quadraticCurveTo(w * 0.28, h * 0.32, w * 0.52, h * 0.38);
    ctx.quadraticCurveTo(w * 0.78, h * 0.44, w, h * 0.36);
    ctx.lineTo(w, h * 0.52);
    ctx.lineTo(0, h * 0.52);
    ctx.fill();
  }

  drawSidewalks(ctx, w, h) {
    const far = this.project(1, 11.5);
    const near = this.project(1, 0.9);
    const farW = far.roadW;
    const nearW = near.roadW;

    const leftPath = new Path2D();
    leftPath.moveTo(0, h * 0.28);
    leftPath.lineTo(Math.max(0, far.x - farW / 2), far.y);
    leftPath.lineTo(Math.max(0, near.x - nearW / 2), near.y + 16);
    leftPath.lineTo(0, h);
    leftPath.closePath();
    const rightPath = new Path2D();
    rightPath.moveTo(w, h * 0.28);
    rightPath.lineTo(Math.min(w, far.x + farW / 2), far.y);
    rightPath.lineTo(Math.min(w, near.x + nearW / 2), near.y + 16);
    rightPath.lineTo(w, h);
    rightPath.closePath();

    ctx.fillStyle = 'rgba(214, 176, 168, 0.55)';
    ctx.fill(leftPath);
    ctx.fill(rightPath);
    ctx.fillStyle = 'rgba(244, 234, 233, 0.4)';
    ctx.fill(leftPath);
    ctx.fill(rightPath);
  }

  drawShops(ctx, w, h) {
    // Side-gutter bakery facades (drawn after road so they stay visible)
    const rows = 7;
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1); // 0 far → 1 near
      const z = 10.5 - t * 8.8;
      const p = this.project(1, z);
      const y = p.y;
      const depthScale = clamp(0.28 + t * 1.15, 0.28, 1.45);
      const scroll = Math.floor(this.bgOffset / 32 + i * 2.1 + this.shopSeed);

      const rawLeft = p.x - p.roadW / 2;
      const rawRight = p.x + p.roadW / 2;

      // When road is narrow, sit on curb; when road fills screen, peek from edges
      const leftCurb = rawLeft > 28 ? rawLeft : 18 + (1 - t) * 8;
      const rightCurb = rawRight < w - 28 ? rawRight : w - 18 - (1 - t) * 8;
      const showLeft = rawLeft > 20 || t > 0.35;
      const showRight = rawRight < w - 20 || t > 0.35;

      if (showLeft) this.drawShopAt(ctx, -1, leftCurb, y, depthScale, scroll);
      if (showRight) this.drawShopAt(ctx, 1, rightCurb, y, depthScale * 0.96, scroll + 4);
    }
  }

  drawShopAt(ctx, side, curbX, baseY, depth, seed) {
    const facadeW = 62 * depth;
    const facadeH = 88 * depth;
    const topY = baseY - facadeH;
    let x0;
    if (side < 0) {
      x0 = curbX - facadeW - 4 * depth;
    } else {
      x0 = curbX + 4 * depth;
    }
    const x1 = x0 + facadeW;
    if (x1 < -4 || x0 > this.w + 4) return;

    // ground shadow
    ctx.fillStyle = 'rgba(30,79,112,0.12)';
    ctx.beginPath();
    ctx.ellipse((x0 + x1) / 2, baseY + 3, facadeW * 0.42, 5 * depth, 0, 0, Math.PI * 2);
    ctx.fill();

    const walls = ['#fff8f5', '#f9e6e0', '#f4ddd5', '#ffeae5', '#f1d6ce'];
    const wallColor = walls[seed % walls.length];

    // wall with slight perspective skew
    const skew = side < 0 ? 5 * depth : -5 * depth;
    const wall = new Path2D();
    wall.moveTo(x0, topY);
    wall.lineTo(x1, topY);
    wall.lineTo(x1 + skew, baseY);
    wall.lineTo(x0 + skew * 0.3, baseY);
    wall.closePath();
    ctx.fillStyle = wallColor;
    ctx.fill(wall);
    ctx.strokeStyle = 'rgba(191,108,88,0.35)';
    ctx.lineWidth = Math.max(1, 1.4 * depth);
    ctx.stroke(wall);

    // roof
    ctx.fillStyle = 'rgba(191,108,88,0.7)';
    ctx.beginPath();
    ctx.moveTo(x0 - 3 * depth, topY + 2);
    ctx.lineTo(x1 + 3 * depth, topY + 2);
    ctx.lineTo(x1, topY - 6 * depth);
    ctx.lineTo(x0, topY - 6 * depth);
    ctx.closePath();
    ctx.fill();

    // striped awning
    const awnTop = topY + 16 * depth;
    const awn = new Path2D();
    awn.moveTo(x0 - 5 * depth, awnTop);
    awn.lineTo(x1 + 5 * depth, awnTop);
    awn.lineTo(x1 + 9 * depth, awnTop + 15 * depth);
    awn.lineTo(x0 - 9 * depth, awnTop + 15 * depth);
    awn.closePath();
    const awnColor = seed % 2 === 0 ? COLORS.rosa : COLORS.coral;
    ctx.fillStyle = awnColor;
    ctx.fill(awn);
    ctx.save();
    ctx.clip(awn);
    ctx.fillStyle = 'rgba(244,234,233,0.85)';
    for (let i = x0 - 10 * depth; i < x1 + 10 * depth; i += 8 * depth) {
      ctx.fillRect(i, awnTop, 4 * depth, 16 * depth);
    }
    ctx.restore();
    ctx.fillStyle = awnColor;
    for (let i = 0; i < 5; i++) {
      const cx = x0 + (i + 0.5) * (facadeW / 5);
      ctx.beginPath();
      ctx.arc(cx, awnTop + 15 * depth, 4 * depth, 0, Math.PI);
      ctx.fill();
    }

    // sign
    const label = SHOP_SIGNS[seed % SHOP_SIGNS.length];
    ctx.fillStyle = COLORS.navy;
    this.roundRect(ctx, x0 + 6 * depth, topY + 3 * depth, facadeW - 12 * depth, 11 * depth, 3 * depth);
    ctx.fill();
    if (depth > 0.4) {
      ctx.fillStyle = COLORS.cream;
      ctx.font = `800 ${Math.max(7, 8.5 * depth)}px Nunito,sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label, (x0 + x1) / 2, topY + 11.5 * depth);
    }

    // window
    const wx = (x0 + x1) / 2;
    const wy = awnTop + 22 * depth;
    const ww = 26 * depth;
    const wh = 30 * depth;
    ctx.fillStyle = COLORS.navy;
    this.roundRect(ctx, wx - ww / 2, wy, ww, wh, 3 * depth);
    ctx.fill();
    const winGrad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
    winGrad.addColorStop(0, 'rgba(255,252,248,0.95)');
    winGrad.addColorStop(1, 'rgba(234,152,175,0.5)');
    ctx.fillStyle = winGrad;
    this.roundRect(ctx, wx - ww / 2 + 2, wy + 2, ww - 4, wh - 4, 2 * depth);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,79,112,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wx, wy + 2);
    ctx.lineTo(wx, wy + wh - 2);
    ctx.moveTo(wx - ww / 2 + 2, wy + wh / 2);
    ctx.lineTo(wx + ww / 2 - 2, wy + wh / 2);
    ctx.stroke();

    if (depth > 0.45) {
      ctx.fillStyle = COLORS.rosa;
      ctx.beginPath();
      ctx.ellipse(wx - 5 * depth, wy + wh * 0.68, 4.5 * depth, 3.2 * depth, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.cream;
      ctx.beginPath();
      ctx.ellipse(wx - 5 * depth, wy + wh * 0.56, 4 * depth, 2.5 * depth, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.coral;
      ctx.beginPath();
      ctx.ellipse(wx + 6 * depth, wy + wh * 0.7, 4 * depth, 2.8 * depth, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // door
    const dx = side < 0 ? x0 + 5 * depth : x1 - 20 * depth;
    ctx.fillStyle = '#c48878';
    this.roundRect(ctx, dx, baseY - 32 * depth, 15 * depth, 32 * depth, 2 * depth);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    this.roundRect(ctx, dx + 2.5 * depth, baseY - 27 * depth, 10 * depth, 9 * depth, 1);
    ctx.fill();
    ctx.fillStyle = '#f0c14a';
    ctx.beginPath();
    ctx.arc(dx + 11 * depth, baseY - 15 * depth, 1.5 * depth, 0, Math.PI * 2);
    ctx.fill();

    // flower box
    if (depth > 0.5) {
      ctx.fillStyle = COLORS.cafe;
      this.roundRect(ctx, wx - ww * 0.55, wy + wh - 1, ww * 1.1, 6 * depth, 2);
      ctx.fill();
      ctx.fillStyle = COLORS.pistacho;
      ctx.beginPath();
      ctx.arc(wx - 6 * depth, wy + wh - 3 * depth, 3.2 * depth, 0, Math.PI * 2);
      ctx.arc(wx, wy + wh - 5 * depth, 3.6 * depth, 0, Math.PI * 2);
      ctx.arc(wx + 6 * depth, wy + wh - 3 * depth, 3 * depth, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.rosa;
      ctx.beginPath();
      ctx.arc(wx - 2 * depth, wy + wh - 7 * depth, 2.2 * depth, 0, Math.PI * 2);
      ctx.arc(wx + 4 * depth, wy + wh - 8 * depth, 2 * depth, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRoad(ctx, w, h) {
    const far = this.project(1, 12);
    const near = this.project(1, 0.85);
    const farW = far.roadW;
    const nearW = near.roadW;

    const path = new Path2D();
    path.moveTo(far.x - farW / 2, far.y);
    path.lineTo(far.x + farW / 2, far.y);
    path.lineTo(near.x + nearW / 2, near.y + 24);
    path.lineTo(near.x - nearW / 2, near.y + 24);
    path.closePath();

    // cobblestone base
    const roadGrad = ctx.createLinearGradient(0, far.y, 0, near.y + 24);
    roadGrad.addColorStop(0, '#e5d2cc');
    roadGrad.addColorStop(0.45, '#dcc6bf');
    roadGrad.addColorStop(1, '#cfb3ab');
    ctx.fillStyle = roadGrad;
    ctx.fill(path);

    // soft center highlight
    ctx.save();
    ctx.clip(path);
    const hi = ctx.createLinearGradient(w * 0.5 - nearW * 0.2, 0, w * 0.5 + nearW * 0.2, 0);
    hi.addColorStop(0, 'rgba(255,255,255,0)');
    hi.addColorStop(0.5, 'rgba(255,250,245,0.18)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.fillRect(0, far.y, w, near.y - far.y + 30);

    // cobble dots foreshortened
    ctx.fillStyle = 'rgba(191,108,88,0.12)';
    for (let row = 0; row < 18; row++) {
      const zt = 11.5 - row * 0.55;
      const p = this.project(1, zt);
      const rw = p.roadW;
      const cols = 5 + ((row * 3) % 4);
      for (let c = 0; c < cols; c++) {
        const lx = -0.95 + (c / (cols - 1 || 1)) * 1.9;
        const ox = p.x + lx * (rw / 2) * 0.92;
        const oy = p.y + ((row + this.bgOffset * 0.04) % 2) * 2;
        ctx.beginPath();
        ctx.ellipse(ox, oy, 5 * p.s, 2.2 * p.s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // pink frosting curb ribbons
    ctx.lineCap = 'round';
    ctx.strokeStyle = COLORS.rosa;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(far.x - farW / 2, far.y);
    ctx.lineTo(near.x - nearW / 2, near.y + 24);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(far.x + farW / 2, far.y);
    ctx.lineTo(near.x + nearW / 2, near.y + 24);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // cream curb highlight
    ctx.strokeStyle = 'rgba(244,234,233,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(far.x - farW / 2 + 3, far.y);
    ctx.lineTo(near.x - nearW / 2 + 5, near.y + 22);
    ctx.moveTo(far.x + farW / 2 - 3, far.y);
    ctx.lineTo(near.x + nearW / 2 - 5, near.y + 22);
    ctx.stroke();

    // dashed lane lines with scroll
    for (const laneEdge of [-0.5, 0.5]) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.72)';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([12, 14]);
      ctx.lineDashOffset = -this.bgOffset * 0.85;
      ctx.shadowColor = 'rgba(30,79,112,0.15)';
      ctx.shadowBlur = 2;
      ctx.beginPath();
      const fx = far.x + laneEdge * (farW / 3) * 2;
      const nx = near.x + laneEdge * (nearW / 3) * 2;
      ctx.moveTo(fx, far.y);
      ctx.lineTo(nx, near.y + 12);
      ctx.stroke();
      ctx.restore();
    }

    // vanishing-point soft fog
    const fog = ctx.createLinearGradient(0, far.y - 20, 0, far.y + 50);
    fog.addColorStop(0, 'rgba(247,214,222,0.55)');
    fog.addColorStop(1, 'rgba(247,214,222,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(far.x - farW, far.y - 30, farW * 2, 70);
  }

  drawGroundShadow(ctx, x, y, rx, ry) {
    ctx.save();
    ctx.fillStyle = 'rgba(30,79,112,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawCollect(ctx, e) {
    const { x, y, s } = this.project(e.lane, e.z);
    const scale = s * (e.r || 1);
    const bob = Math.sin(performance.now() / 240 + e.lane * 1.3) * 5 * s;

    ctx.save();
    this.drawGroundShadow(ctx, x, y + 2, 14 * scale, 5 * scale);

    ctx.translate(x, y - 8 * scale - bob);

    // soft glow
    const glow = ctx.createRadialGradient(0, -10 * scale, 2, 0, -8 * scale, 28 * scale);
    glow.addColorStop(0, (e.glow || COLORS.frosting) + '99');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -8 * scale, 28 * scale, 0, Math.PI * 2);
    ctx.fill();

    if (e.id === 'mini') this.drawMiniCake(ctx, scale);
    else if (e.id === 'lonchera') this.drawLonchera(ctx, scale);
    else if (e.id === 'capa') this.drawCapaCake(ctx, scale);
    else this.drawBodaCake(ctx, scale);

    if (s > 0.5) {
      ctx.font = `800 ${Math.max(8, 10 * s)}px Nunito,sans-serif`;
      ctx.fillStyle = COLORS.navy;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(244,234,233,0.9)';
      ctx.shadowBlur = 3;
      ctx.fillText(e.label, 0, 22 * scale);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  drawMiniCake(ctx, s) {
    // plate
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, 8 * s, 16 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,79,112,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // sponge
    const body = ctx.createLinearGradient(-12 * s, 0, 12 * s, 0);
    body.addColorStop(0, '#f0b8c4');
    body.addColorStop(0.5, COLORS.rosa);
    body.addColorStop(1, '#d97a92');
    ctx.fillStyle = body;
    this.roundRect(ctx, -12 * s, -6 * s, 24 * s, 16 * s, 4 * s);
    ctx.fill();

    // frosting dollop
    ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.ellipse(0, -6 * s, 13 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10 * s, -4 * s);
    ctx.quadraticCurveTo(-8 * s, 2 * s, -6 * s, -2 * s);
    ctx.quadraticCurveTo(-2 * s, 4 * s, 0 * s, -1 * s);
    ctx.quadraticCurveTo(3 * s, 4 * s, 6 * s, -2 * s);
    ctx.quadraticCurveTo(9 * s, 2 * s, 11 * s, -4 * s);
    ctx.closePath();
    ctx.fill();

    // cherry
    ctx.fillStyle = COLORS.coral;
    ctx.beginPath();
    ctx.arc(0, -14 * s, 4.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(-1.2 * s, -15.5 * s, 1.3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.pistacho;
    ctx.lineWidth = Math.max(1.2, 1.8 * s);
    ctx.beginPath();
    ctx.moveTo(0, -17.5 * s);
    ctx.quadraticCurveTo(4 * s, -22 * s, 6 * s, -18 * s);
    ctx.stroke();
  }

  drawLonchera(ctx, s) {
    // lunchbox body
    const g = ctx.createLinearGradient(-16 * s, -14 * s, 16 * s, 12 * s);
    g.addColorStop(0, '#f4a498');
    g.addColorStop(0.5, COLORS.coral);
    g.addColorStop(1, '#d45f55');
    ctx.fillStyle = g;
    this.roundRect(ctx, -16 * s, -12 * s, 32 * s, 24 * s, 7 * s);
    ctx.fill();

    // lid seam
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    this.roundRect(ctx, -14 * s, -10 * s, 28 * s, 8 * s, 4 * s);
    ctx.fill();

    // cake sticker
    ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.arc(0, 4 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.rosa;
    ctx.beginPath();
    ctx.ellipse(0, 3 * s, 5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // handle
    ctx.strokeStyle = COLORS.navy;
    ctx.lineWidth = Math.max(2, 2.8 * s);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -12 * s, 8 * s, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // latch
    ctx.fillStyle = '#f0c14a';
    this.roundRect(ctx, -4 * s, -2 * s, 8 * s, 5 * s, 2 * s);
    ctx.fill();
  }

  drawCapaCake(ctx, s) {
    // bottom tier
    this.drawCakeTier(ctx, 0, 6 * s, 20 * s, 12 * s, COLORS.pistacho, '#8bc49a');
    // top tier
    this.drawCakeTier(ctx, 0, -6 * s, 14 * s, 10 * s, '#7eb890', COLORS.pistacho);
    // frosting swirl
    ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.ellipse(0, -14 * s, 10 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.rosa;
    ctx.beginPath();
    ctx.arc(0, -20 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBodaCake(ctx, s) {
    this.drawCakeTier(ctx, 0, 10 * s, 22 * s, 11 * s, COLORS.navy, '#2a6288');
    this.drawCakeTier(ctx, 0, -2 * s, 16 * s, 10 * s, COLORS.rosa, '#f0b0c0');
    this.drawCakeTier(ctx, 0, -14 * s, 11 * s, 9 * s, COLORS.cream, '#fff');
    // topper cherry + sparkles
    ctx.fillStyle = COLORS.coral;
    ctx.beginPath();
    ctx.arc(0, -24 * s, 3.8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,120,0.9)';
    for (const [sx, sy] of [[-10, -28], [10, -26], [0, -32], [-6, -18]]) {
      this.drawSpark(ctx, sx * s, sy * s, 2.2 * s);
    }
  }

  drawCakeTier(ctx, x, y, w, h, color, hi) {
    const g = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
    g.addColorStop(0, hi);
    g.addColorStop(0.45, color);
    g.addColorStop(1, hi);
    ctx.fillStyle = g;
    this.roundRect(ctx, x - w / 2, y - h / 2, w, h, Math.min(6, h * 0.3));
    ctx.fill();
    // drip frosting
    ctx.fillStyle = 'rgba(244,234,233,0.85)';
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.42, w * 0.48, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    // bottom shadow edge
    ctx.fillStyle = 'rgba(30,79,112,0.12)';
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.42, w * 0.45, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSpark(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.3, y - r * 0.3);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x + r * 0.3, y + r * 0.3);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.3, y + r * 0.3);
    ctx.lineTo(x - r, y);
    ctx.lineTo(x - r * 0.3, y - r * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  drawObstacle(ctx, e) {
    const { x, y, s } = this.project(e.lane, e.z);
    const bw = 30 * s * (e.ow || 1);
    const bh = 24 * s * (e.oh || 1);

    ctx.save();
    this.drawGroundShadow(ctx, x, y + 2, bw * 0.7, 5 * s);
    ctx.translate(x, y);

    if (e.obsId === 'puddle') {
      const g = ctx.createRadialGradient(-bw * 0.2, -bh * 0.3, 2, 0, 0, bw);
      g.addColorStop(0, 'rgba(255,240,245,0.9)');
      g.addColorStop(0.5, 'rgba(234,152,175,0.85)');
      g.addColorStop(1, 'rgba(233,122,111,0.55)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -bh * 0.15, bw, bh * 0.55, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(-bw * 0.25, -bh * 0.35, bw * 0.3, bh * 0.18, -0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.obsId === 'pin') {
      const wood = ctx.createLinearGradient(0, -bh, 0, 0);
      wood.addColorStop(0, '#d4a090');
      wood.addColorStop(0.5, COLORS.cafe);
      wood.addColorStop(1, '#8a4a3a');
      ctx.fillStyle = wood;
      this.roundRect(ctx, -bw, -bh * 0.75, bw * 2, bh * 0.55, bh * 0.28);
      ctx.fill();
      // handles
      ctx.fillStyle = '#6e3a2e';
      ctx.beginPath();
      ctx.arc(-bw, -bh * 0.48, bh * 0.32, 0, Math.PI * 2);
      ctx.arc(bw, -bh * 0.48, bh * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      this.roundRect(ctx, -bw * 0.7, -bh * 0.7, bw * 1.4, bh * 0.15, 2);
      ctx.fill();
    } else if (e.obsId === 'box') {
      const boxG = ctx.createLinearGradient(-bw, -bh * 1.6, bw, 0);
      boxG.addColorStop(0, '#2a6288');
      boxG.addColorStop(0.5, COLORS.navy);
      boxG.addColorStop(1, '#163a54');
      ctx.fillStyle = boxG;
      this.roundRect(ctx, -bw * 0.9, -bh * 1.65, bw * 1.8, bh * 1.55, 5 * s);
      ctx.fill();
      // ribbon
      ctx.fillStyle = COLORS.rosa;
      ctx.fillRect(-bw * 0.9, -bh * 1.15, bw * 1.8, bh * 0.22);
      ctx.fillRect(-bw * 0.12, -bh * 1.65, bw * 0.24, bh * 1.55);
      // bow
      ctx.beginPath();
      ctx.ellipse(-bw * 0.2, -bh * 1.55, bw * 0.22, bh * 0.12, -0.4, 0, Math.PI * 2);
      ctx.ellipse(bw * 0.2, -bh * 1.55, bw * 0.22, bh * 0.12, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.cream;
      ctx.font = `800 ${Math.max(8, 11 * s)}px Nunito,sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('CAKE', 0, -bh * 0.55);
    } else {
      // spilled tray
      ctx.fillStyle = '#c9b0a8';
      this.roundRect(ctx, -bw, -bh * 0.95, bw * 2, bh * 0.72, 4 * s);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      this.roundRect(ctx, -bw + 2, -bh * 0.9, bw * 2 - 4, bh * 0.18, 2);
      ctx.fill();
      ctx.fillStyle = COLORS.rosa;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(bw * 0.1, -bh * 0.4, bw * 0.75, bh * 0.42, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.coral;
      ctx.beginPath();
      ctx.ellipse(bw * 0.35, -bh * 0.55, bw * 0.25, bh * 0.18, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (e.canJump && s > 0.55) {
      ctx.font = `800 ${Math.max(9, 11 * s)}px Nunito,sans-serif`;
      ctx.fillStyle = 'rgba(30,79,112,0.55)';
      ctx.textAlign = 'center';
      ctx.fillText('↑', 0, -bh * 1.85);
    }

    ctx.restore();
  }

  drawPlayer(ctx) {
    const jh = this.jumpHeight();
    const proj = this.project(this.laneX, 1.05);
    const x = proj.x;
    const y = proj.y;
    let s = proj.s * 1.14;
    const lift = jh * 62 * s;
    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    const t = performance.now();

    ctx.save();
    ctx.translate(x, y - lift);
    if (blink) ctx.globalAlpha = 0.35;

    // ground shadow
    ctx.fillStyle = 'rgba(30,79,112,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 6 * s, 20 * s * (1 - jh * 0.45), 7.5 * s * (1 - jh * 0.4), 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = Math.sin(t / 85) * 2.8 * s * (this.jumping ? 0 : 1);
    ctx.translate(0, -38 * s + bob);

    const legSwing = Math.sin(t / 68) * 10 * s * (this.jumping ? 0.15 : 1);
    const armSwing = Math.sin(t / 68 + 0.4) * 8 * s * (this.jumping ? 0.2 : 1);

    // legs + shoes
    ctx.strokeStyle = COLORS.navy;
    ctx.lineWidth = Math.max(2.5, 4 * s);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6 * s, 20 * s);
    ctx.lineTo(-6 * s - legSwing, 36 * s);
    ctx.moveTo(6 * s, 20 * s);
    ctx.lineTo(6 * s + legSwing, 36 * s);
    ctx.stroke();
    // shoes
    ctx.fillStyle = COLORS.cafe;
    ctx.beginPath();
    ctx.ellipse(-6 * s - legSwing, 38 * s, 7 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(6 * s + legSwing, 38 * s, 7 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // arms
    ctx.strokeStyle = COLORS.skin;
    ctx.lineWidth = Math.max(2, 3.2 * s);
    ctx.beginPath();
    ctx.moveTo(-12 * s, 2 * s);
    ctx.lineTo(-16 * s - armSwing * 0.3, 14 * s + armSwing * 0.2);
    ctx.moveTo(12 * s, 2 * s);
    ctx.lineTo(16 * s + armSwing * 0.3, 14 * s - armSwing * 0.2);
    ctx.stroke();

    // cupcake body / dress
    const dress = ctx.createLinearGradient(-16 * s, -8 * s, 16 * s, 24 * s);
    dress.addColorStop(0, '#f4b0c0');
    dress.addColorStop(0.5, COLORS.rosa);
    dress.addColorStop(1, '#d97890');
    ctx.fillStyle = dress;
    ctx.beginPath();
    ctx.moveTo(-14 * s, 2 * s);
    ctx.quadraticCurveTo(-18 * s, 22 * s, -12 * s, 26 * s);
    ctx.lineTo(12 * s, 26 * s);
    ctx.quadraticCurveTo(18 * s, 22 * s, 14 * s, 2 * s);
    ctx.closePath();
    ctx.fill();

    // apron
    ctx.fillStyle = COLORS.cream;
    this.roundRect(ctx, -9 * s, 4 * s, 18 * s, 16 * s, 4 * s);
    ctx.fill();
    // heart pocket
    ctx.fillStyle = COLORS.coral;
    ctx.beginPath();
    ctx.moveTo(0, 14 * s);
    ctx.bezierCurveTo(-6 * s, 8 * s, -5 * s, 4 * s, 0, 7 * s);
    ctx.bezierCurveTo(5 * s, 4 * s, 6 * s, 8 * s, 0, 14 * s);
    ctx.fill();
    // polka dots on dress sides
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (const [dx, dy] of [[-11, 10], [-10, 18], [11, 12], [10, 20]]) {
      ctx.beginPath();
      ctx.arc(dx * s, dy * s, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // torso / neck
    ctx.fillStyle = COLORS.skin;
    ctx.beginPath();
    ctx.arc(0, -2 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();

    // head
    ctx.beginPath();
    ctx.arc(0, -16 * s, 13 * s, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.skin;
    ctx.fill();

    // frosting hair swirl
    const frost = ctx.createRadialGradient(-2 * s, -28 * s, 2, 0, -24 * s, 20 * s);
    frost.addColorStop(0, '#ffd0dc');
    frost.addColorStop(0.55, COLORS.rosa);
    frost.addColorStop(1, '#d96a88');
    ctx.fillStyle = frost;
    ctx.beginPath();
    ctx.ellipse(0, -26 * s, 16 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(-10 * s, -20 * s, 8 * s, 7 * s, -0.3, 0, Math.PI * 2);
    ctx.ellipse(10 * s, -20 * s, 8 * s, 7 * s, 0.3, 0, Math.PI * 2);
    ctx.ellipse(-4 * s, -34 * s, 7 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(5 * s, -33 * s, 6 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // chef hat
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(30,79,112,0.15)';
    ctx.shadowBlur = 4;
    this.roundRect(ctx, -11 * s, -42 * s, 22 * s, 10 * s, 4 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -44 * s, 11 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // hat band
    ctx.fillStyle = COLORS.rosa;
    this.roundRect(ctx, -11 * s, -34 * s, 22 * s, 4 * s, 2 * s);
    ctx.fill();

    // cherry on hat
    ctx.fillStyle = COLORS.coral;
    ctx.beginPath();
    ctx.arc(7 * s, -50 * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(6 * s, -51 * s, 1.1 * s, 0, Math.PI * 2);
    ctx.fill();

    // blush
    ctx.fillStyle = 'rgba(233,122,111,0.35)';
    ctx.beginPath();
    ctx.ellipse(-8 * s, -12 * s, 3.5 * s, 2.2 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(8 * s, -12 * s, 3.5 * s, 2.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // eyes — wink on left when running fast enough
    ctx.fillStyle = COLORS.navy;
    const wink = Math.sin(t / 400) > 0.92;
    if (wink) {
      ctx.lineWidth = Math.max(1.5, 2 * s);
      ctx.strokeStyle = COLORS.navy;
      ctx.beginPath();
      ctx.arc(-4.5 * s, -16 * s, 2.2 * s, 0.15, Math.PI - 0.15);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-4.5 * s, -16 * s, 2.1 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-5.1 * s, -16.7 * s, 0.7 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.navy;
    }
    ctx.beginPath();
    ctx.arc(4.5 * s, -16 * s, 2.1 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(3.9 * s, -16.7 * s, 0.7 * s, 0, Math.PI * 2);
    ctx.fill();

    // smile
    ctx.strokeStyle = COLORS.navy;
    ctx.lineWidth = Math.max(1.2, 1.6 * s);
    ctx.beginPath();
    ctx.arc(0, -11 * s, 4 * s, 0.15, Math.PI - 0.15);
    ctx.stroke();

    // sprinkles in frosting
    ctx.fillStyle = '#f0c14a';
    ctx.fillRect(-6 * s, -30 * s, 2.5 * s, 1.2 * s);
    ctx.fillStyle = COLORS.pistacho;
    ctx.fillRect(3 * s, -28 * s, 2.2 * s, 1.2 * s);
    ctx.fillStyle = '#7ec8e3';
    ctx.fillRect(-2 * s, -36 * s, 2 * s, 1.1 * s);

    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life * 2.2, 0, 1);
      ctx.translate(p.x, p.y);
      if (p.spin) ctx.rotate(p.spin);
      if (p.kind === 'heart') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, p.r * 0.6);
        ctx.bezierCurveTo(-p.r, -p.r * 0.2, -p.r * 0.8, -p.r, 0, -p.r * 0.35);
        ctx.bezierCurveTo(p.r * 0.8, -p.r, p.r, -p.r * 0.2, 0, p.r * 0.6);
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = '#f0c14a';
        this.drawSpark(ctx, 0, 0, p.r);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
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
