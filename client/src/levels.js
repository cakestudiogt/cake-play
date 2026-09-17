/**
 * Flechas de Azúcar — 45 solvable levels
 * Rule: tap an arrow only when its path to the edge is clear; it slides into the frosting portal.
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
  parse(['R.', '.L']),
  parse(['.U', 'D.']),
  parse(['R..', '.U.', '..L']),
  parse(['U.D', '...', '...']),
  parse(['R..', '...', '..L']),
  parse(['..R', 'U.D', 'L..']),
  parse(['.L', '.L']),
  parse(['.U', '.D']),
  parse(['..R', 'U..', '..L']),
  parse(['DR.', 'D..', '...']),
  parse(['..D', '.L.', 'U..']),
  parse(['U.D', '..D', 'L..']),
  parse(['R..', 'D..', '.UL']),
  parse(['.UU', '...', 'RRD']),
  parse(['.D.', 'L.U', '.DR']),
  parse(['....', '..R.', '.L.L', '..LD']),
  parse(['..UD', '...D', '...D', '.R..']),
  parse(['R.R.', '...D', '.U..', '.L.D']),
  parse(['..UD', '...D', '...R', '.U.R']),
  parse(['....', '.U..', 'LL..', 'LLU.']),
  parse(['U.U.', 'LR.U', 'RR..', 'R...']),
  parse(['....', 'LU.U', 'LUL.', '..LL']),
  parse(['.U.D', 'LRD.', 'DR..', '...R']),
  parse(['.UUU', 'U..R', '.LU.', 'LR.D']),
  parse(['DRU.', '.DL.', 'LR.R', '..DR']),
  parse(['.U.R.', 'D.R..', '.....', '..LLD', '..U..']),
  parse(['.U..L', '.LLR.', 'U..D.', 'L....', '.....']),
  parse(['R....', 'R.U..', '..LU.', 'DULR.', '....R']),
  parse(['LRUR.', '..L.D', '.....', 'L.DDD', '.....']),
  parse(['...L.', '.D..D', 'L..RD', '..LR.', '..DR.']),
  parse(['D....', '.LUDU', 'LLULR', '.....', 'D...R']),
  parse(['..R.U', 'LL.DL', 'L...L', '.LL..', 'L...D']),
  parse(['.URU.', 'L..UD', '...DD', '..DD.', 'DU...']),
  parse(['..RRU', 'UU..L', 'LDRRR', '.D...', 'L...R']),
  parse(['..L.R', 'LU.RR', 'D...R', '.LD.R', 'L..RD']),
  parse(['..U...', 'U..D.D', '....L.', '.L....', '.....L', 'D..DD.']),
  parse(['......', '..U...', '.R.U..', '.LDD.R', 'D..L..', '..L...']),
  parse(['..D.LL', '...L.L', 'L..U.R', '.U....', '...U..', 'L....D']),
  parse(['.R...U', 'U.D...', 'DD..U.', '...R..', '.D.R..', '.L..R.']),
  parse(['DL.U..', 'L....R', '....R.', '..UUR.', '..L.U.', '.LL.D.']),
  parse(['.U...R', 'L.UDLU', '....LD', '....L.', '.UD...', 'D...D.']),
  parse(['U.D.U.', 'L..LR.', '.U...U', '.L.LR.', '.....R', 'D..RRR']),
  parse(['...D..', '.U..UU', '..U.R.', '.UUR.R', '.DD...', '..LDDL']),
  parse(['UUL.UU', 'LU....', '..RU..', '..L.L.', 'L..R.R', 'LUDU..']),
  parse(['.UDU..', '.U..DR', '.R.R..', '.L...L', 'D..UDR', 'LD..DL']),
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
