/**
 * Generate MUCH harder Flechas de Azúcar levels via reverse construction.
 * Hardness = forced-move depth + low branching + long blocking chains.
 * Expand to 80; L1–3 tutorial only; from L4 require planning.
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

function isSolvableDFS(grid, nodeLimit = 250000) {
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

/** Walk min-branching path; count forced steps + chain depth. */
function hardnessStats(grid) {
  const arrows = countArrows(grid);
  if (arrows === 0) return null;
  const startMoves = listMovable(grid).length;

  let tightForced = 0;
  let tightBranchSum = 0;
  let tightSteps = 0;
  let maxRun = 0;
  let run = 0;
  let decoyPeak = 0; // arrows - legal at any step
  let g = clone(grid);
  const walkSeen = new Set();
  const key = (gg) => gg.map((row) => row.map((c) => c || '.').join('')).join('|');

  while (countArrows(g) > 0) {
    const moves = listMovable(g);
    if (!moves.length) break;
    const remaining = countArrows(g);
    decoyPeak = Math.max(decoyPeak, remaining - moves.length);
    tightBranchSum += moves.length;
    tightSteps++;
    if (moves.length === 1) {
      tightForced++;
      run++;
      maxRun = Math.max(maxRun, run);
    } else {
      run = 0;
    }
    let best = moves[0];
    let bestScore = Infinity;
    for (const [r, c] of moves) {
      const next = clone(g);
      next[r][c] = null;
      const m = listMovable(next).length;
      // Prefer leaving fewer options; slight preference for unlocking chains
      if (m < bestScore) {
        bestScore = m;
        best = [r, c];
      }
    }
    const k = key(g) + best.join(',');
    if (walkSeen.has(k)) break;
    walkSeen.add(k);
    g[best[0]][best[1]] = null;
  }
  const cleared = countArrows(g) === 0;
  const tightAvg = tightSteps ? tightBranchSum / tightSteps : 99;
  const forceRatio = arrows ? tightForced / arrows : 0;

  // Aggressive hardness: forced depth + decoys + low branching dominate
  const score =
    tightForced * 4.5 +
    forceRatio * 28 +
    maxRun * 3.5 +
    decoyPeak * 1.8 +
    (3.2 - Math.min(tightAvg, 3.2)) * 10 +
    Math.max(0, arrows - startMoves) * 1.6 +
    arrows * 0.9 +
    (startMoves <= 1 ? 8 : startMoves <= 2 ? 4 : startMoves <= 3 ? 1 : -startMoves * 1.5) +
    (cleared ? 0 : -80);

  return {
    arrows,
    startMoves,
    forced: tightForced,
    forceRatio: +forceRatio.toFixed(3),
    tightAvg: +tightAvg.toFixed(2),
    maxRun,
    decoyPeak,
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
 * Reverse-place with strong bias to keep movable count low (forced chains).
 * opts.keepTight: probability of rejecting placements that raise movable count.
 */
function generateOne(size, target, rng, opts = {}) {
  const g = empty(size);
  const maxAttempts = opts.maxAttempts || 12000;
  let placed = 0;
  let attempts = 0;
  const keepTight = opts.keepTight ?? 0.85;
  const maxMovable = opts.maxMovable ?? 2;

  while (placed < target && attempts < maxAttempts) {
    attempts++;
    const cells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!g[r][c]) cells.push([r, c]);
      }
    }
    if (!cells.length) break;

    for (let i = cells.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    const preferCenter = opts.preferCenter || 0;
    if (preferCenter > 0) {
      cells.sort((a, b) => {
        const ca = Math.abs(a[0] - (size - 1) / 2) + Math.abs(a[1] - (size - 1) / 2);
        const cb = Math.abs(b[0] - (size - 1) / 2) + Math.abs(b[1] - (size - 1) / 2);
        return ca - cb + (rng() - 0.5) * preferCenter;
      });
    }

    // Prefer cells that sit ON an existing movable arrow's path (block it)
    const movableBefore = listMovable(g);
    if (movableBefore.length && rng() < (opts.blockBias ?? 0.7)) {
      const blockTargets = [];
      for (const [mr, mc] of movableBefore) {
        const dir = g[mr][mc];
        const [dr, dc] = DELTA[dir];
        let nr = mr + dr,
          nc = mc + dc;
        while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (!g[nr][nc]) blockTargets.push([nr, nc, mr, mc]);
          nr += dr;
          nc += dc;
        }
      }
      if (blockTargets.length) {
        // Put block-path cells first
        for (let i = blockTargets.length - 1; i > 0; i--) {
          const j = (rng() * (i + 1)) | 0;
          [blockTargets[i], blockTargets[j]] = [blockTargets[j], blockTargets[i]];
        }
        const front = blockTargets.slice(0, Math.min(8, blockTargets.length)).map((t) => [t[0], t[1]]);
        const rest = cells.filter(([r, c]) => !front.some(([fr, fc]) => fr === r && fc === c));
        cells.length = 0;
        cells.push(...front, ...rest);
      }
    }

    let placedThis = false;
    const tryN = Math.min(cells.length, opts.cellTries || 18);
    const candidates = [];

    for (let i = 0; i < tryN; i++) {
      const [r, c] = cells[i];
      const valid = DIRS.filter((d) => pathClear(g, r, c, d));
      if (!valid.length) continue;

      for (const d of valid) {
        g[r][c] = d;
        let blocked = 0;
        for (const [mr, mc] of movableBefore) {
          if (!pathClear(g, mr, mc)) blocked++;
        }
        const mv = listMovable(g).length;
        // Path depth into board
        const [dr, dc] = DELTA[d];
        let depth = 0;
        let nr = r + dr,
          nc = c + dc;
        while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          depth++;
          nr += dr;
          nc += dc;
        }
        // Score: block more, keep movable low, longer paths
        const score =
          blocked * 12 +
          (mv <= 1 ? 10 : mv <= 2 ? 5 : mv <= 3 ? 0 : -mv * 4) +
          depth * 0.35 +
          rng() * (opts.noise ?? 0.4);
        candidates.push({ r, c, d, score, mv, blocked });
        g[r][c] = null;
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    for (const cand of candidates) {
      g[cand.r][cand.c] = cand.d;
      const mv = listMovable(g).length;
      // After a few arrows, refuse exploding branching
      if (placed >= 2 && mv > maxMovable && rng() < keepTight) {
        g[cand.r][cand.c] = null;
        continue;
      }
      // Soft ceiling on start moves late in fill
      if (
        opts.minStartCeiling != null &&
        placed > target * 0.4 &&
        mv > opts.minStartCeiling &&
        rng() < 0.85
      ) {
        g[cand.r][cand.c] = null;
        continue;
      }
      placed++;
      placedThis = true;
      break;
    }

    if (!placedThis) {
      // Fallback: any valid placement
      for (const [r, c] of cells) {
        const valid = DIRS.filter((d) => pathClear(g, r, c, d));
        if (valid.length) {
          // Prefer dir that blocks most
          let best = valid[0],
            bs = -1;
          for (const d of valid) {
            g[r][c] = d;
            let blocked = 0;
            for (const [mr, mc] of movableBefore) {
              if (!pathClear(g, mr, mc)) blocked++;
            }
            if (blocked > bs) {
              bs = blocked;
              best = d;
            }
            g[r][c] = null;
          }
          g[r][c] = best;
          placed++;
          placedThis = true;
          break;
        }
      }
      if (!placedThis) break;
    }
  }

  if (countArrows(g) < Math.floor(target * 0.9)) return null;
  if (!isSolvableDFS(g)) return null;
  return g;
}

