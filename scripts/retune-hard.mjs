/**
 * Retune levels that are too linear (fr≈1, start=1) or too weak.
 * Prefer 2–3 legal openers with fatal wrong branches (planning).
 */
import { readFileSync, writeFileSync } from 'fs';
import { LEVELS } from '../client/src/levels.js';

const DIRS = ['U', 'D', 'L', 'R'];
const DELTA = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
const clone = (g) => g.map((r) => r.slice());
const empty = (s) => Array.from({ length: s }, () => Array(s).fill(null));
function pathClear(g, r, c, dir = g[r][c]) {
  if (!dir) return false;
  const [dr, dc] = DELTA[dir];
  let nr = r + dr, nc = c + dc, n = g.length;
  while (nr >= 0 && nr < n && nc >= 0 && nc < n) {
    if (g[nr][nc]) return false;
    nr += dr; nc += dc;
  }
  return true;
}
function listM(g) {
  const o = [];
  const n = g.length;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (g[r][c] && pathClear(g, r, c)) o.push([r, c]);
  return o;
}
function count(g) {
  let n = 0;
  for (const row of g) for (const c of row) if (c) n++;
  return n;
}
function solvable(grid, limit = 200000) {
  const key = (g) => g.map((row) => row.map((c) => c || '.').join('')).join('|');
  const seen = new Set();
  let nodes = 0;
  function dfs(g) {
    if (++nodes > limit) return false;
    if (count(g) === 0) return true;
    const k = key(g);
    if (seen.has(k)) return false;
    seen.add(k);
    for (const [r, c] of listM(g)) {
      const next = clone(g);
      next[r][c] = null;
      if (dfs(next)) return true;
    }
    return false;
  }
  return dfs(clone(grid));
}
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function trapStats(grid) {
  if (!solvable(grid)) return null;
  const arrows = count(grid);
  const startMoves = listM(grid).length;
  // How many opening moves lead to dead end?
  let traps = 0;
  let safe = 0;
  for (const [r, c] of listM(grid)) {
    const n = clone(grid);
    n[r][c] = null;
    if (solvable(n, 120000)) safe++;
    else traps++;
  }
  // Walk min-branch path for forced count; at each step count traps
  let g = clone(grid);
  let forced = 0, sum = 0, steps = 0, trapSteps = 0, maxRun = 0, run = 0;
  while (count(g) > 0) {
    const moves = listM(g);
    if (!moves.length) return null;
    sum += moves.length;
    steps++;
    if (moves.length === 1) { forced++; run++; maxRun = Math.max(maxRun, run); }
    else run = 0;
    let stepTraps = 0;
    const scored = [];
    for (const [r, c] of moves) {
      const n = clone(g);
      n[r][c] = null;
      const ok = solvable(n, 80000);
      if (!ok) stepTraps++;
      scored.push({ r, c, ok, next: listM(n).length });
    }
    if (stepTraps > 0 && moves.length > 1) trapSteps++;
    // Prefer safe move that leaves fewest options
    scored.sort((a, b) => {
      if (a.ok !== b.ok) return a.ok ? -1 : 1;
      return a.next - b.next;
    });
    const pick = scored.find((s) => s.ok) || scored[0];
    g[pick.r][pick.c] = null;
  }
  const fr = forced / arrows;
  const avg = sum / steps;
  // Ideal: start 2-3, some traps, still substantial force, high decoys
  const startSweet = startMoves === 2 ? 12 : startMoves === 3 ? 8 : startMoves === 1 ? 2 : -startMoves * 3;
  const score =
    arrows * 1.1 +
    forced * 3.2 +
    fr * 18 +
    traps * 10 +
    trapSteps * 4 +
    maxRun * 2 +
    startSweet +
    (3.0 - Math.min(avg, 3)) * 8 +
    Math.max(0, arrows - startMoves) * 1.2;

  return {
    arrows, startMoves, forced, fr: +fr.toFixed(3), avg: +avg.toFixed(2),
    traps, trapSteps, maxRun, safe, score: +score.toFixed(2),
  };
}

