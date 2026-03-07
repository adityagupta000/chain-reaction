# Game Engine

The game engine (`lib/gameEngine.ts`) contains all pure game logic — no rendering, no network, no side effects. Every function is deterministic and testable.

## Core Concepts

### Critical Mass

Each cell has a **critical mass** equal to the number of its orthogonal neighbors:

| Position | Neighbors | Critical Mass |
| -------- | --------- | ------------- |
| Corner   | 2         | 2             |
| Edge     | 3         | 3             |
| Center   | 4         | 4             |

```typescript
function getCriticalMass(
  row: number,
  col: number,
  rows: number,
  cols: number,
): number;
```

When a cell's orb count reaches its critical mass, it **explodes**.

### Board State

```typescript
interface BoardState {
  grid: Cell[][]; // 2D array of cells
  scores: Record<string, number>; // playerId → total orbs
  currentPlayerIndex: number; // whose turn (0-based index into players[])
  turnNumber: number;
  gameStartedAt: number; // Unix timestamp
  lastMoveAt: number; // Unix timestamp
}

interface Cell {
  orbs: number; // 0 = empty
  owner: number | null; // player index (0-based) or null if empty
}
```

## Functions

### Board Initialization

```typescript
function initializeBoard(rows: number, cols: number): Cell[][];
```

Creates a grid filled with empty cells (`{ orbs: 0, owner: null }`).

```typescript
function createBoardState(
  hostPlayerIndex: number,
  rows?: number,
  cols?: number,
): BoardState;
```

Creates a fresh `BoardState` with an empty grid. Default grid size is 9×6.

### Move Validation

```typescript
function isValidMove(
  grid: Cell[][],
  row: number,
  col: number,
  playerIndex: number,
  rows: number,
  cols: number,
): boolean;
```

Returns `true` if:

- `(row, col)` is within bounds
- The cell is **empty** (orbs === 0), OR
- The cell is **owned by the same player** (owner === playerIndex)

Returns `false` if the cell belongs to another player.

### Applying a Move (Chain Reactions)

```typescript
function applyMove(
  boardState: BoardState,
  move: GameMove,
  playerIndex: number,
  players: Player[],
): ExplosionResult;
```

This is the core game logic function. It:

1. **Deep copies** the grid (does not mutate the original)
2. **Places an orb** at `(move.row, move.col)` owned by `playerIndex`
3. **Processes chain reactions** using BFS:
   - If the cell reaches critical mass → it explodes
   - Source cell becomes empty (`orbs: 0, owner: null`)
   - Each orthogonal neighbor receives 1 orb, **captured** by the exploding player
   - If any neighbor now reaches its own critical mass → it's added to the BFS queue
   - Continues until no more cells are at critical mass
4. **Safety limit**: Maximum `rows × cols × 50` iterations to prevent infinite loops
5. **Computes scores** and determines if there's a winner

Returns:

```typescript
interface ExplosionResult {
  scores: Record<string, number>; // updated orb counts per player
  newGrid: Cell[][]; // the grid after all explosions
  explosionSequence: ExplosionStep[]; // ordered list of explosions for animation
  eliminatedPlayers: number[]; // player indices with 0 orbs
  winner: Player | null; // non-null if only 1 player has orbs
}

interface ExplosionStep {
  row: number;
  col: number;
  playerIndex: number;
  neighbors: [number, number][]; // which cells received orbs
}
```

### BFS Chain Reaction Algorithm

```
1. Place orb at (row, col)
2. If cell.orbs >= criticalMass → push to queue
3. While queue is not empty:
   a. Dequeue cell (r, c)
   b. If cell.orbs < criticalMass → skip (already processed)
   c. Record explosion: { row, col, playerIndex, neighbors }
   d. Set cell to empty: { orbs: 0, owner: null }
   e. For each neighbor (nr, nc):
      - neighbor.orbs += 1
      - neighbor.owner = exploding player  (CAPTURE)
      - If neighbor.orbs >= its criticalMass → enqueue it
4. Return final grid state
```

Key behavior:

- A cell can explode multiple times in one move (if it receives enough orbs from neighbors)
- The `inQueue` Set prevents duplicate entries in the BFS queue
- Captured cells immediately belong to the exploding player

### Scoring

```typescript
function computeScores(
  grid: Cell[][],
  players: Player[],
): Record<string, number>;
```

Counts total orbs per player by iterating through the entire grid.

```typescript
function getOrbCountsPerPlayer(
  grid: Cell[][],
  players: Player[],
): Record<string, number>;
```

Same as `computeScores` — counts orbs owned by each player.

### Turn Management

```typescript
function getNextActivePlayer(
  currentIndex: number,
  players: Player[],
  grid: Cell[][],
): number;
```

Returns the index of the next player who should take a turn:

1. Starts from `(currentIndex + 1) % players.length`
2. **Skips** players who have already moved (`hasMovedOnce === true`) AND have 0 orbs (eliminated)
3. **Includes** players who haven't moved yet (even if they have 0 orbs — they get their first turn)
4. Safety loop iterates at most `players.length` times

### Game Over Detection

```typescript
function isGameOver(grid: Cell[][], players: Player[]): boolean;
```

Returns `true` when:

1. **Every** player has moved at least once (`hasMovedOnce === true` for all)
2. Only **1 player** has orbs remaining on the board

This two-condition check prevents premature game-over detection (e.g., a 5-player game can't end before all 5 players have had their first turn).

```typescript
function getWinner(grid: Cell[][], players: Player[]): Player | null;
```

Returns the winning player if the game is over, otherwise `null`.

### Eliminated Players

```typescript
function getEliminatedPlayers(grid: Cell[][], players: Player[]): number[];
```

Returns an array of player indices who:

- Have already moved at least once (`hasMovedOnce === true`)
- Have 0 orbs remaining on the board

## Data Types

### Player

```typescript
interface Player {
  id: string; // nanoid-generated unique ID
  name: string; // display name
  role: PlayerRole; // "host" | "guest"
  color: PlayerColor; // "blue" | "red" | "green" | "yellow" | "purple"
  score: number;
  isActive: boolean; // whose turn it is
  socketId?: string;
  hasMovedOnce: boolean; // prevents early game-over
}
```

### GameMove

```typescript
interface GameMove {
  playerId: string;
  row: number;
  col: number;
  timestamp: number; // Date.now()
}
```

### GameRoom

```typescript
interface GameRoom {
  id: string; // nanoid room ID
  name: string; // room display name
  host: Player;
  guest?: Player; // backward compat for 2-player
  players: Player[]; // all players (2–5)
  status: "waiting" | "playing" | "finished";
  boardState: BoardState;
  createdAt: number;
  maxPlayers: number; // 2–5
  gridRows: number; // grid height
  gridCols: number; // grid width
}
```