/**
 * Chain-seeded generator: start with one edge-clear arrow, then repeatedly
 * place a blocker on its path (builds long forced sequences).
 */
function generateChain(size, target, rng, opts = {}) {
  const g = empty(size);
  // Seed near edge pointing out
  const seeds = [];
  for (let i = 0; i < size; i++) {
    seeds.push([0, i, 'U'], [size - 1, i, 'D'], [i, 0, 'L'], [i, size - 1, 'R']);
  }
  const seed = seeds[(rng() * seeds.length) | 0];
  g[seed[0]][seed[1]] = seed[2];
  let placed = 1;

  while (placed < target) {
    const movable = listMovable(g);
    if (!movable.length) break;

    // Pick a movable arrow and place something on its path
    const [mr, mc] = movable[(rng() * movable.length) | 0];
    const dir = g[mr][mc];
    const [dr, dc] = DELTA[dir];
    const pathCells = [];
    let nr = mr + dr,
      nc = mc + dc;
    while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      if (!g[nr][nc]) pathCells.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
    if (!pathCells.length) {
      // Can't extend this chain — place elsewhere preferring blocks
      const extra = generateOne(size, placed + 1, rng, {
        ...opts,
        maxAttempts: 2000,
        keepTight: 0.95,
        maxMovable: opts.maxMovable ?? 2,
      });
      // merge? too messy — just break and fill remaining with generateOne from current
      break;
    }

    const [r, c] = pathCells[(rng() * pathCells.length) | 0];
    // Choose a direction that is currently clear; prefer dirs that don't open too many moves
    const valid = DIRS.filter((d) => pathClear(g, r, c, d));
    if (!valid.length) continue;

    let best = null,
      bestS = -1e9;
    for (const d of valid) {
      g[r][c] = d;
      const mv = listMovable(g).length;
      let blocked = 0;
      for (const [a, b] of movable) {
        if (!pathClear(g, a, b)) blocked++;
      }
      const sc = blocked * 15 + (mv <= 1 ? 12 : mv <= 2 ? 4 : -mv * 5) + rng();
      if (sc > bestS) {
        bestS = sc;
        best = d;
      }
      g[r][c] = null;
    }
    if (best == null) continue;
    g[r][c] = best;
    // Reject if branching exploded
    if (listMovable(g).length > (opts.maxMovable ?? 2) + 1 && rng() < 0.8) {
      g[r][c] = null;
      continue;
    }
    placed++;
  }

  // Fill remaining with tight generateOne-style from current state
  let attempts = 0;
  while (placed < target && attempts < 8000) {
    attempts++;
    const cells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!g[r][c]) cells.push([r, c]);
      }
    }
    for (let i = cells.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const movableBefore = listMovable(g);
    let done = false;
    for (const [r, c] of cells.slice(0, 20)) {
      const valid = DIRS.filter((d) => pathClear(g, r, c, d));
      if (!valid.length) continue;
      let best = null,
        bs = -1e9;
      for (const d of valid) {
        g[r][c] = d;
        let blocked = 0;
        for (const [mr, mc] of movableBefore) {
          if (!pathClear(g, mr, mc)) blocked++;
        }
        const mv = listMovable(g).length;
        const sc = blocked * 14 + (mv <= 1 ? 10 : mv <= 2 ? 3 : -mv * 4) + rng();
        if (sc > bs) {
          bs = sc;
          best = d;
        }
        g[r][c] = null;
      }
      if (best == null) continue;
      g[r][c] = best;
      if (listMovable(g).length > (opts.maxMovable ?? 2) && rng() < 0.9) {
        g[r][c] = null;
        continue;
      }
      placed++;
      done = true;
      break;
    }
    if (!done) break;
  }

  if (countArrows(g) < Math.floor(target * 0.85)) return null;
  if (!isSolvableDFS(g)) return null;
  return g;
}

