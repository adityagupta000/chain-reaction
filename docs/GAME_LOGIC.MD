# Chain Reaction - Game Logic Documentation

## Table of Contents

1. [Overview](#overview)
2. [Game Rules](#game-rules)
3. [Core Mechanics](#core-mechanics)
4. [Data Structures](#data-structures)
5. [Game Flow](#game-flow)
6. [Turn Management](#turn-management)
7. [Scoring System](#scoring-system)
8. [Win Condition](#win-condition)
9. [Key Functions](#key-functions)
10. [Code Architecture](#code-architecture)
11. [Socket.IO Events](#socketio-events)
12. [Examples](#examples)

---

## Overview

**Chain Reaction** is a strategic multiplayer game where players place orbs on a grid. When a cell reaches its "critical mass" (based on position), it explodes, distributing orbs to neighboring cells. This can trigger chain reactions where multiple cells explode in sequence, capturing opponents' orbs and converting them to the attacking player's color.

**Game Objective**: Be the last player with orbs on the board.

**Game Model**:

- **Grid**: 9 rows × 6 columns (configurable: 6×6, 8×5, 9×6, 10×8, 12×8)
- **Cell**: Contains `{ orbs: number, owner: number|null }`
- **Players**: 2–5 players, indexed 0, 1, 2, etc. (using playerIndex)
- **Tracking**: Uses `playerIndex` (integer) not color strings or player IDs
- **Key Flag**: `hasMovedOnce` prevents early game wins until all players have taken a turn

---

## Recent Updates

### Event Consolidation

**Socket.IO Event Consolidation**:

- **Before**: Separate `game:moveReceived`, `game:explosion`, `game:finished` events
- **After**: Single `game:moveResult` event with combined payload
- **Benefit**: Atomic updates, eliminates race conditions, guarantees correct explosion sequencing

**Eliminated Players Tracking**:

- Added `getEliminatedPlayers()` function in `lib/gameEngine.ts`
- Tracks players with 0 orbs after moving via `eliminatedPlayers` array
- Populated in every `game:moveResult` event for UI notifications

**Files Modified**:

- `lib/gameEngine.ts`: Added `getEliminatedPlayers()` function
- `server/index.ts`: Merged three socket events into single `game:moveResult` emit
- `hooks/useSocket.ts`: Single listener for consolidated event
- `lib/types.ts`: `ExplosionResult` interface includes `eliminatedPlayers` field

---

## Game Rules

### 1. Board Setup

- **Grid Size**: 9 rows × 6 columns (configurable, clamped 3–15 per dimension)
- **Initial State**: All cells empty `{ orbs: 0, owner: null }`
- **Players**: 2–5 players, indexed 0, 1, 2, etc.
- **Initial Player**: Player 0 (first player / host) goes first

### 2. Placing an Orb

On your turn, you **place one orb** on any valid cell:

- **Empty cell** (orbs = 0): Creates 1 orb owned by you
- **Your own cell** (owner = playerIndex): Increases orb count by 1
- **Opponent's cell**: **Invalid move** (cannot place)

### 3. Critical Mass & Explosions

Each cell has a **critical mass** equal to the number of its orthogonal neighbors:

For the default 9×6 grid (54 cells total):

```
Corner cells  (4 total):   Critical mass = 2
Edge cells    (22 total):  Critical mass = 3
Center cells  (28 total):  Critical mass = 4
```

**Critical Mass Calculation**:

```typescript
function getCriticalMass(
  row: number,
  col: number,
  rows: number,
  cols: number,
): number {
  let mass = 4;
  if (row === 0 || row === rows - 1) mass--; // Top or bottom edge
  if (col === 0 || col === cols - 1) mass--; // Left or right edge
  return mass;
}
```

When a cell's orb count **≥ critical mass**, it **explodes**:

1. The source cell sends 1 orb to each orthogonal neighbor (up, down, left, right)
2. All neighbors are now owned by the attacking player
3. The source cell becomes empty: `{ orbs: 0, owner: null }`
4. If any neighbor now has orbs ≥ its critical mass, **it explodes too** (chain reaction)
5. Chain continues until no cell exceeds critical mass

### 4. Orthogonal Neighbors Only

Explosions affect only orthogonal neighbors (no diagonals):

```
      [up]
[left][cell][right]
     [down]
```

### 5. Turn Order

After a move resolves:

1. Move to the next player (index + 1) mod players.length
2. Skip any player with 0 orbs on the board **and** who has moved (`hasMovedOnce = true`)
3. Continue until game is not over

**Special Rule**: A player with 0 orbs can still take a turn if they haven't moved yet (`hasMovedOnce = false`). They are **never** skipped until they've made at least one move.

---

## Core Mechanics

### Adjacent Cells Function

> **Note**: `getAdjacentCells` is a **private** (non-exported) function in `lib/gameEngine.ts`.

```typescript
function getAdjacentCells(
  row: number,
  col: number,
  rows: number,
  cols: number,
): [number, number][] {
  const cells: [number, number][] = [];
  if (row > 0) cells.push([row - 1, col]); // Up
  if (row < rows - 1) cells.push([row + 1, col]); // Down
  if (col > 0) cells.push([row, col - 1]); // Left
  if (col < cols - 1) cells.push([row, col + 1]); // Right
  return cells;
}
```

### Explosion Algorithm

The core of the game engine. `applyMove()` processes explosions using BFS:

```typescript
function applyMove(
  boardState: BoardState,
  move: GameMove,
  playerIndex: number,
  players: Player[],
): ExplosionResult {
  // Deep copy the grid
  const grid = boardState.grid.map((r) => r.map((cell) => ({ ...cell })));
  const rows = boardState.grid.length;
  const cols = boardState.grid[0]?.length ?? 6;
  const explosionSequence: ExplosionStep[] = [];

  const inQueue = new Set<string>();

  // Place the orb at the move position
  grid[move.row][move.col].orbs += 1;
  grid[move.row][move.col].owner = playerIndex;

  // Initialize queue with cells that hit critical mass
  const queue: [number, number][] = [];
  if (
    grid[move.row][move.col].orbs >=
    getCriticalMass(move.row, move.col, rows, cols)
  ) {
    queue.push([move.row, move.col]);
    inQueue.add(`${move.row},${move.col}`);
  }

  // BFS through explosion queue (max iterations to prevent infinite loops)
  const MAX_ITER = rows * cols * 50;
  let iter = 0;

  while (queue.length > 0 && iter < MAX_ITER) {
    iter++;
    const [r, c] = queue.shift()!;
    inQueue.delete(`${r},${c}`);

    const critMass = getCriticalMass(r, c, rows, cols);
    if (grid[r][c].orbs < critMass) continue;

    // Record this explosion step (only if cell has an owner)
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

    // Source cell empties completely
    grid[r][c].orbs = 0;
    grid[r][c].owner = null;

    // Send 1 orb to each neighbor
    for (const [nr, nc] of neighbors) {
      grid[nr][nc].orbs += 1;
      grid[nr][nc].owner = owner; // Neighbor captured by attacker

      // Queue neighbor if it now exceeds critical mass
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

  // Determine winner inline (not via getWinner to avoid redundant computation)
  let winner: Player | null = null;
  const orbCounts = getOrbCountsPerPlayer(grid, players);
  const activePlayers = players.filter(
    (p) => p.hasMovedOnce && orbCounts[p.id] > 0,
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
```

**Key Points**:

- Source cell **always empties** after exploding
- Each neighbor gets exactly 1 orb
- Neighbors change owner to the attacker
- Chain reactions continue automatically via BFS queue
- `inQueue` Set prevents duplicate entries in the queue
- Max `rows * cols * 50` iterations prevents infinite loops (e.g. 450 for 9×6)
- Null guard on `owner` ensures type safety for `ExplosionStep.playerIndex`

---

## Data Structures

### Cell

Represents a single cell on the board.

```typescript
interface Cell {
  orbs: number; // 0 to N (how many orbs stacked in this cell)
  owner: number | null; // Player index (0, 1, etc.) or null if empty
}
```

### Player

Represents a player in the game.

```typescript
type PlayerRole = "host" | "guest";
type PlayerColor = "blue" | "red" | "green" | "yellow" | "purple";

interface Player {
  id: string; // Unique player ID (nanoid, assigned on player:join)
  name: string; // Player display name
  role: PlayerRole; // Who created the room vs joined
  color: PlayerColor; // Display color assigned to player
  score: number; // Current score (sum of all orbs controlled)
  isActive: boolean; // Is it this player's turn?
  socketId?: string; // Socket.IO connection ID
  hasMovedOnce: boolean; // Has player made at least one move? (prevents early wins)
}
```

### ExplosionStep

Represents a single cell explosion in the chain.

```typescript
interface ExplosionStep {
  row: number; // Row of exploding cell
  col: number; // Column of exploding cell
  playerIndex: number; // Which player triggered this explosion
  neighbors: [number, number][]; // Cells that received orbs
}
```

### BoardState

Represents the current game board state.

```typescript
interface BoardState {
  grid: Cell[][]; // 2D grid of cells (never null, empty = { orbs: 0, owner: null })
  scores: Record<string, number>; // Player ID → orb count
  currentPlayerIndex: number; // Which player's turn (0, 1, etc. — index into players[])
  turnNumber: number; // Total moves made in game
  gameStartedAt: number; // Unix timestamp
  lastMoveAt: number; // Unix timestamp of last move
}
```

### GameMove

Represents a player's action.

```typescript
interface GameMove {
  playerId: string; // Player making the move
  row: number; // Grid row (0-based)
  col: number; // Grid column (0-based)
  timestamp: number; // When move was made
}
```

### GameRoom

Represents a complete game session.

```typescript
interface GameRoom {
  id: string; // Unique room ID (nanoid)
  name: string; // Room display name
  host: Player; // Host player
  guest?: Player; // Backward compat: first non-host player
  players: Player[]; // Array of all players (2–5)
  status: "waiting" | "playing" | "finished";
  boardState: BoardState; // Current board state
  createdAt: number; // Timestamp
  maxPlayers: number; // Max players in room (2–5)
  gridRows: number; // Board height (default 9)
  gridCols: number; // Board width (default 6)
}
```

### ExplosionResult

Return value from `applyMove()`.

```typescript
interface ExplosionResult {
  scores: Record<string, number>;
  newGrid: Cell[][];
  explosionSequence: ExplosionStep[];
  eliminatedPlayers: number[]; // Array of playerIndex values for eliminated players
  winner: Player | null;
}
```

**Eliminated Players**: Array containing `playerIndex` values for all players who have been eliminated (0 orbs after having moved). Used for UI notifications and game state tracking.

---

## Game Flow

### Phase Diagram

```
Lobby → Waiting → Playing → GameOver
```

### Playing Phase - Main Loop

```
1. Display current board state
2. Show it's Player N's turn
3. Player selects a valid cell
4. Player submits move

5. SERVER VALIDATION:
   - Is it player's turn? (playerIndex === boardState.currentPlayerIndex)
   - Is position in bounds?
   - Is cell empty OR owned by this player?

6. APPLY MOVE:
   - Place orb at position
   - Process explosions and chain reactions (BFS)
   - Update grid ownership
   - Mark player.hasMovedOnce = true
   - Compute new scores
   - Determine if game is over

7. ADVANCE TURN:
   - getNextActivePlayer() finds next non-eliminated player
   - Increment turnNumber
   - Update lastMoveAt timestamp

8. BROADCAST:
   - Send single game:moveResult event to all players
   - Includes: boardState, explosionSequence, scores, eliminatedPlayers, winner

9. NEXT TURN:
   - If winner is null, repeat from step 2
   - If winner exists, game ends → GameOver phase

Game ends when only 1 player remains with orbs (after all have moved)
```

---

## Turn Management

### Turn Advancement Function

```typescript
export function getNextActivePlayer(
  currentIndex: number,
  players: Player[],
  grid: Cell[][],
): number {
  const orbCounts = getOrbCountsPerPlayer(grid, players);
  let nextIndex = (currentIndex + 1) % players.length;
  let safety = 0;

  // Skip only players who have moved AND have 0 orbs
  while (safety < players.length) {
    const next = players[nextIndex];
    if (!next.hasMovedOnce || orbCounts[next.id] > 0) {
      return nextIndex;
    }
    nextIndex = (nextIndex + 1) % players.length;
    safety++;
  }

  return nextIndex;
}
```

**Skip Logic**:

- Player skipped **only if** they have moved (`hasMovedOnce = true`) **AND** have 0 orbs
- Players who haven't moved yet (`hasMovedOnce = false`) are **never** skipped — they always get their turn
- This ensures every player gets at least one turn before potential elimination
- Safety counter prevents infinite loops (max `players.length` iterations)

### Turn Tracking

```typescript
// In BoardState:
currentPlayerIndex: number; // 0, 1, 2, etc. (index into players array)
```

**Not used anymore**:

- ~~`turn: string`~~ (old player ID based turn)
- ~~Color-based tracking~~ (now player index based)

---

## Scoring System

### Score Calculation

A player's **score** = total number of orbs they currently control on the board.

```typescript
export function computeScores(
  grid: Cell[][],
  players: Player[],
): Record<string, number> {
  const scores: Record<string, number> = {};

  // Initialize all scores to 0
  for (const player of players) {
    scores[player.id] = 0;
  }

  // Count all orbs on board
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
```

**Example Scenario**:

```
Grid state:
- Player 0 controls: 3 cells with 2, 1, 3 orbs = Score 6
- Player 1 controls: 2 cells with 4, 2 orbs = Score 6

Result: { "player0_id": 6, "player1_id": 6 }
```

### Orb Counting Helper

```typescript
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
```

---

## Win Condition

### Game Over Detection

```typescript
export function isGameOver(grid: Cell[][], players: Player[]): boolean {
  // IMPORTANT: Game cannot end until ALL players have moved at least once
  if (!players.every((p) => p.hasMovedOnce)) {
    return false;
  }

  // Count orbs per player
  const orbCounts = getOrbCountsPerPlayer(grid, players);

  // Find active players (those with orbs after they've moved)
  const activePlayers = players.filter(
    (p) => p.hasMovedOnce && orbCounts[p.id] > 0,
  );

  // Game over when only 1 player has orbs
  return activePlayers.length === 1;
}
```

### Winner Determination

```typescript
export function getWinner(grid: Cell[][], players: Player[]): Player | null {
  if (!isGameOver(grid, players)) return null;

  const orbCounts = getOrbCountsPerPlayer(grid, players);
  const winner = players
    .filter((p) => p.hasMovedOnce)
    .find((p) => orbCounts[p.id] > 0);

  return winner || null;
}
```

> **Note**: Inside `applyMove()`, the winner is determined inline (without calling `getWinner()`) to avoid redundant computation. The logic is equivalent.

### Win Condition Requirements

1. **All players have moved** at least once (`hasMovedOnce = true`)
2. **Only 1 player** has orbs remaining on the board
3. The last remaining player **wins**

**Why `hasMovedOnce`?**

- Prevents a player from winning before their opponent gets a turn
- Ensures fair play in multiplayer (2–5 players)
- Enables "last player standing" victory condition

### Example Scenarios

**Scenario 1: Normal Win**

```
Initial board: Empty
Move 1 (P0): Places orb at (4,3) → hasMovedOnce = true
Move 2 (P1): Places orb at (2,1) → hasMovedOnce = true
Moves 3-N: Chain reactions occur
Result: P0 captures all of P1's orbs → P0 hasMovedOnce ✓, P1 orbs = 0
Winner: P0
```

**Scenario 2: Early Elimination (Game Continues)**

```
Move 1 (P0): Places orb → hasMovedOnce = true
Move 2 (P1): Places orb → hasMovedOnce = true
Move 3 (P0): Creates chain that eliminates P1 (0 orbs)
Check game over:
  - P0.hasMovedOnce = true ✓
  - P1.hasMovedOnce = true ✓
  - Active players: [P0]
  Result: Game over, P0 wins
```

**Scenario 3: Empty Board After First Move**

```
Move 1 (P0): Places orb → hasMovedOnce = true
Check game over:
  - P1.hasMovedOnce = false ✗
  Result: Game NOT over (P1 hasn't moved yet)
Move 2 (P1): Places orb → hasMovedOnce = true
Check game over:
  - P0.hasMovedOnce = true ✓
  - P1.hasMovedOnce = true ✓
  - Active players: [P0, P1]
  Result: Game continues
```

---

## Key Functions

### Validation

```typescript
export function isValidMove(
  grid: Cell[][],
  row: number,
  col: number,
  playerIndex: number,
  rows: number,
  cols: number,
): boolean {
  // Out of bounds check
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;

  const cell = grid[row][col];

  // Can place on empty cell
  if (cell.orbs === 0) return true;

  // Can place on own cell (stack more orbs)
  if (cell.owner === playerIndex) return true;

  // Cannot place on opponent's cell
  return false;
}
```

### Board Initialization

```typescript
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
```

---

## Code Architecture

### Frontend Files

| File                         | Purpose                                                |
| ---------------------------- | ------------------------------------------------------ |
| `lib/gameEngine.ts`          | Core game logic (explosions, scoring, validation)      |
| `lib/types.ts`               | TypeScript interfaces (Cell, BoardState, Player, etc.) |
| `lib/store.ts`               | Zustand state management                               |
| `lib/rendering.ts`           | Canvas 2D rendering, animations, visual effects        |
| `lib/soundManager.ts`        | Web Audio API synthesized sound effects                |
| `lib/mockSocket.ts`          | Offline dev mock (AI opponent with 1s delay)           |
| `lib/constants.ts`           | Grid sizes, animation timings, colors, game settings   |
| `hooks/useSocket.ts`         | Socket.IO connection & event handling                  |
| `hooks/useGameLogic.ts`      | Game move handler, timer, sounds, rejoin hooks         |
| `components/Game.tsx`        | Main game component & phase routing                    |
| `components/GameCanvas.tsx`  | Canvas renderer & click handler                        |
| `components/GameOver.tsx`    | End screen with rankings & play again                  |
| `components/Lobby.tsx`       | Game lobby, room creation & join                       |
| `components/WaitingRoom.tsx` | Waiting for players, color picker, host start          |
| `components/GameHUD.tsx`     | Player scores, turn indicator                          |

### Backend Files

| File              | Purpose                                      |
| ----------------- | -------------------------------------------- |
| `server/index.ts` | Express + Socket.IO server                   |
|                   | Redis storage with in-memory Map fallback    |
|                   | Room management (create, join, color change) |
|                   | Move validation, processing & broadcast      |
|                   | Player connection / disconnection handling   |

---

## Socket.IO Events

### Client → Server

#### `player:join`

```typescript
{
  playerName: string;
}
```

#### `room:create`

```typescript
{
  roomName: string,
  maxPlayers?: number,   // 2–5, default 2
  color?: PlayerColor,   // default "blue"
  gridRows?: number,     // 3–15, default 9
  gridCols?: number,     // 3–15, default 6
}
```

#### `room:join`

```typescript
{
  roomId: string,
  playerName: string,
  color?: PlayerColor,
}
```

#### `game:start`

```typescript
{
  roomId: string;
}
```

#### `game:move`

```typescript
{
  roomId: string,
  move: {               // GameMove (nested object)
    playerId: string,
    row: number,
    col: number,
    timestamp: number,
  }
}
```

#### `chat:send`

```typescript
{ roomId: string, message: string }
```

### Server → Client

#### `player:joined`

```typescript
{ playerId: string, playerName: string }
```

#### `room:created`

```typescript
{
  room: GameRoom;
}
```

#### `room:updated`

```typescript
{
  room: GameRoom;
}
```

#### `game:started`

```typescript
{
  boardState: BoardState;
}
```

#### `game:moveResult` (Consolidated Event)

**Purpose**: Single atomic event combining all game state updates. Sent immediately after a move is processed and validated.

```typescript
{
  boardState: BoardState,             // Updated board state (grid, scores, currentPlayerIndex, etc.)
  explosionSequence: ExplosionStep[], // Array of all explosions in chain
  scores: Record<string, number>,     // Updated player scores (player ID → orb count)
  eliminatedPlayers: number[],        // Array of playerIndex for eliminated players
  winner: Player | null,              // Winner if game over, null otherwise
}
```

**Why consolidated?**

- **Atomic updates**: All game state changes in single event prevents race conditions
- **Animation sequencing**: Ensures explosion chain displays correctly
- **Event ordering**: No possibility of events arriving out of order
- **Game finish**: Winner field signals game end without separate event

**Eliminated Players Array**:

- Contains `playerIndex` values (0, 1, etc.) of players with 0 orbs who have moved
- Updated after each move's explosions complete
- Used for UI notifications ("Player 2 eliminated")
- Helps track game progression toward end state

**Example Payload**:

```typescript
{
  boardState: {
    grid: [[...], [...], ...],
    scores: { "player1_id": 12, "player2_id": 8 },
    currentPlayerIndex: 1,
    turnNumber: 5,
    gameStartedAt: 1710000000000,
    lastMoveAt: 1710000005000,
  },
  explosionSequence: [
    { row: 0, col: 3, playerIndex: 0, neighbors: [[1,3], [0,2], [0,4]] },
    { row: 0, col: 2, playerIndex: 0, neighbors: [[1,2], [0,1], [0,3]] },
  ],
  scores: { "player1_id": 12, "player2_id": 8 },
  eliminatedPlayers: [],  // No eliminations this move
  winner: null,           // Game not over yet
}
```

**When Sent**:

1. After successful move validation
2. After all explosions complete and chain reactions resolve
3. After scores are recalculated
4. After turn advances to next player (currentPlayerIndex updated)
5. Before saving room state to Redis/memory

#### `game:invalid-move`

```typescript
{
  reason: string;
}
```

#### `color:unavailable`

```typescript
{ message: string, takenColors: PlayerColor[] }
```

#### `chat:message`

```typescript
{
  id: string,
  playerId: string,
  playerName: string,
  message: string,
  timestamp: number,
}
```

---

## Examples

### Example 1: Simple Placement (No Explosion)

```
Initial Board (empty 9×6):
  0 1 2 3 4 5
0 . . . . . .
1 . . . . . .
2 . . . . . .
3 . . . . . .
4 . . . . . .
5 . . . . . .
6 . . . . . .
7 . . . . . .
8 . . . . . .

Player 0 places at (4, 3):
Grid after:
  [4][3] = { orbs: 1, owner: 0 }

Cell (4, 3) has:
  - Position: center (not edge, not corner)
  - Critical mass: 4
  - Current orbs: 1
  - Status: No explosion (1 < 4)

Result: Board updated, turn passes to Player 1
```

### Example 2: Explosion & Chain Reaction

```
Initial Board:
  (2, 2): { orbs: 2, owner: 0 } (Blue)
  (2, 3): { orbs: 1, owner: 1 } (Red)
  (3, 2): { orbs: 1, owner: 0 } (Blue)

Player 0 adds orb at (2, 2):
Grid after placement:
  (2, 2): { orbs: 3, owner: 0 }

Position (2, 2) check:
  - Critical mass: 4 (center cell)
  - Current orbs: 3
  - Status: No explosion yet (3 < 4)

Player 0 adds at (2, 2) again (next turn):
Grid after placement:
  (2, 2): { orbs: 4, owner: 0 }

EXPLOSION TRIGGERED at (2, 2)!
  - Adjacent cells: (1,2), (3,2), (2,1), (2,3)
  - Send 1 orb to each neighbor
  - Source becomes: { orbs: 0, owner: null }

Distribution:
  (1, 2): { orbs: 1, owner: 0 }     [was empty]
  (3, 2): { orbs: 2, owner: 0 }     [was 1@0, stays owned by 0]
  (2, 1): { orbs: 1, owner: 0 }     [was empty]
  (2, 3): { orbs: 2, owner: 0 }     [was 1@1, now CAPTURED by 0!]

Check neighbors for chain:
  - (1, 2): 1 orb, critical mass 4 → No
  - (3, 2): 2 orbs, critical mass 4 → No
  - (2, 1): 1 orb, critical mass 4 → No
  - (2, 3): 2 orbs, critical mass 4 → No

Final board:
  (1, 2): { orbs: 1, owner: 0 }
  (2, 1): { orbs: 1, owner: 0 }
  (2, 2): { orbs: 0, owner: null }
  (2, 3): { orbs: 2, owner: 0 }
  (3, 2): { orbs: 2, owner: 0 }

Scores:
  Player 0: 6 orbs
  Player 1: 0 orbs (was captured)
```

### Example 3: Multi-Chain Reaction

```
Setup (Player 0 = Blue, Player 1 = Red):
Board before move:
  (0, 2): { orbs: 2, owner: 1 }   ← top edge cell, critical mass = 3
  (0, 3): { orbs: 2, owner: 0 }   ← top edge cell, critical mass = 3
  (1, 3): { orbs: 1, owner: 0 }   ← center cell, critical mass = 4

Move: Player 0 places at (0, 3):
Grid after placement:
  (0, 3): { orbs: 3, owner: 0 }

Position (0, 3) evaluation:
  - Row 0 is top edge → mass-- (4 → 3)
  - Col 3 is not left/right edge → no change
  - Critical mass = 3
  - Current orbs: 3
  - Trigger: 3 >= 3 = TRUE

═══ EXPLOSION ROUND 1 at (0, 3) ═══
  Neighbors of (0, 3): (1, 3), (0, 2), (0, 4)  [no row -1, only 3 neighbors]

Distribution:
  (1, 3): { orbs: 2, owner: 0 }   [was 1@0 → now 2@0]
  (0, 2): { orbs: 3, owner: 0 }   [was 2@1 → CAPTURED! now 3@0]
  (0, 4): { orbs: 1, owner: 0 }   [was empty → 1@0]
  Source (0, 3): { orbs: 0, owner: null }

Check neighbors for chain:
  (1, 3): 2 orbs, critical mass 4 (center) → No
  (0, 2): 3 orbs, critical mass 3 (top edge) → 3 >= 3 = YES → CHAIN!
  (0, 4): 1 orb, critical mass 3 (top-edge) → No

═══ EXPLOSION ROUND 2 at (0, 2) ═══  [CHAIN REACTION!]
  Neighbors of (0, 2): (1, 2), (0, 1), (0, 3)  [no row -1, only 3 neighbors]

Distribution:
  (1, 2): { orbs: 1, owner: 0 }   [was empty → 1@0]
  (0, 1): { orbs: 1, owner: 0 }   [was empty → 1@0]
  (0, 3): { orbs: 1, owner: 0 }   [was empty → 1@0]
  Source (0, 2): { orbs: 0, owner: null }

Check neighbors for chain:
  (1, 2): 1 orb, critical mass 4 → No
  (0, 1): 1 orb, critical mass 3 → No
  (0, 3): 1 orb, critical mass 3 → No

Final board after all chains resolve:
  (0, 1): { orbs: 1, owner: 0 }
  (0, 3): { orbs: 1, owner: 0 }
  (0, 4): { orbs: 1, owner: 0 }
  (1, 2): { orbs: 1, owner: 0 }
  (1, 3): { orbs: 2, owner: 0 }

Scores:
  Player 0: 6 orbs (total board domination from this region)
  Player 1: 0 orbs (completely captured)

explosionSequence: [
  { row: 0, col: 3, playerIndex: 0, neighbors: [[1,3], [0,2], [0,4]] },
  { row: 0, col: 2, playerIndex: 0, neighbors: [[1,2], [0,1], [0,3]] },
]
```

### Example 4: Corner Explosion

```
Setup: Show corner cell behavior

Corner cell (0, 0):
  - Position: Top-left corner
  - Neighbors: only (1, 0) and (0, 1)
  - Critical mass: 2 (only 2 neighbors)
  - Can explode with just 2 orbs!

Example:
  (0, 0): { orbs: 2, owner: 0 }

EXPLOSION at (0, 0):
  - Sends 1 to (1, 0) and 1 to (0, 1)
  - Source: hard reset → { orbs: 0, owner: null }
  - (1, 0) and (0, 1) each get 1 orb owned by player 0

This is why corners are strategically important — they trigger with fewer orbs!
```

---

## Advanced Concepts

### Eliminated Players Tracking

When a player reaches 0 orbs after making at least one move, they become **eliminated**.

```typescript
export function getEliminatedPlayers(
  grid: Cell[][],
  players: Player[],
): number[] {
  const orbCounts = getOrbCountsPerPlayer(grid, players);
  return players
    .filter((p) => p.hasMovedOnce && orbCounts[p.id] === 0)
    .map((p) => players.indexOf(p));
}
```

**Elimination Rules**:

1. Player must have moved at least once (`hasMovedOnce = true`)
2. Player must have 0 orbs on the board
3. Eliminated players are skipped during turn advancement

**Game Flow with Eliminations (3 players)**:

- Eliminated players continue to exist in the `players` array
- They are skipped during turn advancement via `getNextActivePlayer()`
- Game continues until only 1 player remains with orbs
- Winner determination checks both `hasMovedOnce` and orb count

**Example**:

```
Players: [P0, P1, P2]
Move 1 (P0): Places orb → hasMovedOnce[0] = true
Move 2 (P1): Places orb, chain captures all of P2's future territory
             → hasMovedOnce[1] = true
Move 3 (P2): P2 still takes their turn normally!
             hasMovedOnce[2] = false → P2 CANNOT be skipped yet.
             Skip logic only applies when hasMovedOnce = true AND orbs = 0.
             P2 places their orb → hasMovedOnce[2] = true
Move 4 (P0): Chain reaction wipes out P1 → eliminatedPlayers = [1]
Move 5: Turn skips P1 (hasMovedOnce = true, orbCount = 0) → P2's turn
Move 6 (P2): Places orb
...continues...
Eventually: P0 has all orbs, P1 and P2 eliminated → P0 wins
```

### Captured Orbs

When you explode into an opponent's cell:

1. That cell's owner changes to your playerIndex
2. Orb count increases by 1 (the incoming orb)
3. Can trigger the opponent's cell to explode with your color
4. All subsequent chain explosions from that cell propagate as yours

**Result**: Chain reactions can cascade through opponent territory, converting cells one by one.

### Score & Territory

- **Score** = total orbs (all cells where `owner === yourIndex`, summed)
- **Territory** = all cells with `owner === yourIndex`
- Captured orbs instantly become your score
- Explosions can drastically change the board state in a single move

### Edge Cases

1. **Invalid placement**: Cannot place on opponent's cell → `game:invalid-move` sent back
2. **New player, 0 orbs**: If player hasn't moved yet (`hasMovedOnce = false`), they are **not** skipped and still get their turn
3. **Board saturation**: Game naturally limits by board size (e.g. 54 cells max for 9×6)
4. **Disconnection**: Player removed from tracking; room state preserved in Redis/memory
5. **Color conflict**: If chosen color is taken on room join, server auto-assigns first available color

### Event Consolidation History

**Previous Architecture**:

- `game:moveReceived` → board state updated
- `game:explosion` → explosion animation sequence
- `game:finished` → winner announcement
- **Problem**: Multiple events could arrive out of order → invisible explosions, race conditions

**Current Architecture**:

- `game:moveResult` → single atomic event with all data
- **Benefit**: Guaranteed atomic ordering, prevents race conditions
- **Data included**: boardState, explosionSequence, scores, eliminatedPlayers, winner
- **Timing**: Single event after all server-side processing completes
