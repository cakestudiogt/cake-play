import Matter from 'matter-js';
import { CAKES, randomDropTier, mergeScore } from './cakes.js';
import { sfxDrop, sfxMerge, sfxCombo, sfxGameOver } from './audio.js';

const { Engine, World, Bodies, Body, Events, Composite } = Matter;

const WALL = 18;
const DANGER_Y_RATIO = 0.14;
const SETTLE_MS = 750;

export class CakeGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ onScore:(n:number)=>void, onNext:(tier:number)=>void, onGameOver:(score:number)=>void, onCombo:(n:number)=>void }} hooks
   */
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.score = 0;
    this.running = false;
    this.gameOver = false;
    this.dropReady = true;
    this.pendingTier = 0;
    this.nextTier = randomDropTier(2);
    this.aimX = 0.5;
    this.pointerDown = false;
    this.combo = 0;
    this.comboTimer = 0;
    this.particles = [];
    this.mergeQueue = new Set();
    this.maxUnlocked = 2;
    this._raf = 0;
    this._dangerFrames = 0;

    this.engine = Engine.create({
      gravity: { x: 0, y: 1.05 },
      enableSleeping: true,
    });
    this.engine.timing.timeScale = 1;

    this.ctx = canvas.getContext('2d');
    this._resize();
    this._buildWorld();
    this._bindInput();

    this.pendingTier = randomDropTier(2);
    this.nextTier = randomDropTier(2);
    this.hooks.onNext?.(this.nextTier);

    Events.on(this.engine, 'collisionStart', (e) => this._onCollisions(e));
  }

  _resize() {
    const shell = this.canvas.parentElement;
    const rect = shell.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = rect.width;
    this.cssH = rect.height;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = rect.width;
    this.H = rect.height;
    this.dangerY = this.H * DANGER_Y_RATIO;
  }

  _buildWorld() {
    World.clear(this.engine.world, false);
    Engine.clear(this.engine);

    const opts = { isStatic: true, friction: 0.35, restitution: 0.05, label: 'wall' };
    const floor = Bodies.rectangle(this.W / 2, this.H + WALL / 2, this.W + 80, WALL, opts);
    const left = Bodies.rectangle(-WALL / 2, this.H / 2, WALL, this.H * 2, opts);
    const right = Bodies.rectangle(this.W + WALL / 2, this.H / 2, WALL, this.H * 2, opts);
    World.add(this.engine.world, [floor, left, right]);
  }

  _bindInput() {
    const toAim = (clientX) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      this.aimX = Math.min(0.92, Math.max(0.08, x));
    };

    const onDown = (e) => {
      if (!this.running || this.gameOver) return;
      const t = e.touches ? e.touches[0] : e;
      this.pointerDown = true;
      toAim(t.clientX);
      e.preventDefault?.();
    };
    const onMove = (e) => {
      if (!this.pointerDown || !this.running || this.gameOver) return;
      const t = e.touches ? e.touches[0] : e;
      toAim(t.clientX);
      e.preventDefault?.();
    };
    const onUp = (e) => {
      if (!this.pointerDown) return;
      this.pointerDown = false;
      if (this.running && !this.gameOver) this.drop();
      e.preventDefault?.();
    };

    this.canvas.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false });
    this.canvas.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (!this.running || this.gameOver) return;
      if (e.key === 'ArrowLeft') this.aimX = Math.max(0.08, this.aimX - 0.04);
      if (e.key === 'ArrowRight') this.aimX = Math.min(0.92, this.aimX + 0.04);
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.drop();
      }
    });

    this._onResize = () => {
      // Keep physics coords stable — only redraw scale via CSS; skip hard rebuild mid-game
    };
    window.addEventListener('resize', this._onResize);
  }

  start() {
    this._resize();
    this.reset();
    this.running = true;
    this.gameOver = false;
    this._loop(performance.now());
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.particles = [];
    this.mergeQueue.clear();
    this.dropReady = true;
    this.gameOver = false;
    this._dangerFrames = 0;
    this.maxUnlocked = 2;
    this.pendingTier = randomDropTier(2);
    this.nextTier = randomDropTier(2);
    this.hooks.onScore?.(0);
    this.hooks.onNext?.(this.nextTier);
    Composite.clear(this.engine.world, false);
    this._buildWorld();
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  drop() {
    if (!this.dropReady || this.gameOver || !this.running) return;
    const tier = this.pendingTier;
    const cake = CAKES[tier];
    const x = this.aimX * this.W;
    const y = this.dangerY + cake.radius + 4;
    // Keep inside walls
    const clampedX = Math.min(this.W - cake.radius - 4, Math.max(cake.radius + 4, x));

    const body = Bodies.circle(clampedX, y, cake.radius, {
      restitution: 0.12,
      friction: 0.45,
      frictionAir: 0.012,
      density: 0.0018 + tier * 0.00015,
      label: 'cake',
      slop: 0.05,
    });
    body.plugin = { tier, born: performance.now(), merging: false };
    World.add(this.engine.world, body);

    sfxDrop();
    this.dropReady = false;
    this.pendingTier = this.nextTier;
    this.nextTier = randomDropTier(this.maxUnlocked);
    this.hooks.onNext?.(this.nextTier);

    setTimeout(() => {
      if (!this.gameOver) this.dropReady = true;
    }, SETTLE_MS);
  }

  _onCollisions(event) {
    for (const pair of event.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      if (a.label !== 'cake' || b.label !== 'cake') continue;
      if (a.plugin?.merging || b.plugin?.merging) continue;
      if (a.plugin?.tier !== b.plugin?.tier) continue;
      const tier = a.plugin.tier;
      if (tier >= CAKES.length - 1) continue;
      // Debounce same pair
      const key = [a.id, b.id].sort().join('-');
      if (this.mergeQueue.has(key)) continue;
      this.mergeQueue.add(key);
      this._merge(a, b, tier);
      setTimeout(() => this.mergeQueue.delete(key), 200);
    }
  }

  _merge(a, b, tier) {
    a.plugin.merging = true;
    b.plugin.merging = true;
    const nx = (a.position.x + b.position.x) / 2;
    const ny = (a.position.y + b.position.y) / 2;
    World.remove(this.engine.world, a);
    World.remove(this.engine.world, b);

    const next = tier + 1;
    this.maxUnlocked = Math.max(this.maxUnlocked, next);
    const cake = CAKES[next];
    const body = Bodies.circle(nx, ny, cake.radius, {
      restitution: 0.14,
      friction: 0.4,
      frictionAir: 0.01,
      density: 0.0018 + next * 0.00015,
      label: 'cake',
    });
    body.plugin = { tier: next, born: performance.now(), merging: false };
    Body.setVelocity(body, { x: 0, y: -1.2 });
    World.add(this.engine.world, body);

    this.combo += 1;
    this.comboTimer = performance.now();
    const pts = mergeScore(next) * (1 + Math.min(this.combo - 1, 5) * 0.25);
    this.score += Math.round(pts);
    this.hooks.onScore?.(this.score);
    sfxMerge(next);
    if (this.combo >= 2) {
      sfxCombo(this.combo);
      this.hooks.onCombo?.(this.combo);
    }
    this._burst(nx, ny, cake.color, 12 + next * 2);
  }

  _burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 1,
        life: 1,
        color,
        r: 2 + Math.random() * 4,
      });
    }
  }

  _checkDanger(now) {
    const cakes = Composite.allBodies(this.engine.world).filter((b) => b.label === 'cake');
    let over = false;
    for (const b of cakes) {
      // Only count settled cakes that stay above the line
      if (now - (b.plugin?.born || 0) < SETTLE_MS + 200) continue;
      if (b.speed > 1.8) continue;
      const top = b.position.y - (b.circleRadius || 0);
      if (top < this.dangerY) {
        over = true;
        break;
      }
    }
    if (over) {
      this._dangerFrames += 1;
      if (this._dangerFrames > 55) this._endGame();
    } else {
      this._dangerFrames = Math.max(0, this._dangerFrames - 2);
    }
  }

  _endGame() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.dropReady = false;
    sfxGameOver();
    this.hooks.onGameOver?.(this.score);
  }

  _loop(now) {
    if (!this.running) return;
    Engine.update(this.engine, 1000 / 60);
    if (now - this.comboTimer > 1400) this.combo = 0;
    if (!this.gameOver) this._checkDanger(now);
    this._draw(now);
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  _draw(now) {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    ctx.clearRect(0, 0, W, H);

    // Soft inner gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#fff9f7');
    g.addColorStop(1, '#f3e3df');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Danger line
    const pulse = 0.45 + Math.sin(now / 220) * 0.2;
    ctx.strokeStyle = `rgba(233, 122, 111, ${0.55 + this._dangerFrames / 120})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(10, this.dangerY);
    ctx.lineTo(W - 10, this.dangerY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(233, 122, 111, ${pulse * 0.12 + this._dangerFrames / 200})`;
    ctx.fillRect(0, 0, W, this.dangerY);

    ctx.fillStyle = 'rgba(233, 122, 111, 0.85)';
    ctx.font = '700 11px Nunito, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('PELIGRO', 14, this.dangerY - 6);

    // Ghost preview
    if (this.running && !this.gameOver && this.dropReady) {
      const cake = CAKES[this.pendingTier];
      const x = Math.min(W - cake.radius - 4, Math.max(cake.radius + 4, this.aimX * W));
      const y = this.dangerY + cake.radius + 4;
      ctx.globalAlpha = 0.55;
      this._drawCake(ctx, x, y, this.pendingTier, 1);
      ctx.globalAlpha = 1;
      // Guide line
      ctx.strokeStyle = 'rgba(30, 79, 112, 0.15)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(x, y + cake.radius);
      ctx.lineTo(x, H - 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const bodies = Composite.allBodies(this.engine.world);
    for (const b of bodies) {
      if (b.label !== 'cake') continue;
      this._drawCake(ctx, b.position.x, b.position.y, b.plugin.tier, b.angle);
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 0.03;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (this.gameOver) {
      ctx.fillStyle = 'rgba(30, 79, 112, 0.18)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  _drawCake(ctx, x, y, tier, angle) {
    const cake = CAKES[tier];
    if (!cake) return;
    const r = cake.radius;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(2, r * 0.55, r * 0.85, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30, 79, 112, 0.12)';
    ctx.fill();

    // Body
    const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r);
    bodyGrad.addColorStop(0, shade(cake.color, 28));
    bodyGrad.addColorStop(0.55, cake.color);
    bodyGrad.addColorStop(1, shade(cake.color, -22));
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Icing cap
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.28, r * 0.78, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = cake.icing;
    ctx.fill();

    // Cherry / topper
    ctx.beginPath();
    ctx.arc(0, -r * 0.55, Math.max(3, r * 0.14), 0, Math.PI * 2);
    ctx.fillStyle = tier >= 5 ? '#5ca370' : '#e97a6f';
    ctx.fill();

    // Ring
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r - 1.5, 0, Math.PI * 2);
    ctx.stroke();

    // Emoji hint for larger
    if (r >= 28) {
      ctx.rotate(-(angle || 0));
      ctx.font = `${Math.floor(r * 0.7)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.92;
      ctx.fillText(cake.emoji, 0, 2);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

function shade(hex, amt) {
  const n = hex.replace('#', '');
  const num = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n, 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}