function gridToRows(g) {
  return g.map((row) => row.map((c) => c || '.').join(''));
}

/** Curriculum — aggressive curve; 5-boards early; expand to 80. */
function targetsFor(level) {
  const spike =
    level % 5 === 0 ||
    level === 8 ||
    level === 11 ||
    level === 14 ||
    level === 17 ||
    level === 19 ||
    level === 23 ||
    level === 27 ||
    level === 33 ||
    level === 37 ||
    level === 44 ||
    level === 52 ||
    level === 61 ||
    level === 70 ||
    level === 77;

  // L1–3 handled by HAND
  if (level <= 5)
    return {
      size: 3,
      arrows: 4 + (spike ? 1 : 0),
      minScore: 18,
      preferCenter: 0.8,
      noise: 0.5,
      spike,
      minStartCeiling: 2,
      maxMovable: 2,
      keepTight: 0.9,
      blockBias: 0.75,
      minForce: 0.45,
      maxStart: 2,
    };
  if (level <= 8)
    return {
      size: 3,
      arrows: 6,
      minScore: 28,
      preferCenter: 1.2,
      noise: 0.4,
      spike,
      minStartCeiling: 2,
      maxMovable: 2,
      keepTight: 0.92,
      blockBias: 0.8,
      minForce: 0.55,
      maxStart: 2,
    };
  if (level <= 12)
    return {
      size: 4,
      arrows: 8 + (spike ? 1 : 0),
      minScore: 36,
      preferCenter: 1.5,
      noise: 0.35,
      spike,
      minStartCeiling: 2,
      maxMovable: 2,
      keepTight: 0.93,
      blockBias: 0.85,
      minForce: 0.5,
      maxStart: 2,
    };
  if (level <= 16)
    return {
      size: 4,
      arrows: 10 + (spike ? 2 : 0),
      minScore: 44,
      preferCenter: 1.8,
      noise: 0.3,
      spike,
      minStartCeiling: 2,
      maxMovable: 2,
      keepTight: 0.94,
      blockBias: 0.85,
      minForce: 0.5,
      maxStart: 2,
    };
  if (level <= 20)
    return {
      size: 5,
      arrows: 12 + (spike ? 2 : 0),
      minScore: 52,
      preferCenter: 2,
      noise: 0.28,
      spike,
      minStartCeiling: 2,
      maxMovable: 2,
      keepTight: 0.94,
      blockBias: 0.88,
      minForce: 0.48,
      maxStart: 3,
    };
  if (level <= 28)
    return {
      size: 5,
      arrows: 15 + (spike ? 2 : 0),
      minScore: 60,
      preferCenter: 2.3,
      noise: 0.25,
      spike,
      minStartCeiling: 3,
      maxMovable: 2,
      keepTight: 0.95,
      blockBias: 0.9,
      minForce: 0.45,
      maxStart: 3,
    };
  if (level <= 36)
    return {
      size: 6,
      arrows: 17 + (spike ? 3 : 0),
      minScore: 68,
      preferCenter: 2.6,
      noise: 0.22,
      spike,
      minStartCeiling: 3,
      maxMovable: 3,
      keepTight: 0.94,
      blockBias: 0.9,
      minForce: 0.42,
      maxStart: 3,
    };
  if (level <= 45)
    return {
      size: 6,
      arrows: 20 + (spike ? 3 : 0),
      minScore: 76,
      preferCenter: 2.8,
      noise: 0.2,
      spike,
      minStartCeiling: 3,
      maxMovable: 3,
      keepTight: 0.95,
      blockBias: 0.9,
      minForce: 0.4,
      maxStart: 3,
    };
  if (level <= 55)
    return {
      size: 7,
      arrows: 22 + (spike ? 4 : 0),
      minScore: 82,
      preferCenter: 3,
      noise: 0.18,
      spike,
      minStartCeiling: 3,
      maxMovable: 3,
      keepTight: 0.95,
      blockBias: 0.92,
      minForce: 0.38,
      maxStart: 4,
    };
  if (level <= 65)
    return {
      size: 7,
      arrows: 26 + (spike ? 4 : 0),
      minScore: 90,
      preferCenter: 3.2,
      noise: 0.15,
      spike,
      minStartCeiling: 4,
      maxMovable: 3,
      keepTight: 0.95,
      blockBias: 0.92,
      minForce: 0.36,
      maxStart: 4,
    };
  if (level <= 72)
    return {
      size: 7,
      arrows: 30 + (spike ? 4 : 0),
      minScore: 98,
      preferCenter: 3.4,
      noise: 0.12,
      spike,
      minStartCeiling: 4,
      maxMovable: 3,
      keepTight: 0.96,
      blockBias: 0.93,
      minForce: 0.35,
      maxStart: 4,
    };
  return {
    size: 7,
    arrows: 33 + (spike ? 5 : 0),
    minScore: 105,
    preferCenter: 3.5,
    noise: 0.1,
    spike,
    minStartCeiling: 4,
    maxMovable: 3,
    keepTight: 0.96,
    blockBias: 0.93,
    minForce: 0.34,
    maxStart: 4,
  };
}

