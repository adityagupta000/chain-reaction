import {
  Cell,
  BoardState,
  GameMove,
  Player,
  ExplosionResult,
  ExplosionStep,
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
// BOARD INITIALIZATION
// ============================================================================

export function initializeBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ orbs: 0, owner: null })),
  );
}

export function createBoardState(
  hostPlayerIndex: number,
  rows: number = 9,
  cols: number = 6,
): BoardState {
  return {
    grid: initializeBoard(rows, cols),
    scores: {},
    currentPlayerIndex: 0,
    turnNumber: 0,
    gameStartedAt: Date.now(),
    lastMoveAt: Date.now(),
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidMove(
  grid: Cell[][],
  row: number,
  col: number,
  playerIndex: number,
  rows: number,
  cols: number,
): boolean {
  if (row < 0 || row >= rows || col < 0 || col >= cols) {
    return false;
  }

  const cell = grid[row][col];

  // Can place on empty cell
  if (cell.orbs === 0) return true;

  // Can place on own cell
  if (cell.owner === playerIndex) return true;

  // Cannot place on opponent's cell
  return false;
}

// ============================================================================
// GAME LOGIC: CHAIN REACTION EXPLOSIONS
// ============================================================================

export function applyMove(
  boardState: BoardState,
  move: GameMove,
  playerIndex: number,
  players: Player[],
): ExplosionResult {
  // Deep copy grid
  const grid = boardState.grid.map((r) => r.map((cell) => ({ ...cell })));
  const rows = boardState.grid.length;
  const cols = boardState.grid[0]?.length ?? 6;
  const explosionSequence: ExplosionStep[] = [];

  const inQueue = new Set<string>();
  const eliminatedPlayers = new Set<number>();

  // Place orb
  grid[move.row][move.col].orbs += 1;
  grid[move.row][move.col].owner = playerIndex;

  // Process chain reactions
  const queue: [number, number][] = [];
  if (
    grid[move.row][move.col].orbs >=
    getCriticalMass(move.row, move.col, rows, cols)
  ) {
    queue.push([move.row, move.col]);
    inQueue.add(`${move.row},${move.col}`);
  }

  const MAX_ITER = rows * cols * 50;
  let iter = 0;

  while (queue.length > 0 && iter < MAX_ITER) {
    iter++;
    const [r, c] = queue.shift()!;
    inQueue.delete(`${r},${c}`);

    const critMass = getCriticalMass(r, c, rows, cols);
    if (grid[r][c].orbs < critMass) continue;

    // Record explosion
    const neighbors = getAdjacentCells(r, c, rows, cols);
    const owner = grid[r][c].owner;
    if (owner !== null) {
      explosionSequence.push({
        row: r,
        col: c,
        playerIndex: owner,
        neighbors,
      });
    }

    // Source cell always becomes completely empty
    grid[r][c].orbs = 0;
    grid[r][c].owner = null;

    // Send exactly 1 orb to each neighbor
    for (const [nr, nc] of neighbors) {
      grid[nr][nc].orbs += 1;
      grid[nr][nc].owner = owner; // Capture

      // Queue neighbor if it now hits critical mass
      if (
        grid[nr][nc].orbs >= getCriticalMass(nr, nc, rows, cols) &&
        !inQueue.has(`${nr},${nc}`)
      ) {
        queue.push([nr, nc]);
        inQueue.add(`${nr},${nc}`);
      }
    }
  }

  // Compute scores
  const scores = computeScores(grid, players);

  // Determine winner and eliminated players
  let winner: Player | null = null;
  const orbCounts = getOrbCountsPerPlayer(grid, players);
  const activePlayers = players.filter(
    (p, idx) => p.hasMovedOnce && orbCounts[p.id] > 0,
  );

  if (activePlayers.length === 1) {
    winner = activePlayers[0];
  }

  // Populate eliminated players list
  const eliminatedPlayerIndices = getEliminatedPlayers(grid, players);

  return {
    scores,
    newGrid: grid,
    explosionSequence,
    eliminatedPlayers: eliminatedPlayerIndices,
    winner,
  };
}

// ============================================================================
// SCORE COMPUTATION
// ============================================================================

export function computeScores(
  grid: Cell[][],
  players: Player[],
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const player of players) {
    scores[player.id] = 0;
  }

  for (const row of grid) {
    for (const cell of row) {
      if (cell.orbs > 0 && cell.owner !== null) {
        const owner = players[cell.owner];
        if (owner) {
          scores[owner.id] += cell.orbs;
        }
      }
    }
  }

  return scores;
}

export function getOrbCountsPerPlayer(
  grid: Cell[][],
  players: Player[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const player of players) counts[player.id] = 0;

  for (const row of grid) {
    for (const cell of row) {
      if (cell.orbs > 0 && cell.owner !== null) {
        const owner = players[cell.owner];
        if (owner) counts[owner.id] += cell.orbs;
      }
    }
  }
  return counts;
}

// ============================================================================
// TURN MANAGEMENT
// ============================================================================

export function getNextActivePlayer(
  currentIndex: number,
  players: Player[],
  grid: Cell[][],
): number {
  const orbCounts = getOrbCountsPerPlayer(grid, players);
  let nextIndex = (currentIndex + 1) % players.length;
  let safety = 0;

  while (safety < players.length) {
    const next = players[nextIndex];
    // Skip only if player has moved before AND has 0 orbs
    if (!next.hasMovedOnce || orbCounts[next.id] > 0) {
      return nextIndex;
    }
    nextIndex = (nextIndex + 1) % players.length;
    safety++;
  }

  return nextIndex;
}

// ============================================================================
// GAME OVER
// ============================================================================

export function isGameOver(grid: Cell[][], players: Player[]): boolean {
  // Game cannot end until every player has moved at least once
  if (!players.every((p) => p.hasMovedOnce)) return false;

  // Count orbs per player
  const orbCounts = getOrbCountsPerPlayer(grid, players);

  // Find players still alive (have orbs)
  const activePlayers = players.filter(
    (p) => p.hasMovedOnce && orbCounts[p.id] > 0,
  );

  // Game over when only 1 player remains
  return activePlayers.length === 1;
}

export function getWinner(grid: Cell[][], players: Player[]): Player | null {
  if (!isGameOver(grid, players)) return null;

  const orbCounts = getOrbCountsPerPlayer(grid, players);
  const winner = players
    .filter((p) => p.hasMovedOnce)
    .find((p) => orbCounts[p.id] > 0);

  return winner || null;
}

// ============================================================================
// ELIMINATED PLAYERS
// ============================================================================

export function getEliminatedPlayers(
  grid: Cell[][],
  players: Player[],
): number[] {
  const orbCounts = getOrbCountsPerPlayer(grid, players);
  return players
    .filter((p) => p.hasMovedOnce && orbCounts[p.id] === 0)
    .map((p) => players.indexOf(p));
}
