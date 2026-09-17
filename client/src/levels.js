/**
 * Flechas de Azúcar — 80 solvable levels (brutal curve)
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
  parse(['R.', '.L']),
  parse(['.U', 'D.']),
  parse(['R..', '.U.', '..L']),
  parse(['R.D', '..L', 'U..']),
  parse(['RD.', '..L', 'U..']),
  parse(['RRD', '..L', 'U..']),
  parse(['RDR', '.L.', 'U..']),
  parse(['.L.', 'DUL', 'RU.']),
  parse(['R...', 'ULL.', 'RRU.', 'U...']),
  parse(['R.D.', '.RDD', 'U..L', 'RU..']),
  parse(['RD..', 'LLL.', '.RU.', 'U..U']),
  parse(['DLD.', '..D.', '.UL.', 'R..U']),
  parse(['L.D.', 'UR.D', 'UUL.', 'U..L']),
  parse(['.DLR', '.RRU', 'RDU.', 'UD.L']),
  parse(['ULDL', 'DUL.', 'RU..', 'RRR.']),
  parse(['.DL.', 'D..L', '.RRD', 'R.UD']),
  parse(['D.L..', '...LL', '.D.LL', '.RU..', 'RRRRR']),
  parse(['..DRR', '..DU.', '.R.UD', '...UL', '.UL..']),
  parse(['R..D.', '.RU.D', 'U.L.D', 'R.U.D', '.U.LR']),
  parse(['..RRU', 'RRRR.', '.DULL', '..U..', '.RU..']),
  parse(['L.R.D', 'ULLLL', 'RR.DD', '..U..', '..UL.']),
  parse(['RRRR.', 'D...L', '.RRD.', 'LLLL.', 'RU...']),
  parse(['.LLLL', '..DLL', 'RR..U', '..R.D', 'LLLLL']),
  parse(['D.L..', '.D.LL', 'RRRDD', '..U.D', '.RU.R']),
  parse(['..D..', 'DLDR.', 'DURUD', 'DU.U.', 'DU.UL']),
  parse(['.D...', 'RD..D', 'UDL.D', '..U.D', 'LLUDD']),
  parse(['.R.DD', 'R.DDD', '..D.D', '.UL.D', 'DLLLR']),
  parse(['RRR..', '.R..D', 'RRD..', 'U..LL', '.URRR']),
  parse(['......', '..RD..', '.D.L..', '..U.LL', 'RRRRR.', '.RRRRD']),
  parse(['R....D', '..DL..', 'UULLL.', 'RR.U..', '..R.U.', 'DLLLLL']),
  parse(['L..D..', 'UU.D..', '.U.D..', 'UU.LL.', 'RU..U.', 'UU.L..']),
  parse(['...LLL', '...D.L', '..R.D.', 'RR...U', '..UL..', 'LLLLL.']),
  parse(['......', '.LLLLL', 'RRRD..', 'U...LL', '.DLL..', '.RRRRR']),
  parse(['..RD..', '...D.D', 'RR.DDD', '..U..D', '..U.L.', 'LLLL..']),
  parse(['D..L.R', 'RDRRRU', '.DD.LL', '.D.U..', 'DL.U..', '..RU..']),
  parse(['L.RDD.', 'U..D..', 'U..L..', 'RRU...', 'D.LLL.', 'R....U']),
  parse(['...LLL', 'D..L..', '.D..LL', '.RRU..', 'RRRRRD', 'DLLLLL']),
  parse(['D..L..', '.....L', '..D.LL', '..RU..', 'RRRRRD', 'DLLLLL']),
  parse(['R...DU', '..D.LU', '.R.DDU', 'U..LDU', '.U..DU', '.UR..U']),
  parse(['RRRRRR', '.D.L..', '..D.LL', 'U.RUD.', '.RRRDD', 'U...DL']),
  parse(['D.DL..', 'R.D..D', '.DDLLL', '.DDU..', 'DLDU..', 'D..U..']),
  parse(['D...DL', 'D.RDD.', 'DD.LD.', 'DRR.DU', 'D.U...', 'L.U...']),
  parse(['ULLLD.', 'LLLLL.', 'RRR.DD', '...UD.', '...U..', '...U.L']),
  parse(['U..DRD', 'ULLDUD', '.LUDU.', 'RRU.U.', 'U.UL..', '..U..L']),
  parse(['RRRRRR', '..RD..', '.D.DLL', '.RU...', 'RRRRRD', 'U..L.R']),
  parse(['..LLLL.', '..LLL.L', '....DL.', 'RRRD...', '...R.U.', 'D.LLL..', 'R.....U']),
  parse(['LLLLLLL', '...RD..', 'D...L..', 'RRR.DD.', '...U.D.', '...U...', '...U.RU']),
  parse(['.D..L..', '...D.LU', '...D..U', 'R.RDU.U', '.R...UU', 'DLLL..U', 'R.....U']),
  parse(['DL.RD..', 'DU..D..', 'DU..D..', 'DUD.L..', 'DU.U...', '.U.U...', '.ULU...']),
  parse(['ULLLD.L', '...LD..', 'D..LD..', 'RRRRDD.', '...U.D.', '...URRR', '...U.RU']),
  parse(['...LLLL', '.......', 'RRRRR.U', 'RRRR..D', '..DLLLL', '.......', '..RR...']),
  parse(['...D.RR', 'DL.D.U.', 'DU.DRU.', 'DURRU.D', '.U..ULL', '.UU....', '..UL...']),
  parse(['.RR....', '..R.D..', 'D..L...', '.RRU...', '..U..LL', 'RRRRRD.', '.U..LRR']),
  parse(['..LLL..', 'R.....D', '..D..LL', '.DDL...', '.DDUU..', 'UL.UU..', '..LUU..']),
  parse(['..DR..D', '.UD.D.L', '.UD.D..', 'DUDLL..', 'DUDU...', 'DULU...', 'DU.U...']),
  parse(['..R...D', '..R..DD', 'RR.D..D', '.D.LLLD', 'UD..L.D', '..ULU.D', 'LL..U.D']),
  parse(['..D.L.R', 'U.D...U', 'U.R..DU', 'U..DLLU', 'RR..U.U', 'DLLL..U', 'R.....U']),
  parse(['LLLLLLL', '.D.L...', '.RRRR.U', 'DD..LLL', '.D.U...', 'LL.U...', 'R..U...']),
  parse(['ULLL...', 'LLLLLL.', 'RR..D..', 'RRRU...', '....LLL', 'D.LLL..', 'R....U.']),
  parse(['LD...LU', 'URRRR.U', 'U.RR.U.', 'U.ULL..', 'U...ULL', 'URRRR.D', 'U.....L']),
  parse(['D.....L', '.RRRRRU', '.....LL', '..DLLLL', 'RRRRRD.', '.URRRDD', '.U...DL']),
  parse(['R.....D', '....DLL', 'U..LDD.', 'RRRU.D.', 'D..LLD.', 'RRRRR.D', '..R...D']),
  parse(['ULLLLL.', 'D.....L', 'RRDRR..', '..DRD..', '...U.U.', 'DLLUR.U', 'D..U...']),
  parse(['D..LDRR', '....DU.', '.R...UD', '.UUULUD', '..UU.UL', 'RRU..U.', '..UU...']),
  parse(['LLD..L.', 'R.D.D.D', '.UD.D.D', 'UUDLD.D', '.U.U..D', '.U.U.UD', '.ULURU.']),
  parse(['D....LR', 'D..RD.U', 'DD..L.U', 'DRR.DUU', 'DD.UD.U', 'D..URRD', 'L..U..D']),
  parse(['.......', '.R....D', '.U.LLL.', 'RRRR.U.', 'D.LLLLL', '.LLLLLL', 'DLLLLLL']),
  parse(['.DLD...', '.D.DR.D', '..UDU..', '..URU..', 'U.U..LL', 'RRRRRRR', '.RRRRRD']),
  parse(['L..D..U', 'UD.D..U', 'UDUD..U', 'UDD.LLU', 'UD.R.U.', 'UD...LL', 'LLR...U']),
  parse(['D.....L', 'RRRRRRR', '.RRRR.U', '.U.LLLL', '..DLLLL', '..RRRRD', '..LLLLL']),
  parse(['...DUDU', '.U.DUDU', '.ULDUDU', 'RRR.UDU', 'U..LUD.', '....URD', '....U.D']),
  parse(['LR..D.U', 'U.RDDRU', 'U..DDU.', 'U..D.U.', 'U.U..LL', 'UU.LR.D', 'U..LL.R']),
  parse(['DLDL..R', 'DUD..DU', 'DUR.DDU', 'DU..LDU', 'D..U.DU', 'D..U.DU', 'D..U.RU']),
  parse(['..DLD.U', 'DLD.D.U', 'DUD.D.U', 'DUR.DDU', '.U.U.DU', '.U.URDU', '.U.U.RU']),
  parse(['RRRRRRR', 'RRRRR..', 'D....LL', 'RRRR..D', 'D..LLLL', 'RRRRR.D', 'DLLLLLL']),
  parse(['UL.D..U', 'UU.D.UU', 'UU.DRUU', 'UUR.UUD', 'UUU.LL.', 'UU.R.U.', 'UU....L']),
  parse(['RRRRRRU', 'U.LLLL.', 'RRRRRU.', 'U..LLLL', 'RRRR..D', '.DLLLLL', '.RRRR..']),
  parse(['R...D.R', 'LLDLD.U', '.UD.D.U', '.UDUD.U', '.UDU.UU', 'UULURUU', '.U.U.U.']),
  parse(['R.DU..D', '..DU.DL', '..D.DL.', '.DDLDD.', '.DDURDD', 'UL.U.DD', 'LLLU.DR']),
  parse(['.D.LRRU', 'D....LL', 'LRRRR.U', '..DULLL', '..RURRR', 'RRRRRRD', 'LLLLLLL']),
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