function meetsGates(stats, t, level) {
  if (!stats || !stats.solvable) return false;
  if (stats.startMoves < 1) return false;
  if (t.maxStart != null && stats.startMoves > t.maxStart) return false;
  if (t.minForce != null && stats.forceRatio < t.minForce * 0.7) return false; // soft during search
  return true;
}

function main() {
  const TOTAL = 80;
  const levels = [];
  const fingerprints = new Set();
  const report = [];

  // Validate & use hand fixed (trim to what we need — replace HAND_FIXED broken ones)
  // L1–3 tutorial (multi-clear); L4–7 forced-order teach
  const handUse = [
    ['R.', '.L'],
    ['.U', 'D.'],
    ['R..', '.U.', '..L'],
    ['R.D', '..L', 'U..'], // L4: only L legal first — full force chain
    ['RD.', '..L', 'U..'], // L5: start≤2, high force
    ['RRD', '..L', 'U..'], // L6: single legal opener, fr=1
    ['RDR', '.L.', 'U..'], // L7: dense 3x3 planning
  ];

  for (let i = 0; i < handUse.length; i++) {
    const rows = handUse[i];
    const g = rows.map((row) => [...row].map((ch) => (ch === '.' ? null : ch)));
    if (!isSolvableDFS(g)) {
      console.error('HAND unsolvable L' + (i + 1), rows);
      throw new Error('bad hand');
    }
    const st = hardnessStats(g);
    console.log(
      `L${String(i + 1).padStart(2)} HAND ${g.length}x arrows=${st.arrows} start=${st.startMoves} forced=${st.forced} fr=${st.forceRatio} avgB=${st.tightAvg} score=${st.score}`
    );
    fingerprints.add(rows.join('|'));
    levels.push(rows);
    report.push({ level: i + 1, ...st, size: g.length, spike: false, hand: true });
  }

  for (let level = levels.length + 1; level <= TOTAL; level++) {
    const t = targetsFor(level);
    const wantArrows = Math.min(t.arrows, t.size * t.size - 1);
    let best = null;
    let bestStats = null;
    const tries = level <= 20 ? 220 : level <= 40 ? 280 : level <= 60 ? 320 : 360;

    for (let i = 0; i < tries; i++) {
      const rng = mulberry32((level * 10007 + i * 9973 + 4242) >>> 0);
      const useChain = i % 3 !== 2; // 2/3 chain-seeded
      const g = useChain
        ? generateChain(t.size, wantArrows, rng, {
            preferCenter: t.preferCenter,
            minStartCeiling: t.minStartCeiling,
            noise: t.noise,
            maxMovable: t.maxMovable,
            keepTight: t.keepTight,
            blockBias: t.blockBias,
          })
        : generateOne(t.size, wantArrows, rng, {
            preferCenter: t.preferCenter,
            minStartCeiling: t.minStartCeiling,
            noise: t.noise,
            maxMovable: t.maxMovable,
            keepTight: t.keepTight,
            blockBias: t.blockBias,
            cellTries: 20,
          });
      if (!g) continue;
      const rows = gridToRows(g);
      const fp = rows.join('|');
      if (fingerprints.has(fp)) continue;
      const stats = hardnessStats(g);
      if (!meetsGates(stats, t, level)) continue;

      // Prefer higher score; require improving force when close
      if (
        !bestStats ||
        stats.score > bestStats.score ||
        (stats.score >= bestStats.score - 2 && stats.forceRatio > bestStats.forceRatio)
      ) {
        best = rows;
        bestStats = stats;
      }

      const threshold = t.spike ? t.minScore + 10 : t.minScore;
      const forceOk = stats.forceRatio >= (t.spike ? t.minForce + 0.05 : t.minForce);
      const startOk = stats.startMoves <= (t.spike ? Math.min(2, t.maxStart) : t.maxStart);
      if (bestStats.score >= threshold && forceOk && startOk) break;
    }

    // Relaxed fallback
    if (!best || bestStats.forceRatio < t.minForce * 0.5) {
      for (let i = 0; i < 400 && (!best || bestStats.score < t.minScore * 0.6); i++) {
        const rng = mulberry32((level * 7777 + i * 131) >>> 0);
        const g = generateChain(t.size, Math.max(4, wantArrows - 2), rng, {
          preferCenter: t.preferCenter * 0.7,
          noise: 0.8,
          maxMovable: t.maxMovable + 1,
          keepTight: 0.8,
          blockBias: 0.7,
        });
        if (!g) continue;
        const rows = gridToRows(g);
        if (fingerprints.has(rows.join('|'))) continue;
        const stats = hardnessStats(g);
        if (!stats || !stats.solvable) continue;
        if (!bestStats || stats.score > bestStats.score) {
          best = rows;
          bestStats = stats;
        }
      }
    }

    if (!best) throw new Error('Failed to gen level ' + level);
    fingerprints.add(best.join('|'));
    levels.push(best);
    report.push({ level, ...bestStats, size: t.size, spike: t.spike, hand: false });
    const tag = t.spike ? ' SPIKE' : '';
    console.log(
      `L${String(level).padStart(2)} ${t.size}x${t.size} arrows=${bestStats.arrows} start=${bestStats.startMoves} forced=${bestStats.forced} fr=${bestStats.forceRatio} avgB=${bestStats.tightAvg} maxRun=${bestStats.maxRun} score=${bestStats.score}${tag}`
    );
  }

  // Emit levels.js
  const body = levels
    .map((rows) => `  parse([${rows.map((r) => `'${r}'`).join(', ')}]),`)
    .join('\n');

  const out = `/**
 * Flechas de Azúcar — ${TOTAL} solvable levels (brutal curve)
 * Rule: tap an arrow only when its path to the edge is clear; it slides into the frosting portal.
 * Order matters: arrows block each other — plan the sequence.
 * Generated for high forced-move depth; L1–3 tutorial; all DFS-validated.
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
  console.log(`\nWrote ${TOTAL} levels to client/src/levels.js`);

  // Band summary
  const bands = [
    [1, 5],
    [6, 15],
    [16, 30],
    [31, 50],
    [51, 80],
  ];
  for (const [a, b] of bands) {
    const slice = report.filter((x) => x.level >= a && x.level <= b);
    const avgA = (slice.reduce((s, x) => s + x.arrows, 0) / slice.length).toFixed(1);
    const avgF = (slice.reduce((s, x) => s + x.forced, 0) / slice.length).toFixed(1);
    const avgFr = (slice.reduce((s, x) => s + x.forceRatio, 0) / slice.length).toFixed(2);
    const avgB = (slice.reduce((s, x) => s + x.tightAvg, 0) / slice.length).toFixed(2);
    const avgS = (slice.reduce((s, x) => s + x.startMoves, 0) / slice.length).toFixed(1);
    console.log(
      `BAND ${a}-${b}: n=${slice.length} avgArrows=${avgA} avgForced=${avgF} forceRatio=${avgFr} avgBranch=${avgB} avgStart=${avgS}`
    );
  }
}

main();