function generateTight(size, target, rng, opts = {}) {
  const g = empty(size);
  // seed edge
  const seeds = [];
  for (let i = 0; i < size; i++) {
    seeds.push([0, i, 'U'], [size - 1, i, 'D'], [i, 0, 'L'], [i, size - 1, 'R']);
  }
  const s = seeds[(rng() * seeds.length) | 0];
  g[s[0]][s[1]] = s[2];
  let placed = 1;
  const maxMov = opts.maxMovable ?? 3;

  while (placed < target) {
    const movable = listM(g);
    const cells = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!g[r][c]) cells.push([r, c]);
    // Prefer path-block cells
    const blockCells = [];
    for (const [mr, mc] of movable) {
      const [dr, dc] = DELTA[g[mr][mc]];
      let nr = mr + dr, nc = mc + dc;
      while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        if (!g[nr][nc]) blockCells.push([nr, nc]);
        nr += dr; nc += dc;
      }
    }
    const pool = blockCells.length && rng() < 0.75
      ? [...blockCells, ...cells].slice(0, 24)
      : cells;
    for (let i = pool.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let done = false;
    for (const [r, c] of pool.slice(0, 22)) {
      if (g[r][c]) continue;
      const valid = DIRS.filter((d) => pathClear(g, r, c, d));
      if (!valid.length) continue;
      let best = null, bs = -1e9;
      for (const d of valid) {
        g[r][c] = d;
        let blocked = 0;
        for (const [mr, mc] of movable) if (!pathClear(g, mr, mc)) blocked++;
        const mv = listM(g).length;
        // Prefer mv in {2,3} late in fill to create traps; early keep tight
        let mvScore;
        if (placed < target * 0.55) mvScore = mv <= 1 ? 8 : mv <= 2 ? 5 : -mv * 3;
        else mvScore = mv === 2 ? 10 : mv === 3 ? 6 : mv === 1 ? 3 : -mv * 4;
        const sc = blocked * 12 + mvScore + rng();
        if (sc > bs) { bs = sc; best = d; }
        g[r][c] = null;
      }
      if (best == null) continue;
      g[r][c] = best;
      if (listM(g).length > maxMov && rng() < 0.88) { g[r][c] = null; continue; }
      placed++;
      done = true;
      break;
    }
    if (!done) break;
  }
  if (count(g) < Math.floor(target * 0.88)) return null;
  if (!solvable(g)) return null;
  return g;
}

function rowsOf(g) { return g.map((r) => r.map((c) => c || '.').join('')); }
function parseRows(rows) { return rows.map((row) => [...row].map((ch) => (ch === '.' ? null : ch))); }

const parses = LEVELS.map((L) => L.grid.map((row) => row.map((c) => c || '.').join('')));

function needsRetune(lev, st) {
  if (lev <= 7) return false;
  if (!st) return true;
  // Too linear follow-the-glow for mid game
  if (lev <= 40 && st.startMoves === 1 && st.fr >= 0.95) return true;
  // Weak late
  if (lev >= 50 && (st.fr < 0.42 || st.startMoves > 4)) return true;
  if (lev >= 8 && lev <= 20 && st.fr < 0.5) return true;
  // No traps and multiple moves is ok; no traps and start=1 is boring
  if (lev >= 8 && st.traps === 0 && st.startMoves <= 1 && st.fr > 0.9) return true;
  return false;
}

const sizeFor = (lev) => {
  if (lev <= 8) return 3;
  if (lev <= 16) return 4;
  if (lev <= 28) return 5;
  if (lev <= 45) return 6;
  return 7;
};
const arrowsFor = (lev) => {
  if (lev <= 8) return 6;
  if (lev <= 12) return 9;
  if (lev <= 16) return 11;
  if (lev <= 20) return 14;
  if (lev <= 28) return 16;
  if (lev <= 36) return 19;
  if (lev <= 45) return 22;
  if (lev <= 55) return 25;
  if (lev <= 65) return 28;
  if (lev <= 72) return 32;
  return 35;
};

