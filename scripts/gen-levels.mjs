/**
 * Generate harder Flechas de Azúcar levels via reverse construction.
 * Place an arrow only when its path to the edge is currently clear →
 * reverse of placement order is always a valid solution.
 *
 * Hardness = low branching / forced sequencing, not random density.
 */
import { writeFileSync } from 'fs';

const DIRS = ['U', 'D', 'L', 'R'];
const DELTA = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };

function empty(size) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function clone(g) {
  return g.map((r) => r.slice());
}

function countArrows(g) {
  let n = 0;
  for (const row of g) for (const c of row) if (c) n++;
  return n;
}

function pathClear(g, r, c, dir = g[r][c]) {
  if (!dir) return false;
  const [dr, dc] = DELTA[dir];
  let nr = r + dr,
    nc = c + dc;
  const n = g.length;
  while (nr >= 0 && nr < n && nc >= 0 && nc < n) {
    if (g[nr][nc]) return false;
    nr += dr;
    nc += dc;
  }
  return true;
}

function listMovable(g) {
  const out = [];
  const n = g.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (g[r][c] && pathClear(g, r, c)) out.push([r, c]);
    }
  }
  return out;
}

function isSolvableDFS(grid, nodeLimit = 200000) {
  const key = (g) => g.map((row) => row.map((c) => c || '.').join('')).join('|');
  const seen = new Set();
  let nodes = 0;
  function dfs(g) {
    if (++nodes > nodeLimit) return false;
    if (countArrows(g) === 0) return true;
    const k = key(g);
    if (seen.has(k)) return false;
    seen.add(k);
    for (const [r, c] of listMovable(g)) {
      const next = clone(g);
      next[r][c] = null;
      if (dfs(next)) return true;
    }
    return false;
  }
  return dfs(clone(grid));
}

