import {
  Orb,
  BoardState,
  GameMove,
  MoveValidationResult,
  ExplosionResult,
} from './types';

const GRID_SIZE = 6;
const MAX_MASS = 4;
const SPAWN_PROBABILITY = 0.4;

// ============================================================================
// BOARD INITIALIZATION
// ============================================================================

export function initializeBoard(): (Orb | null)[][] {
  const grid: (Orb | null)[][] = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(null));

  // Spawn random orbs
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (Math.random() < SPAWN_PROBABILITY) {
        const colors: Array<'blue' | 'red' | 'neutral'> = [
          'blue',
          'red',
          'neutral',
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];
        grid[r][c] = {
          color,
          mass: Math.floor(Math.random() * 3) + 1, // 1-3
        };
      }
    }
  }

  return grid;
}

export function createBoardState(hostId: string): BoardState {
  return {
    grid: initializeBoard(),
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
  currentPlayerId: string
): MoveValidationResult {
  // Check if it's the player's turn
  if (move.playerId !== currentPlayerId) {
    return { valid: false, reason: 'Not your turn' };
  }

  // Check grid bounds
  if (
    move.row < 0 ||
    move.row >= GRID_SIZE ||
    move.col < 0 ||
    move.col >= GRID_SIZE
  ) {
    return { valid: false, reason: 'Out of bounds' };
  }

  // Check if cell is empty
  const cell = boardState.grid[move.row][move.col];
  if (cell === null) {
    return { valid: false, reason: 'Cell is empty' };
  }

  // Check if orb belongs to player or is neutral
  if (cell.color !== 'neutral' && cell.color !== move.playerId) {
    // This assumes playerId can be matched to color - adjust if needed
    return { valid: false, reason: 'Not your orb' };
  }

  return { valid: true };
}

// ============================================================================
// GAME LOGIC: EXPLOSION & CHAIN REACTIONS
// ============================================================================

function getAdjacentCells(row: number, col: number): [number, number][] {
  const adjacent: [number, number][] = [];
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]; // up, down, left, right

  for (const [dr, dc] of directions) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
      adjacent.push([nr, nc]);
    }
  }

  return adjacent;
}

function bfsExplosion(
  grid: (Orb | null)[][],
  startRow: number,
  startCol: number,
  playerColor: 'blue' | 'red'
): {
  newGrid: (Orb | null)[][];
  affectedCells: Set<string>;
  scoreGain: number;
} {
  const newGrid = grid.map((row) => [...row]);
  const affectedCells = new Set<string>();
  const queue: [number, number][] = [];
  const visited = new Set<string>();

  // Start with the clicked cell
  const startKey = `${startRow},${startCol}`;
  queue.push([startRow, startCol]);
  visited.add(startKey);

  let scoreGain = 0;

  while (queue.length > 0) {
    const [row, col] = queue.shift()!;
    const cell = newGrid[row][col];

    if (cell === null) continue;

    affectedCells.add(`${row},${col}`);
    scoreGain += cell.mass;
    newGrid[row][col] = null;

    // If this was a player-colored orb, trigger chain explosion to adjacent same-color orbs
    if (cell.color === playerColor || cell.color === 'neutral') {
      for (const [nr, nc] of getAdjacentCells(row, col)) {
        const key = `${nr},${nc}`;
        if (!visited.has(key)) {
          const adjacent = newGrid[nr][nc];
          if (
            adjacent &&
            (adjacent.color === playerColor || adjacent.color === 'neutral')
          ) {
            visited.add(key);
            queue.push([nr, nc]);
          }
        }
      }
    }
  }

  return { newGrid, affectedCells, scoreGain };
}

export function applyMove(
  boardState: BoardState,
  move: GameMove,
  playerColor: 'blue' | 'red'
): ExplosionResult {
  const { newGrid, affectedCells, scoreGain } = bfsExplosion(
    boardState.grid,
    move.row,
    move.col,
    playerColor
  );

  const scores = { ...boardState.scores };
  scores[move.playerId] = (scores[move.playerId] || 0) + scoreGain;

  return {
    scores,
    newGrid,
    cellsAffected: affectedCells,
  };
}

// ============================================================================
// TURN MANAGEMENT
// ============================================================================

export function getNextTurn(
  currentPlayerId: string,
  playerIds: string[]
): string {
  const currentIndex = playerIds.indexOf(currentPlayerId);
  const nextIndex = (currentIndex + 1) % playerIds.length;
  return playerIds[nextIndex];
}

export function getValidMoves(boardState: BoardState): [number, number][] {
  const moves: [number, number][] = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (boardState.grid[r][c] !== null) {
        moves.push([r, c]);
      }
    }
  }

  return moves;
}

// ============================================================================
// UTILITIES
// ============================================================================

export function isGameOver(boardState: BoardState): boolean {
  // Game is over if no moves are available
  return getValidMoves(boardState).length === 0;
}

export function getWinner(
  scores: Record<string, number>,
  players: Array<{ id: string; name: string }>
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

export const GRID_SIZE_EXPORT = GRID_SIZE;
export const MAX_MASS_EXPORT = MAX_MASS;
