/**
 * Flechas de Azúcar — 60 solvable levels (harder curve)
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
  parse(['R.', '.L']),
  parse(['.U', 'D.']),
  parse(['R..', '.U.', '..L']),
  parse(['DR.', 'D..', '...']),
  parse(['R.D', '..D', 'L..']),
  parse(['RRD', '..L', 'U..']),
  parse(['R..', 'ULD', '..D']),
  parse(['D.R', 'DL.', '..U']),
  parse(['.R..', '.UD.', '.UD.', '..L.']),
  parse(['L...', 'D..L', '.U..', '.RRU']),
  parse(['.R.R', '.RUU', '..RU', '....']),
  parse(['....', '.DD.', '.LL.', '.LL.']),
  parse(['....', 'URDU', 'URRU', '....']),
  parse(['.RRU', '.RD.', '.UDU', '.LL.']),
  parse(['....', 'DRDD', '.UDD', '..R.']),
  parse(['.RR.', 'DRRD', 'DULD', '...L']),
  parse(['.R..', 'DLRU', 'DUUU', '.R..']),
  parse(['....', 'ULLD', 'UULD', 'DLL.']),
  parse(['.RR.', 'DRU.', 'LUU.', '.RR.']),
  parse(['LRR.', 'LDDD', 'UDL.', '.RR.']),
  parse(['.RR..', '.ULL.', '.URU.', '.DLR.', '.LRR.']),
  parse(['.....', '.LRRU', '.DLDU', '.RRDD', '.....']),
  parse(['.....', 'ULRR.', 'UDRD.', '.LLLU', '.....']),
  parse(['.....', '.LRRD', '.RDUD', '.DL..', '.LL..']),
  parse(['..L..', '..RR.', '.RDD.', 'ULRD.', '..LL.']),
  parse(['..LL.', '..RU.', 'DRDD.', 'DLLR.', '...L.']),
  parse(['.RRR.', 'UUUL.', 'UURUD', '..RR.', '.....']),
  parse(['.....', '.RRRU', 'DDLDD', 'DDLL.', '.RR.D']),
  parse(['.....', '.LLRD', '.URU.', '.DLRD', '.RRR.']),
  parse(['.....', '.DL.U', 'DLUDU', 'DLLD.', 'R.R..']),
  parse(['..R..', '..LU.', '.DRDD', '.LRRD', '.LLRD']),
  parse(['.....', '.LRDU', 'UURDU', 'ULU.D', '..RR.']),
  parse(['.....', 'DLRRU', 'DUUUU', 'DLRUD', '.LL..']),
  parse(['.LL..', '.ULU.', 'URDDU', '.DRRU', '..L..']),
  parse(['..R.U', 'UDLR.', 'UDDUU', 'DLRDU', 'R....']),
  parse(['......', '..LL..', '.DRRD.', '.DULD.', '..LLD.', '..R...']),
  parse(['......', '..DRR.', '.DDUL.', '.DDUD.', '.DRR..', '......']),
  parse(['......', '..RRR.', '.DDLDU', '.DDUDU', '.DRRR.', '.R....']),
  parse(['......', '.LLL..', '.UULD.', '.UUDD.', '..LL..', '...L..']),
  parse(['......', '..RRRD', '.DLLD.', '.DRUD.', '.RDRR.', '..RR..']),
  parse(['..RR..', '.LLL..', 'DRRDD.', '.DRRD.', '.LLL..', '......']),
  parse(['..RR..', '..LLR.', 'URUDU.', 'UDULU.', 'DLRRR.', '......']),
  parse(['..R...', '..R.RU', 'DDRDU.', '.DRDUU', '..LLR.', '......']),
  parse(['..RR..', '.URRR.', '.UDLD.', '.UDUD.', '..RRD.', '......']),
  parse(['..R...', 'ULLL..', 'UUDLDU', 'ULRDDU', '.ULLR.', '..R...']),
  parse(['......', '.RURR.', 'UDRDU.', 'UDRDU.', '.LLLD.', '..R...']),
  parse(['..RR..', '.ULLU.', '.UDLUD', '.UDLU.', '.LLL..', '...U..']),
  parse(['...L..', '..RUU.', '.DDLRU', 'UDDDLU', '.LLL..', '..R...']),
  parse(['.LR.R.', '.LRRR.', 'DUULD.', '.URRD.', '.D.LD.', '.LL.L.']),
  parse(['......', 'UURRRD', '.UDDU.', 'UURRU.', '.RDR..', '..R...']),
  parse(['.......', '...L...', '.ULRD..', '.UDURDD', '.UDLRD.', '..RR...', '.......']),
  parse(['..R....', '..LL...', '.UULRD.', '.UURU.U', '.ULRUD.', '.R...R.', '.......']),
  parse(['.......', '...R...', '.UULLU.', 'UURRDD.', '.ULRD..', '...RR..', '.......']),
  parse(['.......', '...LR..', '.DLRDU.', '..ULDU.', '.DLRD..', '..LRR..', '.......']),
  parse(['...R...', '...RR..', '.ULRD..', '.UUUDDU', '.D.RRD.', '.LRRRD.', '.......']),
  parse(['...L...', '..LRRU.', 'DDLLL..', '.DUDUD.', 'DDULUD.', '.LLL...', '.RDR...']),
  parse(['...L...', '..LLR..', '.DRRU..', '.DDDDDU', '..DRD..', '.LLLLR.', '.......']),
  parse(['.......', '.ULLR..', '..URRD.', '.DURUR.', '.DLLRD.', '..RR.R.', '...L...']),
  parse(['...L...', '..LR.D.', '.UURD..', '.DURDD.', '.DDLDD.', '.LLLLR.', '...L...']),
  parse(['.LUL...', '..LL...', '.ULLR..', '.RDRDDU', '..DLLD.', '..LLR..', '.......']),
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