/** Branching stats along the greedy-min-branching solution path + global. */
function hardnessStats(grid) {
  const arrows = countArrows(grid);
  if (arrows === 0) return null;
  let nodes = 0;
  let solutions = 0;
  let branchSum = 0;
  let branchSteps = 0;
  let minStart = listMovable(grid).length;
  let forcedSteps = 0; // steps where only 1 move
  let maxDepthExplored = 0;
  const key = (g) => g.map((row) => row.map((c) => c || '.').join('')).join('|');
  const seen = new Set();

  function dfs(g, depth) {
    if (++nodes > 80000) return;
    if (countArrows(g) === 0) {
      solutions++;
      return;
    }
    const k = key(g);
    if (seen.has(k)) return;
    seen.add(k);
    const moves = listMovable(g);
    branchSum += moves.length;
    branchSteps++;
    if (moves.length === 1) forcedSteps++;
    maxDepthExplored = Math.max(maxDepthExplored, depth);
    // explore moves sorted by how many they unlock? just all, stop early
    for (const [r, c] of moves) {
      const next = clone(g);
      next[r][c] = null;
      dfs(next, depth + 1);
      if (solutions > 12) return;
    }
  }
  dfs(clone(grid), 0);

  // Walk one solution preferring minimal branching to measure "tightness"
  let tightForced = 0;
  let tightBranchSum = 0;
  let tightSteps = 0;
  let g = clone(grid);
  const walkSeen = new Set();
  while (countArrows(g) > 0) {
    const moves = listMovable(g);
    if (!moves.length) break;
    tightBranchSum += moves.length;
    tightSteps++;
    if (moves.length === 1) tightForced++;
    // pick move that leaves fewest options next (look-ahead 1)
    let best = moves[0];
    let bestScore = Infinity;
    for (const [r, c] of moves) {
      const next = clone(g);
      next[r][c] = null;
      const m = listMovable(next).length;
      const score = m + (pathClear(g, r, c) ? 0 : 10);
      if (score < bestScore) {
        bestScore = score;
        best = [r, c];
      }
    }
    const k = key(g) + best.join(',');
    if (walkSeen.has(k)) break;
    walkSeen.add(k);
    g[best[0]][best[1]] = null;
  }
  const cleared = countArrows(g) === 0;

  const avgBranch = branchSteps ? branchSum / branchSteps : 99;
  const tightAvg = tightSteps ? tightBranchSum / tightSteps : 99;
  const forceRatio = arrows ? tightForced / arrows : 0;

  // Harder = more arrows, higher force ratio, lower avg branching, fewer solutions
  const solPenalty = solutions > 12 ? 12 : solutions;
  const score =
    arrows * 2.2 +
    forceRatio * 18 +
    (4 - Math.min(tightAvg, 4)) * 6 +
    (arrows - minStart) * 1.4 +
    (12 - solPenalty) * 0.35 +
    (cleared ? 0 : -50);

  return {
    arrows,
    startMoves: minStart,
    solutions: solutions > 12 ? 13 : solutions,
    avgBranch: +avgBranch.toFixed(2),
    tightAvg: +tightAvg.toFixed(2),
    forced: tightForced,
    forceRatio: +forceRatio.toFixed(2),
    score: +score.toFixed(2),
    solvable: cleared && isSolvableDFS(grid),
  };
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Reverse-place `target` arrows on size×size.
 * Bias: prefer placements that block many existing clear paths (creates dependencies).
 */
function generateOne(size, target, rng, opts = {}) {
  const g = empty(size);
  const maxAttempts = opts.maxAttempts || 8000;
  let placed = 0;
  let attempts = 0;

  while (placed < target && attempts < maxAttempts) {
    attempts++;
    // Candidate cells: empty
    const cells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!g[r][c]) cells.push([r, c]);
      }
    }
    if (!cells.length) break;

    // Shuffle cells
    for (let i = cells.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    // Prefer denser regions / center-ish for harder packs
    const preferCenter = opts.preferCenter || 0;
    if (preferCenter > 0) {
      cells.sort((a, b) => {
        const ca = Math.abs(a[0] - (size - 1) / 2) + Math.abs(a[1] - (size - 1) / 2);
        const cb = Math.abs(b[0] - (size - 1) / 2) + Math.abs(b[1] - (size - 1) / 2);
        return ca - cb + (rng() - 0.5) * preferCenter;
      });
    }

    let placedThis = false;
    const tryN = Math.min(cells.length, opts.cellTries || 12);
    for (let i = 0; i < tryN && !placedThis; i++) {
      const [r, c] = cells[i];
      // Valid dirs: path currently clear
      const valid = DIRS.filter((d) => pathClear(g, r, c, d));
      if (!valid.length) continue;

      // Score each dir by how many currently-movable arrows it would block
      let bestDir = null;
      let bestBlock = -1;
      const movableBefore = listMovable(g);
      for (const d of valid) {
        g[r][c] = d;
        let blocked = 0;
        for (const [mr, mc] of movableBefore) {
          if (!pathClear(g, mr, mc)) blocked++;
        }
        // Also prefer pointing "into" the board traffic
        const [dr, dc] = DELTA[d];
        let depth = 0;
        let nr = r + dr,
          nc = c + dc;
        while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          depth++;
          nr += dr;
          nc += dc;
        }
        const score = blocked * 3 + depth * 0.4 + rng() * opts.noise;
        if (score > bestBlock) {
          bestBlock = score;
          bestDir = d;
        }
        g[r][c] = null;
      }
      if (bestDir) {
        // Optionally reject if start moves would stay too high early in fill
        g[r][c] = bestDir;
        const mv = listMovable(g).length;
        const minStartWant = opts.minStartCeiling;
        if (minStartWant != null && placed > target * 0.5 && mv > minStartWant && rng() < 0.7) {
          g[r][c] = null;
          continue;
        }
        placed++;
        placedThis = true;
      }
    }
    if (!placedThis) {
      // fallback: place any valid
      for (const [r, c] of cells) {
        const valid = DIRS.filter((d) => pathClear(g, r, c, d));
        if (valid.length) {
          g[r][c] = valid[(rng() * valid.length) | 0];
          placed++;
          placedThis = true;
          break;
        }
      }
      if (!placedThis) break;
    }
  }

  if (countArrows(g) < target * 0.85) return null;
  if (!isSolvableDFS(g)) return null;
  return g;
}

function gridToRows(g) {
  return g.map((row) => row.map((c) => c || '.').join(''));
}

function rowsEqual(a, b) {
  return a.join('|') === b.join('|');
}