let retuned = 0;
for (let lev = 8; lev <= parses.length; lev++) {
  const i = lev - 1;
  const cur = parseRows(parses[i]);
  const st0 = trapStats(cur);
  if (!needsRetune(lev, st0)) {
    console.log('keep L' + lev, st0 && `start=${st0.startMoves} fr=${st0.fr} traps=${st0.traps} score=${st0.score}`);
    continue;
  }
  const size = sizeFor(lev);
  const target = Math.min(arrowsFor(lev), size * size - 1);
  let best = null, bestS = null;
  const tries = lev <= 30 ? 400 : 500;
  for (let k = 0; k < tries; k++) {
    const g = generateTight(size, target, mulberry32(lev * 9001 + k * 17 + 99), {
      maxMovable: lev <= 20 ? 3 : 4,
    });
    if (!g) continue;
    // Prefer not identical fingerprint
    const rows = rowsOf(g);
    if (rows.join('|') === parses[i].join('|')) continue;
    const st = trapStats(g);
    if (!st) continue;
    // Gates: want planning (start 2-3 preferred), traps, solid force
    if (st.startMoves > (lev <= 20 ? 3 : 4)) continue;
    if (st.fr < (lev <= 20 ? 0.4 : 0.35)) continue;
    // Prefer having traps when start>1
    const prefer =
      !bestS ||
      st.score > bestS.score ||
      (st.traps > bestS.traps && st.score >= bestS.score - 5);
    if (prefer) { best = rows; bestS = st; }
    // Good enough exit
    if (
      bestS.traps >= 1 &&
      bestS.startMoves >= 2 &&
      bestS.startMoves <= 3 &&
      bestS.fr >= (lev <= 20 ? 0.45 : 0.4) &&
      bestS.score >= (st0?.score || 0) + 5
    ) break;
  }
  if (best && bestS && (!st0 || bestS.score >= st0.score * 0.9)) {
    // Don't replace with worse trap-less linear if we failed to find traps —
    // unless current is weak
    const improve =
      (bestS.traps > (st0?.traps || 0)) ||
      (bestS.startMoves >= 2 && (st0?.startMoves === 1)) ||
      (bestS.fr > (st0?.fr || 0) + 0.05) ||
      (st0 && st0.fr < 0.42);
    if (improve || !st0) {
      parses[i] = best;
      retuned++;
      console.log('retune L' + lev, bestS, 'was', st0 && `start=${st0.startMoves} fr=${st0.fr} traps=${st0.traps}`);
      continue;
    }
  }
  console.log('keep-fail L' + lev, st0 && `start=${st0.startMoves} fr=${st0.fr} traps=${st0.traps} score=${st0.score}`);
}

let bad = 0;
parses.forEach((rows, i) => {
  if (!solvable(parseRows(rows))) { console.log('BAD', i + 1); bad++; }
});
console.log('bad', bad, 'retuned', retuned);

const body = parses
  .map((rows) => '  parse([' + rows.map((r) => "'" + r + "'").join(', ') + ']),')
  .join('\n');
const out = readFileSync(new URL('../client/src/levels.js', import.meta.url), 'utf8');
const replaced = out
  .replace(/Flechas de Azúcar — \d+ solvable levels[^\n]*/, `Flechas de Azúcar — ${parses.length} solvable levels (brutal curve)`)
  .replace(/export const LEVELS = \[[\s\S]*?\];/, 'export const LEVELS = [\n' + body + '\n];');
writeFileSync(new URL('../client/src/levels.js', import.meta.url), replaced);
console.log('wrote', parses.length);
