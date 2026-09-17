/** Cake-block polyominoes — Block Blast style, brand colors */

export const BOARD_SIZE = 8;

export const COLORS = [
  { fill: '#ea98af', icing: '#fff5f8', name: 'Rosa' },
  { fill: '#e97a6f', icing: '#ffe8e4', name: 'Coral' },
  { fill: '#BF6C58', icing: '#ffe8d6', name: 'Terracota' },
  { fill: '#1e4f70', icing: '#d9e8f2', name: 'Navy' },
  { fill: '#5ca370', icing: '#e8f5ec', name: 'Menta' },
  { fill: '#c45d8a', icing: '#ffe0ef', name: 'Fresa' },
];

/** Each shape is an array of [r,c] offsets from origin (top-left bounding). */
const SHAPE_DEFS = [
  // singles & bars
  { id: 'dot', cells: [[0, 0]] },
  { id: 'domino-h', cells: [[0, 0], [0, 1]] },
  { id: 'domino-v', cells: [[0, 0], [1, 0]] },
  { id: 'tri-h', cells: [[0, 0], [0, 1], [0, 2]] },
  { id: 'tri-v', cells: [[0, 0], [1, 0], [2, 0]] },
  { id: 'tetra-h', cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { id: 'tetra-v', cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: 'penta-h', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { id: 'penta-v', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  // squares & rects
  { id: 'square2', cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { id: 'rect23', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
  { id: 'rect32', cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]] },
  { id: 'square3', cells: [
    [0, 0], [0, 1], [0, 2],
    [1, 0], [1, 1], [1, 2],
    [2, 0], [2, 1], [2, 2],
  ] },
  // L shapes
  { id: 'L3', cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { id: 'L3b', cells: [[0, 1], [1, 1], [2, 0], [2, 1]] },
  { id: 'L3c', cells: [[0, 0], [0, 1], [1, 0], [2, 0]] },
  { id: 'L3d', cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  { id: 'L4', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]] },
  { id: 'L4b', cells: [[0, 1], [1, 1], [2, 1], [3, 0], [3, 1]] },
  { id: 'bigL', cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] },
  { id: 'bigLb', cells: [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]] },
  { id: 'bigLc', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]] },
  { id: 'bigLd', cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
  // T shapes
  { id: 'T', cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { id: 'Tb', cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
  { id: 'Tc', cells: [[0, 0], [1, 0], [1, 1], [2, 0]] },
  { id: 'Td', cells: [[0, 1], [1, 0], [1, 1], [2, 1]] },
  // S / Z
  { id: 'S', cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  { id: 'Z', cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
  { id: 'Sv', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { id: 'Zv', cells: [[0, 1], [1, 0], [1, 1], [2, 0]] },
  // corners / small
  { id: 'corner', cells: [[0, 0], [0, 1], [1, 0]] },
  { id: 'cornerb', cells: [[0, 0], [0, 1], [1, 1]] },
  { id: 'cornerc', cells: [[0, 0], [1, 0], [1, 1]] },
  { id: 'cornerd', cells: [[0, 1], [1, 0], [1, 1]] },
  // plus / odd
  { id: 'plus', cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]] },
  { id: 'U', cells: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]] },
];

function normalize(cells) {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells.map(([r, c]) => [r - minR, c - minC]);
}

function dims(cells) {
  return {
    rows: Math.max(...cells.map(([r]) => r)) + 1,
    cols: Math.max(...cells.map(([, c]) => c)) + 1,
  };
}

/** Weighted random — favor mid-size pieces, fewer giants */
function pickDef() {
  const weights = SHAPE_DEFS.map((d) => {
    const n = d.cells.length;
    if (n === 1) return 2;
    if (n === 2) return 4;
    if (n === 3) return 6;
    if (n === 4) return 8;
    if (n === 5) return 5;
    if (n === 6) return 3;
    if (n >= 9) return 1;
    return 2;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SHAPE_DEFS.length; i++) {
    r -= weights[i];
    if (r <= 0) return SHAPE_DEFS[i];
  }
  return SHAPE_DEFS[0];
}

export function createPiece() {
  const def = pickDef();
  const cells = normalize(def.cells);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const { rows, cols } = dims(cells);
  return {
    id: `${def.id}-${Math.random().toString(36).slice(2, 7)}`,
    name: def.id,
    cells,
    rows,
    cols,
    color: color.fill,
    icing: color.icing,
    used: false,
  };
}

export function dealHand() {
  return [createPiece(), createPiece(), createPiece()];
}

/** Can piece fit at board[row][col] origin? */
export function canPlace(board, piece, row, col) {
  if (!piece || piece.used) return false;
  for (const [dr, dc] of piece.cells) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) return false;
    if (board[r][c]) return false;
  }
  return true;
}

/** Does piece fit anywhere on the board? */
export function canFitAnywhere(board, piece) {
  if (!piece || piece.used) return false;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (canPlace(board, piece, r, c)) return true;
    }
  }
  return false;
}

export function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

/**
 * Place piece; return { cellsPlaced, clearedRows, clearedCols, clearedCells }
 * Mutates board.
 */
export function placePiece(board, piece, row, col) {
  const placed = [];
  for (const [dr, dc] of piece.cells) {
    const r = row + dr;
    const c = col + dc;
    board[r][c] = { color: piece.color, icing: piece.icing };
    placed.push([r, c]);
  }

  const clearedRows = [];
  const clearedCols = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (board[r].every((cell) => cell)) clearedRows.push(r);
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (!board[r][c]) {
        full = false;
        break;
      }
    }
    if (full) clearedCols.push(c);
  }

  const clearedSet = new Set();
  for (const r of clearedRows) {
    for (let c = 0; c < BOARD_SIZE; c++) clearedSet.add(`${r},${c}`);
  }
  for (const c of clearedCols) {
    for (let r = 0; r < BOARD_SIZE; r++) clearedSet.add(`${r},${c}`);
  }

  const clearedCells = [...clearedSet].map((k) => {
    const [r, c] = k.split(',').map(Number);
    return [r, c, board[r][c]];
  });

  for (const [r, c] of clearedCells) {
    board[r][c] = null;
  }

  return {
    cellsPlaced: placed.length,
    clearedRows,
    clearedCols,
    linesCleared: clearedRows.length + clearedCols.length,
    clearedCells,
  };
}

/** Combo label in Spanish */
export function comboLabel(lines) {
  if (lines >= 6) return '¡MEGA CLEAR!';
  if (lines >= 4) return '¡Mega clear!';
  if (lines === 3) return '¡Triple!';
  if (lines === 2) return '¡Doble!';
  if (lines === 1) return '¡Línea!';
  return '';
}

/**
 * Scoring:
 * - 1 pt per cell placed
 * - line bonuses scale with count (dopamine for multi-clears)
 * - streak bonus when consecutive placements clear lines
 */
export function scorePlacement({ cellsPlaced, linesCleared, streak }) {
  let score = cellsPlaced;
  if (linesCleared <= 0) return { score, bonus: 0 };

  // Base per line + quadratic bonus for multi
  const lineBonus = [0, 10, 30, 60, 100, 150, 220, 300, 400][linesCleared] || linesCleared * 50;
  const streakBonus = streak > 1 ? (streak - 1) * 15 : 0;
  const bonus = lineBonus + streakBonus;
  return { score: score + bonus, bonus };
}