/** Curriculum targets per level index (1-based). */
function targetsFor(level) {
  // return { size, arrows, minScore, preferCenter, minStartCeiling, noise, spike }
  const spike = level % 7 === 0 || level === 20 || level === 33 || level === 45 || level === 55;
  if (level <= 2) return { size: 2, arrows: 2, minScore: 0, preferCenter: 0, noise: 1.5, spike: false };
  if (level <= 3) return { size: 3, arrows: 3, minScore: 4, preferCenter: 0, noise: 1.2, spike: false };
  if (level <= 5) return { size: 3, arrows: 4, minScore: 7, preferCenter: 0.5, noise: 1.0, spike: false, minStartCeiling: 2 };
  if (level <= 8) return { size: 3, arrows: 5 + (spike ? 1 : 0), minScore: 10, preferCenter: 1, noise: 0.9, spike, minStartCeiling: 2 };
  if (level <= 12) return { size: 4, arrows: 6 + (spike ? 2 : 0), minScore: 14, preferCenter: 1.2, noise: 0.8, spike, minStartCeiling: 2 };
  if (level <= 15) return { size: 4, arrows: 8 + (spike ? 2 : 0), minScore: 18, preferCenter: 1.5, noise: 0.7, spike, minStartCeiling: 2 };
  if (level <= 20) return { size: 4, arrows: 10 + (spike ? 2 : 0), minScore: 22, preferCenter: 1.8, noise: 0.6, spike, minStartCeiling: 3 };
  if (level <= 25) return { size: 5, arrows: 11 + (spike ? 2 : 0), minScore: 26, preferCenter: 2, noise: 0.55, spike, minStartCeiling: 3 };
  if (level <= 30) return { size: 5, arrows: 13 + (spike ? 2 : 0), minScore: 30, preferCenter: 2.2, noise: 0.5, spike, minStartCeiling: 3 };
  if (level <= 35) return { size: 5, arrows: 15 + (spike ? 2 : 0), minScore: 34, preferCenter: 2.4, noise: 0.45, spike, minStartCeiling: 3 };
  if (level <= 40) return { size: 6, arrows: 14 + (spike ? 3 : 0), minScore: 32, preferCenter: 2.5, noise: 0.4, spike, minStartCeiling: 4 };
  if (level <= 45) return { size: 6, arrows: 17 + (spike ? 3 : 0), minScore: 38, preferCenter: 2.8, noise: 0.35, spike, minStartCeiling: 4 };
  if (level <= 50) return { size: 6, arrows: 19 + (spike ? 3 : 0), minScore: 42, preferCenter: 3, noise: 0.3, spike, minStartCeiling: 4 };
  if (level <= 55) return { size: 7, arrows: 18 + (spike ? 4 : 0), minScore: 40, preferCenter: 3, noise: 0.3, spike, minStartCeiling: 4 };
  return { size: 7, arrows: 22 + (spike ? 4 : 0), minScore: 48, preferCenter: 3.2, noise: 0.25, spike, minStartCeiling: 5 };
}

// Hand-authored gentle intro (still with some order after L3)
const HAND = [
  // 1 teach tap clear path
  ['R.', '.L'],
  // 2 other dirs
  ['.U', 'D.'],
  // 3 3x3 intro — order starts to matter lightly
  ['R..', '.U.', '..L'],
  // 4 blocked until U clears? Actually U and D both clear
  ['R.L', '.U.', '...'],
  // 5 classic dependency: center U blocked by top? No - R then L
  ['.D.', 'R.L', '.U.'],
];

