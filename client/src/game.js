import {
  BOARD_SIZE,
  dealHand,
  emptyBoard,
  canPlace,
  canFitAnywhere,
  placePiece,
  comboLabel,
  scorePlacement,
} from './pieces.js';
import { sfxPlace, sfxClear, sfxCombo, sfxGameOver, sfxDeal } from './audio.js';

const PAD = 10;
const TRAY_GAP = 10;
const TRAY_H_RATIO = 0.22;

export class CakeGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{
   *   onScore:(n:number)=>void,
   *   onBestCombo:(n:number)=>void,
   *   onHand:(hand:any[])=>void,
   *   onGameOver:(score:number)=>void,
   *   onCombo:(label:string, lines:number)=>void,
   * }} hooks
   */
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.ctx = canvas.getContext('2d');
    this.score = 0;
    this.bestCombo = 0;
    this.clearStreak = 0;
    this.running = false;
    this.gameOver = false;
    this.board = emptyBoard();
    this.hand = dealHand();
    this.particles = [];
    this.flashes = []; // cleared cell flashes
    this.shake = 0;
    this.drag = null; // { index, offsetX, offsetY, ghostRow, ghostCol, valid }
    this._raf = 0;
    this._pointerId = null;

    this._resize();
    this._bindInput();
    window.addEventListener('resize', () => {
      this._resize();
      this._draw();
    });
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

    this.trayTop = this.H * (1 - TRAY_H_RATIO);
    this.boardArea = {
      x: PAD,
      y: PAD,
      w: this.W - PAD * 2,
      h: this.trayTop - PAD - 8,
    };
    const side = Math.min(this.boardArea.w, this.boardArea.h);
    this.cell = side / BOARD_SIZE;
    this.gridX = this.boardArea.x + (this.boardArea.w - side) / 2;
    this.gridY = this.boardArea.y + (this.boardArea.h - side) / 2;
    this.gridSize = side;

    // tray slots
    const slotW = (this.W - PAD * 2 - TRAY_GAP * 2) / 3;
    const slotH = this.H - this.trayTop - PAD;
    this.slots = [0, 1, 2].map((i) => ({
      x: PAD + i * (slotW + TRAY_GAP),
      y: this.trayTop,
      w: slotW,
      h: slotH,
    }));
  }

  start() {
    this.score = 0;
    this.bestCombo = 0;
    this.clearStreak = 0;
    this.running = true;
    this.gameOver = false;
    this.board = emptyBoard();
    this.hand = dealHand();
    this.particles = [];
    this.flashes = [];
    this.shake = 0;
    this.drag = null;
    this.hooks.onScore?.(0);
    this.hooks.onBestCombo?.(0);
    this.hooks.onHand?.(this.hand);
    sfxDeal();
    this._ensureLoop();
    this._checkGameOver();
  }

  _ensureLoop() {
    if (this._raf) return;
    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      this._update();
      this._draw();
    };
    this._raf = requestAnimationFrame(tick);
  }

  _update() {
    if (this.shake > 0) this.shake *= 0.85;
    if (this.shake < 0.15) this.shake = 0;

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 1;
      p.r *= 0.985;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const f of this.flashes) f.t -= 1;
    this.flashes = this.flashes.filter((f) => f.t > 0);
  }

  _bindInput() {
    const canvas = this.canvas;

    const pos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e.changedTouches ? e.changedTouches[0] : e;
      return {
        x: t.clientX - rect.left,
        y: t.clientY - rect.top,
      };
    };

    const onDown = (e) => {
      if (!this.running || this.gameOver || this.drag) return;
      const { x, y } = pos(e);
      const idx = this._hitSlot(x, y);
      if (idx < 0) return;
      const piece = this.hand[idx];
      if (!piece || piece.used) return;

      const slot = this.slots[idx];
      this.drag = {
        index: idx,
        grabX: x,
        grabY: y,
        // offset so piece centers under finger a bit above
        offsetX: 0,
        offsetY: -this.cell * 1.2,
        x,
        y,
        ghostRow: -1,
        ghostCol: -1,
        valid: false,
      };
      this._pointerId = e.pointerId ?? null;
      try {
        canvas.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      e.preventDefault?.();
    };

    const onMove = (e) => {
      if (!this.drag) return;
      const { x, y } = pos(e);
      this.drag.x = x;
      this.drag.y = y;
      this._updateGhost();
      e.preventDefault?.();
    };

    const onUp = (e) => {
      if (!this.drag) return;
      this._updateGhost();
      const { ghostRow, ghostCol, valid, index } = this.drag;
      this.drag = null;
      this._pointerId = null;
      if (valid) {
        this._commitPlace(index, ghostRow, ghostCol);
      }
      e.preventDefault?.();
    };

    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', onUp, { passive: false });
    canvas.addEventListener('pointercancel', onUp, { passive: false });
    // touch fallback
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp, { passive: false });
  }

  _hitSlot(x, y) {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return i;
    }
    return -1;
  }

  _updateGhost() {
    if (!this.drag) return;
    const piece = this.hand[this.drag.index];
    if (!piece) return;
    const gx = this.drag.x + this.drag.offsetX;
    const gy = this.drag.y + this.drag.offsetY;
    // map to top-left cell of piece bounding box
    const col = Math.round((gx - this.gridX) / this.cell - piece.cols / 2 + 0.5) - 0;
    // better: center the piece under pointer
    const originCol = Math.floor((gx - this.gridX) / this.cell - (piece.cols - 1) / 2);
    const originRow = Math.floor((gy - this.gridY) / this.cell - (piece.rows - 1) / 2);
    this.drag.ghostCol = originCol;
    this.drag.ghostRow = originRow;
    this.drag.valid = canPlace(this.board, piece, originRow, originCol);
  }

  _commitPlace(index, row, col) {
    const piece = this.hand[index];
    if (!piece || !canPlace(this.board, piece, row, col)) return;

    const result = placePiece(this.board, piece, row, col);
    piece.used = true;
    sfxPlace();

    if (result.linesCleared > 0) {
      this.clearStreak += 1;
      this.bestCombo = Math.max(this.bestCombo, this.clearStreak);
      this.hooks.onBestCombo?.(this.bestCombo);
      this._burstClear(result);
      const label = comboLabel(result.linesCleared);
      if (result.linesCleared >= 2) {
        sfxCombo(result.linesCleared);
        this.hooks.onCombo?.(label, result.linesCleared);
      } else {
        sfxClear();
        this.hooks.onCombo?.(label, result.linesCleared);
      }
      this.shake = Math.min(10, 3 + result.linesCleared * 1.5);
    } else {
      this.clearStreak = 0;
    }

    const { score: add } = scorePlacement({
      cellsPlaced: result.cellsPlaced,
      linesCleared: result.linesCleared,
      streak: this.clearStreak,
    });
    this.score += add;
    this.hooks.onScore?.(this.score);
    this.hooks.onHand?.(this.hand);

    // refill hand when all used
    if (this.hand.every((p) => !p || p.used)) {
      this.hand = dealHand();
      sfxDeal();
      this.hooks.onHand?.(this.hand);
    }

    this._checkGameOver();
  }

  _burstClear(result) {
    for (const [r, c, cell] of result.clearedCells) {
      const cx = this.gridX + c * this.cell + this.cell / 2;
      const cy = this.gridY + r * this.cell + this.cell / 2;
      this.flashes.push({ r, c, color: cell?.color || '#ea98af', t: 14, max: 14 });
      const n = 8 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const spd = 1.5 + Math.random() * 3.5;
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 1.5,
          r: 2 + Math.random() * 3.5,
          color: cell?.icing || cell?.color || '#fff',
          life: 28 + Math.random() * 18,
        });
      }
    }
  }

  _checkGameOver() {
    const remaining = this.hand.filter((p) => p && !p.used);
    if (remaining.length === 0) return;
    const anyFit = remaining.some((p) => canFitAnywhere(this.board, p));
    if (!anyFit) {
      this.gameOver = true;
      this.running = false;
      sfxGameOver();
      setTimeout(() => this.hooks.onGameOver?.(this.score), 350);
    }
  }

  _draw() {
    const ctx = this.ctx;
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;

    ctx.clearRect(0, 0, this.W, this.H);
    ctx.save();
    ctx.translate(sx, sy);

    // board plate
    this._roundRect(
      this.gridX - 6,
      this.gridY - 6,
      this.gridSize + 12,
      this.gridSize + 12,
      16
    );
    ctx.fillStyle = 'rgba(255,253,251,0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(234,152,175,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // grid cells
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = this.gridX + c * this.cell;
        const y = this.gridY + r * this.cell;
        const pad = 2;
        this._roundRect(x + pad, y + pad, this.cell - pad * 2, this.cell - pad * 2, 6);
        const cell = this.board[r][c];
        if (cell) {
          this._drawCakeCell(x + pad, y + pad, this.cell - pad * 2, cell.color, cell.icing);
        } else {
          ctx.fillStyle = 'rgba(234,152,175,0.12)';
          ctx.fill();
        }
      }
    }

    // flashes
    for (const f of this.flashes) {
      const a = f.t / f.max;
      const x = this.gridX + f.c * this.cell;
      const y = this.gridY + f.r * this.cell;
      const pad = 2;
      this._roundRect(x + pad, y + pad, this.cell - pad * 2, this.cell - pad * 2, 6);
      ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
      ctx.fill();
      ctx.strokeStyle = f.color;
      ctx.globalAlpha = a;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ghost
    if (this.drag) {
      const piece = this.hand[this.drag.index];
      if (piece) {
        const { ghostRow, ghostCol, valid } = this.drag;
        if (ghostRow >= -2 && ghostCol >= -2) {
          for (const [dr, dc] of piece.cells) {
            const r = ghostRow + dr;
            const c = ghostCol + dc;
            if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) continue;
            const x = this.gridX + c * this.cell;
            const y = this.gridY + r * this.cell;
            const pad = 2;
            this._roundRect(x + pad, y + pad, this.cell - pad * 2, this.cell - pad * 2, 6);
            ctx.fillStyle = valid ? `${piece.color}99` : 'rgba(233,122,111,0.45)';
            ctx.fill();
            if (valid) {
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          }
        }
      }
    }

    // tray background
    this._roundRect(PAD / 2, this.trayTop - 4, this.W - PAD, this.H - this.trayTop + 2, 18);
    ctx.fillStyle = 'rgba(255,253,251,0.72)';
    ctx.fill();

    // tray pieces
    for (let i = 0; i < 3; i++) {
      const slot = this.slots[i];
      this._roundRect(slot.x, slot.y, slot.w, slot.h, 14);
      ctx.fillStyle = 'rgba(244,234,233,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(234,152,175,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const piece = this.hand[i];
      if (!piece || piece.used) continue;
      if (this.drag && this.drag.index === i) continue;

      const fits = canFitAnywhere(this.board, piece);
      ctx.globalAlpha = fits ? 1 : 0.38;
      this._drawPieceInSlot(piece, slot);
      ctx.globalAlpha = 1;
    }

    // dragging piece under finger
    if (this.drag) {
      const piece = this.hand[this.drag.index];
      if (piece) {
        const cell = this.cell * 0.92;
        const w = piece.cols * cell;
        const h = piece.rows * cell;
        const ox = this.drag.x + this.drag.offsetX - w / 2;
        const oy = this.drag.y + this.drag.offsetY - h / 2;
        ctx.save();
        ctx.shadowColor = 'rgba(30,79,112,0.35)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 8;
        for (const [dr, dc] of piece.cells) {
          const x = ox + dc * cell;
          const y = oy + dr * cell;
          this._drawCakeCell(x + 1, y + 1, cell - 2, piece.color, piece.icing);
        }
        ctx.restore();
      }
    }

    // particles
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  _drawPieceInSlot(piece, slot) {
    const maxDim = Math.max(piece.rows, piece.cols);
    const cell = Math.min(slot.w, slot.h) / (maxDim + 1.1);
    const w = piece.cols * cell;
    const h = piece.rows * cell;
    const ox = slot.x + (slot.w - w) / 2;
    const oy = slot.y + (slot.h - h) / 2;
    for (const [dr, dc] of piece.cells) {
      this._drawCakeCell(ox + dc * cell + 1, oy + dr * cell + 1, cell - 2, piece.color, piece.icing);
    }
  }

  _drawCakeCell(x, y, s, color, icing) {
    const ctx = this.ctx;
    this._roundRect(x, y, s, s, Math.max(4, s * 0.22));
    const g = ctx.createLinearGradient(x, y, x, y + s);
    g.addColorStop(0, icing || '#fff');
    g.addColorStop(0.35, color);
    g.addColorStop(1, this._shade(color, -22));
    ctx.fillStyle = g;
    ctx.fill();
    // frosting shine
    ctx.beginPath();
    ctx.ellipse(x + s * 0.35, y + s * 0.3, s * 0.22, s * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
    // sprinkle
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(x + s * 0.55, y + s * 0.48, s * 0.12, s * 0.06);
  }

  _shade(hex, amt) {
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

  _roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
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
