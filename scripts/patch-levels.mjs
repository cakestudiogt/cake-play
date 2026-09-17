import { readFileSync, writeFileSync } from 'fs';
import { LEVELS } from '../client/src/levels.js';

const DIRS = ['U', 'D', 'L', 'R'];
const DELTA = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
function clone(g) { return g.map((r) => r.slice()); }
function empty(s) { return Array.from({ length: s }, () => Array(s).fill(null)); }
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
function solvable(grid) {
  const key = (g) => g.map((row) => row.map((c) => c || '.').join('')).join('|');
  const seen = new Set();
  function dfs(g) {
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
function gen(size, target, rng) {
  const g = empty(size);
  let placed = 0, att = 0;
  while (placed < target && att < 8000) {
    att++;
    const cells = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!g[r][c]) cells.push([r, c]);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    let done = false;
    for (const [r, c] of cells.slice(0, 14)) {
      const valid = DIRS.filter((d) => pathClear(g, r, c, d));
      if (!valid.length) continue;
      const before = listM(g);
      let best = null, bestS = -1;
      for (const d of valid) {
        g[r][c] = d;
        let blocked = 0;
        for (const [mr, mc] of before) if (!pathClear(g, mr, mc)) blocked++;
        const sc = blocked * 5 + rng();
        if (sc > bestS) { bestS = sc; best = d; }
        g[r][c] = null;
      }
      if (best != null) {
        g[r][c] = best;
        if (placed > 2 && listM(g).length > 2 && rng() < 0.75) { g[r][c] = null; continue; }
        placed++;
        done = true;
        break;
      }
    }
    if (!done) {
      for (const [r, c] of cells) {
        const v = DIRS.filter((d) => pathClear(g, r, c, d));
        if (v.length) { g[r][c] = v[(rng() * v.length) | 0]; placed++; break; }
      }
    }
  }
  if (count(g) < target || !solvable(g)) return null;
  return g;
}
function hard(g) {
  let gg = clone(g), forced = 0, sum = 0, steps = 0;
  while (count(gg) > 0) {
    const m = listM(gg);
    if (!m.length) return null;
    sum += m.length; steps++;
    if (m.length === 1) forced++;
    let best = m[0], bs = 1e9;
    for (const [r, c] of m) {
      const n = clone(gg); n[r][c] = null;
      const x = listM(n).length;
      if (x < bs) { bs = x; best = [r, c]; }
    }
    gg[best[0]][best[1]] = null;
  }
  const arrows = count(g), start = listM(g).length;
  return {
    arrows, start, forced, fr: forced / arrows, avg: sum / steps,
    score: arrows * 2 + (forced / arrows) * 25 + (3 - Math.min(sum / steps, 3)) * 8 + (arrows - start),
  };
}
function rowsOf(g) { return g.map((r) => r.map((c) => c || '.').join('')); }
function parseRows(rows) { return rows.map((row) => [...row].map((ch) => (ch === '.' ? null : ch))); }

const hand = {
  6: ['RRD', '..L', 'U..'],
  7: ['R..', 'ULD', '..D'],
  8: ['D.R', 'DL.', '..U'],
};

const parses = LEVELS.map((L) => L.grid.map((row) => row.map((c) => c || '.').join('')));

for (const [lev, rows] of Object.entries(hand)) {
  const g = parseRows(rows);
  const h = hard(g);
  console.log('hand L' + lev, 'ok=' + solvable(g), h);
  if (!solvable(g)) throw new Error('bad hand ' + lev);
  parses[Number(lev) - 1] = rows;
}

for (const lev of [9, 10, 11, 12, 40, 45]) {
  const i = lev - 1;
  const cur = parseRows(parses[i]);
  const h0 = hard(cur);
  if (h0 && h0.fr >= 0.35 && h0.start <= 3) {
    console.log('ok keep L' + lev, h0);
    continue;
  }
  const size = parses[i][0].length;
  const target = Math.max(count(cur), size === 4 ? 7 : size === 6 ? 18 : 6);
  let best = null, bestH = null;
  for (let k = 0; k < 300; k++) {
    const g = gen(size, target, mulberry32(lev * 5000 + k * 17));
    if (!g) continue;
    const h = hard(g);
    if (!h) continue;
    if (h.start > 3 && h.fr < 0.4) continue;
    if (!bestH || h.score > bestH.score) { best = rowsOf(g); bestH = h; }
    if (bestH.fr >= 0.4 && bestH.start <= 3) break;
  }
  if (best) {
    parses[i] = best;
    console.log('tight L' + lev, bestH);
  } else console.log('could not tight L' + lev, h0);
}

let bad = 0;
parses.forEach((rows, i) => {
  if (!solvable(parseRows(rows))) { console.log('BAD', i + 1); bad++; }
});
console.log('bad', bad);

const body = parses
  .map((rows) => '  parse([' + rows.map((r) => "'" + r + "'").join(', ') + ']),')
  .join('\n');
const out = readFileSync(new URL('../client/src/levels.js', import.meta.url), 'utf8');
const replaced = out.replace(/export const LEVELS = \[[\s\S]*?\];/, 'export const LEVELS = [\n' + body + '\n];');
writeFileSync(new URL('../client/src/levels.js', import.meta.url), replaced);
console.log('patched', parses.length);