function main() {
  const TOTAL = 60;
  const levels = [];
  const fingerprints = new Set();

  for (const rows of HAND) {
    const fp = rows.join('|');
    fingerprints.add(fp);
    levels.push(rows);
  }

  for (let level = levels.length + 1; level <= TOTAL; level++) {
    const t = targetsFor(level);
    const wantArrows = Math.min(t.arrows, t.size * t.size - 1);
    let best = null;
    let bestStats = null;
    const tries = level <= 15 ? 80 : level <= 30 ? 120 : 160;
    for (let i = 0; i < tries; i++) {
      const rng = mulberry32((level * 10007 + i * 9973 + 42) >>> 0);
      const g = generateOne(t.size, wantArrows, rng, {
        preferCenter: t.preferCenter,
        minStartCeiling: t.minStartCeiling,
        noise: t.noise,
      });
      if (!g) continue;
      const rows = gridToRows(g);
      const fp = rows.join('|');
      if (fingerprints.has(fp)) continue;
      const stats = hardnessStats(g);
      if (!stats || !stats.solvable) continue;
      // Soft gates: early levels shouldn't be brutal
      if (level <= 5 && stats.startMoves < 1) continue;
      if (level <= 8 && stats.arrows > 6) continue;
      // Prefer meeting minScore; keep best
      if (!bestStats || stats.score > bestStats.score) {
        best = rows;
        bestStats = stats;
      }
      // Early exit if good enough and for spikes even better
      const threshold = t.spike ? t.minScore + 6 : t.minScore;
      if (bestStats.score >= threshold && bestStats.forceRatio >= (level <= 10 ? 0.15 : 0.25)) {
        break;
      }
    }
    if (!best) {
      // Fallback: relax and take any solvable
      for (let i = 0; i < 200 && !best; i++) {
        const rng = mulberry32((level * 777 + i * 13) >>> 0);
        const g = generateOne(t.size, Math.max(3, wantArrows - 2), rng, {
          preferCenter: t.preferCenter * 0.5,
          noise: 1.5,
        });
        if (!g) continue;
        const rows = gridToRows(g);
        if (fingerprints.has(rows.join('|'))) continue;
        if (!isSolvableDFS(g)) continue;
        best = rows;
        bestStats = hardnessStats(g);
      }
    }
    if (!best) throw new Error('Failed to gen level ' + level);
    fingerprints.add(best.join('|'));
    levels.push(best);
    const tag = t.spike ? ' SPIKE' : '';
    console.log(
      `L${String(level).padStart(2)} ${t.size}x${t.size} arrows=${bestStats.arrows} start=${bestStats.startMoves} forced=${bestStats.forced} avgB=${bestStats.tightAvg} sols=${bestStats.solutions} score=${bestStats.score}${tag}`
    );
  }

  // Emit levels.js
  const body = levels
    .map((rows) => `  parse([${rows.map((r) => `'${r}'`).join(', ')}]),`)
    .join('\n');

  const out = `/**
 * Flechas de Azúcar — ${TOTAL} solvable levels (harder curve)
 * Rule: tap an arrow only when its path to the edge is clear; it slides into the frosting portal.
 * Order matters: arrows block each other — plan the sequence.
 * Generated + hand-tuned intro; all validated solvable via DFS.
 */
function parse(rows) {
  const size = rows.length;
  const grid = rows.map((row) => {
    const cells = [...row];
    if (cells.length !== size) throw new Error('Bad row: ' + row);
    return cells.map((ch) => (ch === '.' ? null : ch));
  });
  return { size, grid };
}

export const LEVELS = [
${body}
];

export function cloneLevel(level) {
  return { size: level.size, grid: level.grid.map((row) => row.slice()) };
}

export function countArrows(grid) {
  let n = 0;
  for (const row of grid) for (const c of row) if (c) n++;
  return n;
}

const DELTA = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };

export function pathClear(grid, r, c) {
  const dir = grid[r][c];
  if (!dir) return false;
  const [dr, dc] = DELTA[dir];
  let nr = r + dr;
  let nc = c + dc;
  const n = grid.length;
  while (nr >= 0 && nr < n && nc >= 0 && nc < n) {
    if (grid[nr][nc]) return false;
    nr += dr;
    nc += dc;
  }
  return true;
}

export function listMovable(grid) {
  const out = [];
  const n = grid.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] && pathClear(grid, r, c)) out.push([r, c]);
    }
  }
  return out;
}

export function isSolvableDFS(grid) {
  const key = (g) => g.map((row) => row.map((c) => c || '.').join('')).join('|');
  const seen = new Set();
  function dfs(g) {
    if (countArrows(g) === 0) return true;
    const k = key(g);
    if (seen.has(k)) return false;
    seen.add(k);
    for (const [r, c] of listMovable(g)) {
      const next = g.map((row) => row.slice());
      next[r][c] = null;
      if (dfs(next)) return true;
    }
    return false;
  }
  return dfs(grid.map((row) => row.slice()));
}
`;

  writeFileSync(new URL('../client/src/levels.js', import.meta.url), out);
  console.log(`\\nWrote ${TOTAL} levels to client/src/levels.js`);
}

main();
