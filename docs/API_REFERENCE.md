# API Reference

Complete reference for all exported functions, hooks, types, and events.

---

## Game Engine (`lib/gameEngine.ts`)

### Functions

#### `getCriticalMass(row, col, rows, cols): number`

Returns the critical mass for a cell based on its grid position.

- Corner cells: 2
- Edge cells: 3
- Interior cells: 4

#### `initializeBoard(rows, cols): Cell[][]`

Creates a 2D grid of empty cells.

#### `createBoardState(hostPlayerIndex, rows?, cols?): BoardState`

Creates a new board state. Defaults: `rows = 9`, `cols = 6`, `currentPlayerIndex = 0`.

#### `isValidMove(grid, row, col, playerIndex, rows, cols): boolean`

Validates if a move is legal. Valid if: in-bounds AND (cell empty OR cell owned by player).

#### `applyMove(boardState, move, playerIndex, players): ExplosionResult`

Applies a move and resolves all chain reactions via BFS. Returns new grid, scores, explosion sequence, eliminated players, and winner.

#### `computeScores(grid, players): Record<string, number>`

Counts total orbs per player.

#### `getOrbCountsPerPlayer(grid, players): Record<string, number>`

Same as `computeScores` — counts orbs per player.

#### `getNextActivePlayer(currentIndex, players, grid): number`

Returns the index of the next player to take a turn. Skips eliminated players (moved once + 0 orbs).

#### `isGameOver(grid, players): boolean`

Returns `true` when all players have moved at least once AND only 1 player has orbs.

#### `getWinner(grid, players): Player | null`

Returns the winning player if game is over.

#### `getEliminatedPlayers(grid, players): number[]`

Returns indices of players who have moved and have 0 orbs.

---

## State Management (`lib/store.ts`)

### Store Actions

| Action                 | Parameters                     | Description                       |
| ---------------------- | ------------------------------ | --------------------------------- |
| `setPhase`             | `GamePhase`                    | Set game phase                    |
| `setCurrentPlayer`     | `Player \| null`               | Set this client's player          |
| `setPlayers`           | `Player[]`                     | Set all players                   |
| `setRoom`              | `GameRoom \| null`             | Set current room                  |
| `setBoardState`        | `BoardState \| null`           | Set board state                   |
| `selectCell`           | `row, col`                     | Toggle cell selection             |
| `clearSelection`       | —                              | Clear selected cell               |
| `setSubmittingMove`    | `boolean`                      | Lock/unlock move submission       |
| `addToHistory`         | `GameMove`                     | Append move to history            |
| `clearHistory`         | —                              | Clear move history                |
| `setPendingAnimation`  | `AnimationFrame \| null`       | Set pending animation             |
| `setPendingGameFinish` | `{ outcome, winner? } \| null` | Set delayed game finish           |
| `setError`             | `string \| null`               | Set/clear error message           |
| `toggleSound`          | —                              | Toggle sound on/off               |
| `reset`                | —                              | Reset all state to initial values |

### Selectors (Hooks)

| Hook                                   | Returns                    | Description              |
| -------------------------------------- | -------------------------- | ------------------------ |
| `useGamePhase()`                       | `GamePhase`                | Current phase            |
| `useCurrentPlayer()`                   | `Player \| null`           | This client's player     |
| `useRoom()`                            | `GameRoom \| null`         | Current room             |
| `useBoardState()`                      | `BoardState \| null`       | Current board state      |
| `useSelectedCell()`                    | `[number, number] \| null` | Selected cell coords     |
| `useIsSubmittingMove()`                | `boolean`                  | Move submission lock     |
| `useGameError()`                       | `string \| null`           | Current error            |
| `useSoundEnabled()`                    | `boolean`                  | Sound toggle state       |
| `usePendingAnimation()`                | `AnimationFrame \| null`   | Pending animation        |
| `useGameHistory()`                     | `GameMove[]`               | Move history             |
| `useIsMyTurn(playerId?, playerIndex?)` | `boolean`                  | Is it this player's turn |
| `useScores()`                          | `Record<string, number>`   | Current scores           |

---

## Hooks (`hooks/`)

### `useSocket(): Socket | MockSocket`

Initializes and returns the global socket connection. Creates Socket.io connection on first call, falls back to `MockSocket` on failure.

### `useSocketEmit()`

Returns an object of emit helper functions:

```typescript
{
  joinAsPlayer(name: string): Promise<void>
  createRoom(name: string, maxPlayers?: number, color?: PlayerColor, gridRows?: number, gridCols?: number): void
  joinRoom(roomId: string, name: string, color?: PlayerColor): void
  startGame(roomId: string): void
  submitMove(roomId: string, move: GameMove): void
  sendChat(roomId: string, message: string): void
  changeColor(roomId: string, color: PlayerColor): void
  disconnect(): void
}
```

### `useGameMove(playerId: string)`

Returns `{ handleMove(row, col) }`. Validates basic move prerequisites, plays click sound, and submits the move.

### `useGameTimer()`

Sets a 30-second turn timeout. When timeout fires, auto-submits a random valid move for the current player.

### `useGameSounds(enabled: boolean)`

Returns sound effect trigger functions:

```typescript
{
  playExplosion(): void
  playChainReaction(): void
  playTurnChange(): void
  playGameOver(): void
  playClick(): void
}
```

### `useGameRejoin(playerId: string)`

Listens for page visibility changes. When the page becomes visible again, logs reconnection (Socket.io auto-reconnects).

---

## Rendering (`lib/rendering.ts`)

### `BoardRenderer`

