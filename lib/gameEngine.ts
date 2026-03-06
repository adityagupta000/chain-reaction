import {
  Orb,
  BoardState,
  GameMove,
  MoveValidationResult,
  ExplosionResult,
  PlayerColor,
} from "./types";

// ============================================================================
// CRITICAL MASS (number of adjacent cells for a position)
// ============================================================================

export function getCriticalMass(
  row: number,
  col: number,
  rows: number,
  cols: number,
): number {
  let mass = 4;
  if (row === 0 || row === rows - 1) mass--;
  if (col === 0 || col === cols - 1) mass--;
  return mass;
}

function getAdjacentCells(
  row: number,
  col: number,
  rows: number,
  cols: number,
): [number, number][] {
  const cells: [number, number][] = [];
  if (row > 0) cells.push([row - 1, col]);
  if (row < rows - 1) cells.push([row + 1, col]);
  if (col > 0) cells.push([row, col - 1]);
  if (col < cols - 1) cells.push([row, col + 1]);
  return cells;
}

// ============================================================================
// BOARD INITIALIZATION (empty board for Chain Reaction)
// ============================================================================

export function initializeBoard(rows: number, cols: number): (Orb | null)[][] {
  return Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(null));
}

export function createBoardState(
  hostId: string,
  rows: number = 9,
  cols: number = 6,
): BoardState {
  return {
    grid: initializeBoard(rows, cols),
    scores: { [hostId]: 0 },
    turn: hostId,
    turnNumber: 0,
    gameStartedAt: Date.now(),
    lastMoveAt: Date.now(),
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateMove(
  move: GameMove,
  boardState: BoardState,
  currentPlayerId: string,
  playerColor?: PlayerColor,
): MoveValidationResult {
  const rows = boardState.grid.length;
  const cols = boardState.grid[0]?.length || 0;

  if (move.playerId !== currentPlayerId) {
    return { valid: false, reason: "Not your turn" };
  }

  if (move.row < 0 || move.row >= rows || move.col < 0 || move.col >= cols) {
    return { valid: false, reason: "Out of bounds" };
  }

  const cell = boardState.grid[move.row][move.col];
  // Chain Reaction: can place on empty cell or cell with your own color
  if (cell !== null && playerColor && cell.color !== playerColor) {
    return { valid: false, reason: "Cell belongs to another player" };
  }

  return { valid: true };
}

// ============================================================================
// GAME LOGIC: CHAIN REACTION EXPLOSIONS
// ============================================================================

export function applyMove(
  boardState: BoardState,
  move: GameMove,
  playerColor: PlayerColor,
): ExplosionResult {
  const rows = boardState.grid.length;
  const cols = boardState.grid[0]?.length || 0;
  const grid = boardState.grid.map((r) =>
    r.map((cell) => (cell ? { ...cell } : null)),
  );
  const cellsAffected = new Set<string>();

  // Place orb
  if (grid[move.row][move.col] === null) {
    grid[move.row][move.col] = { color: playerColor, mass: 1 };
  } else {
    grid[move.row][move.col]!.mass += 1;
    grid[move.row][move.col]!.color = playerColor;
  }
  cellsAffected.add(`${move.row},${move.col}`);

  // Process chain reactions
  const queue: [number, number][] = [];
  if (
    grid[move.row][move.col]!.mass >=
    getCriticalMass(move.row, move.col, rows, cols)
  ) {
    queue.push([move.row, move.col]);
  }

  const MAX_ITER = rows * cols * 50;
  let iter = 0;

  while (queue.length > 0 && iter < MAX_ITER) {
    iter++;
    const [r, c] = queue.shift()!;
    const cell = grid[r][c];
    if (!cell) continue;

    const critMass = getCriticalMass(r, c, rows, cols);
    if (cell.mass < critMass) continue;

    // Explode: distribute to neighbors
    const neighbors = getAdjacentCells(r, c, rows, cols);
    cell.mass -= neighbors.length;
    if (cell.mass <= 0) {
      grid[r][c] = null;
    }
    cellsAffected.add(`${r},${c}`);

    for (const [nr, nc] of neighbors) {
      const nb = grid[nr][nc];
      if (nb === null) {
        grid[nr][nc] = { color: playerColor, mass: 1 };
      } else {
        nb.mass += 1;
        nb.color = playerColor; // Capture
      }
      cellsAffected.add(`${nr},${nc}`);

      if (grid[nr][nc]!.mass >= getCriticalMass(nr, nc, rows, cols)) {
        queue.push([nr, nc]);
      }
    }
  }

  // Scores will be recomputed by server via computeScores
  const scores = { ...boardState.scores };
  return { scores, newGrid: grid, cellsAffected };
}

// ============================================================================
// SCORE COMPUTATION
// ============================================================================

export function computeScores(
  grid: (Orb | null)[][],
  players: { id: string; color: PlayerColor }[],
): Record<string, number> {
  const colorCounts: Record<string, number> = {};
  for (const row of grid) {
    for (const cell of row) {
      if (cell) {
        colorCounts[cell.color] = (colorCounts[cell.color] || 0) + cell.mass;
      }
    }
  }
  const scores: Record<string, number> = {};
  for (const p of players) {
    scores[p.id] = colorCounts[p.color] || 0;
  }
  return scores;
}

// ============================================================================
// TURN MANAGEMENT
// ============================================================================

export function getNextTurn(
  currentPlayerId: string,
  playerIds: string[],
): string {
  const currentIndex = playerIds.indexOf(currentPlayerId);
  const nextIndex = (currentIndex + 1) % playerIds.length;
  return playerIds[nextIndex];
}

export function getValidMoves(boardState: BoardState): [number, number][] {
  return [];
}

// ============================================================================
// GAME OVER
// ============================================================================

export function isGameOver(boardState: BoardState): boolean {
  // Need at least one full round before checking
  if (boardState.turnNumber < 2) return false;

  const colorsOnBoard = new Set<string>();
  let hasAnyOrbs = false;

  for (const row of boardState.grid) {
    for (const cell of row) {
      if (cell) {
        hasAnyOrbs = true;
        colorsOnBoard.add(cell.color);
      }
    }
  }

  if (!hasAnyOrbs) return false;
  // Game over when only 1 player's color remains
  return colorsOnBoard.size <= 1;
}

export function getWinner(
  scores: Record<string, number>,
  players: Array<{ id: string; name: string }>,
): { id: string; name: string } | null {
  let maxScore = -1;
  let winnerId: string | null = null;

  for (const playerId in scores) {
    if (scores[playerId] > maxScore) {
      maxScore = scores[playerId];
      winnerId = playerId;
    }
  }

  if (winnerId) {
    return players.find((p) => p.id === winnerId) || null;
  }

  return null;
}