| Method                              | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| `constructor(canvas, rows?, cols?)` | Initialize renderer with canvas and grid dimensions |
| `renderOnce(grid, players)`         | Update displayed grid and players                   |
| `setSelectedCell(row, col)`         | Highlight cell (or null, null to clear)             |
| `setGridColor(playerColor)`         | Set grid tint by player color name                  |
| `getCellFromPixel(x, y)`            | Convert pixel coords to `[row, col]` or null        |
| `hasActiveExplosions()`             | Check if explosion animations are running           |
| `destroy()`                         | Stop animation loop, clean up                       |

### `ScreenShaker`

| Method                          | Description                         |
| ------------------------------- | ----------------------------------- |
| `addShake(intensity, duration)` | Add a screen shake effect           |
| `getOffset()`                   | Get current shake offset `{ x, y }` |
| `clear()`                       | Remove all active shakes            |

### `ParticleSystem`

Stub class kept for API compatibility. Has `clear()` method only.

---

## Sound Manager (`lib/soundManager.ts`)

### `SoundManager`

| Method                              | Description                                 |
| ----------------------------------- | ------------------------------------------- |
| `setEnabled(enabled)`               | Enable/disable all sounds                   |
| `playTone(freq?, duration?, type?)` | Play a synthesized tone                     |
| `orbClick()`                        | 800Hz square, 80ms — placing an orb         |
| `explosion()`                       | 200Hz + 150Hz sine — cell exploding         |
| `chainReaction()`                   | Rising 400/500/600Hz tones — chain reaction |
| `turnChange()`                      | 500Hz + 600Hz sine — turn change            |
| `gameOver()`                        | Descending 500/400/300Hz — game ends        |
| `buttonClick()`                     | 600Hz square, 50ms — UI button              |
| `destroy()`                         | Close audio context                         |

### `getSoundManager(): SoundManager`

Returns the global singleton instance. Creates one if it doesn't exist.

---

## Constants (`lib/constants.ts`)

### Grid & Rendering

```typescript
GRID_SIZE = 6; // Default grid dimension
CELL_SIZE = 60; // Cell size in pixels
CELL_GAP = 4; // Gap between cells
BOARD_PADDING = 20; // Padding around board
```

### Animation Timings (ms)

```typescript
ANIMATION_DURATIONS = {
  orbMove: 400,
  orbSpawn: 300,
  orbExplode: 500,
  particleLife: 800,
  screenShake: 300,
  turnTransition: 1000,
};

ANIMATION_DELAYS = {
  chainReaction: 100, // delay between explosion waves
  particleEmit: 50,
};
```

### Game Settings

```typescript
GAME_SETTINGS = {
  maxPlayers: 5,
  turnTimeoutMs: 30000, // 30 seconds
  minPlayersToStart: 2,
  spawnProbability: 0.4,
  maxOrbMass: 4,
};
```

### Color Maps

```typescript
COLORS: Record<string, string>; // UI colors (blue, red, background, surface, etc.)
ORB_COLORS: Record<string, string>; // Per-player orb colors
PARTICLE_COLORS: Record<string, string[]>; // Per-player particle color arrays (3 shades each)
```

---

## Types (`lib/types.ts`)

### Core Types

```typescript
type GamePhase = "lobby" | "waiting" | "playing" | "gameover";
type PlayerRole = "host" | "guest";
type GameOutcome = "win" | "loss" | "draw";
type PlayerColor = "blue" | "red" | "green" | "yellow" | "purple";
```

### AVAILABLE_COLORS

```typescript
const AVAILABLE_COLORS: { value: PlayerColor; label: string; hex: string }[];
// blue:#3B82F6, red:#EF4444, green:#22C55E, yellow:#EAB308, purple:#A855F7
```

### Key Interfaces

| Interface          | Key Fields                                                                              |
| ------------------ | --------------------------------------------------------------------------------------- |
| `Player`           | `id, name, role, color, score, isActive, socketId?, hasMovedOnce`                       |
| `Cell`             | `orbs: number, owner: number \| null`                                                   |
| `BoardState`       | `grid, scores, currentPlayerIndex, turnNumber, gameStartedAt, lastMoveAt`               |
| `GameRoom`         | `id, name, host, guest?, players[], status, boardState, maxPlayers, gridRows, gridCols` |
| `GameMove`         | `playerId, row, col, timestamp`                                                         |
| `ExplosionResult`  | `scores, newGrid, explosionSequence, eliminatedPlayers, winner`                         |
| `ExplosionStep`    | `row, col, playerIndex, neighbors[]`                                                    |
| `ClientGameState`  | Full client state: phase, room, players, boardState, errors, etc.                       |
| `SocketEvents`     | All socket event types (client→server and server→client)                                |
| `ScreenShakeState` | `intensity, duration, startTime`                                                        |
| `ChatMessage`      | `id, playerId, playerName, message, timestamp`                                          |

---

## Central Exports (`lib/index.ts`)

The barrel export file re-exports from all modules:

```typescript
// Types
export * from "./types";

// Game Engine
export {
  initializeBoard,
  createBoardState,
  isValidMove,
  applyMove,
  getNextActivePlayer,
  isGameOver,
  getWinner,
  computeScores,
  getCriticalMass,
  getEliminatedPlayers,
} from "./gameEngine";

// Store
export {
  useGameStore,
  useGamePhase,
  useCurrentPlayer,
  useRoom,
  useBoardState,
  useSelectedCell,
  useIsSubmittingMove,
  useGameError,
  useSoundEnabled,
  usePendingAnimation,
  useGameHistory,
  useIsMyTurn,
  useScores,
} from "./store";

// Rendering
export { ParticleSystem, ScreenShaker, BoardRenderer } from "./rendering";

// Sound
export { getSoundManager, SoundManager } from "./soundManager";

// Constants
export * from "./constants";
```
