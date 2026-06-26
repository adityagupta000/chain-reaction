# Architecture

## System Overview

Chain Reaction uses a client-server architecture with real-time communication via WebSockets. The client is a Next.js 16 app that handles rendering, state management, and user interaction. The server is an Express + Socket.io backend that manages game rooms, validates moves, and broadcasts state changes.

```
┌─────────────────────────────────────────────────────┐
│  CLIENT (Next.js 16 / React 19)                     │
│                                                     │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │  Lobby   │  │  Waiting  │  │     Playing      │  │
│  │ (create/ │→ │   Room    │→ │  ┌────────────┐  │  │
│  │  join)   │  │ (players) │  │  │ GameCanvas │  │  │
│  └──────────┘  └───────────┘  │  │  (Canvas   │  │  │
│                               │  │   2D API)  │  │  │
│                               │  └─────┬──────┘  │  │
│                               │        │         │  │
│                               │  ┌─────▼──────┐  │  │
│                               │  │BoardRender │  │  │
│                               │  │  (60 fps)  │  │  │
│                               │  └────────────┘  │  │
│                               └──────────────────┘  │
│                                                     │
│  ┌───────────┐  ┌────────────┐  ┌──────────────┐    │
│  │  Zustand  │  │ useSocket  │  │ SoundManager │    │
│  │  Store    │  │   Hook     │  │ (Web Audio)  │    │
│  └─────┬─────┘  └─────┬──────┘  └──────────────┘    │
│        │               │                            │
└────────┼───────────────┼────────────────────────────┘
         │               │  Socket.io (WebSocket/polling)
         │               │
┌────────┼───────────────┼────────────────────────────┐
│        │               │                            │
│  ┌─────▼───────────────▼──────┐  ┌──────────────┐   │
│  │   Socket.io Server         │  │    Redis     │   │
│  │   (Express + node)         │←→│  (optional)  │   │
│  │                            │  │  state cache │   │
│  │   - Room management        │  └──────────────┘   │
│  │   - Move validation        │                     │
│  │   - Turn order enforcement │  ┌──────────────┐   │
│  │   - Game over detection    │  │  In-Memory   │   │
│  │   - Broadcasting           │←→│  Map fallback│   │
│  └────────────────────────────┘  └──────────────┘   │
│                                                     │
│  SERVER (Express 4 / Socket.io 4)                   │
└─────────────────────────────────────────────────────┘
```

## Game Phases

The game follows a linear phase flow managed by Zustand:

```
lobby → waiting → playing → gameover
  │                            │
  └────────────────────────────┘  (play again → reset)
```

| Phase      | Component                | Description                                                            |
| ---------- | ------------------------ | ---------------------------------------------------------------------- |
| `lobby`    | `Lobby`                  | Player enters name, creates or joins a room, picks color and grid size |
| `waiting`  | `WaitingRoom`            | Players wait for others, change colors, host starts game               |
| `playing`  | `GameCanvas` + `GameHUD` | Canvas renders the board, HUD shows scores and turn                    |
| `gameover` | `GameOver`               | Shows rankings, winner, and play-again button                          |

## Data Flow

### Move Lifecycle

```
1. Player clicks canvas
2. GameCanvas.handleCanvasClick()
   → BoardRenderer.getCellFromPixel(x, y) → [row, col]
   → submitMove(roomId, move) via useSocketEmit()

3. Socket.io emits "game:move" → server
4. Server validates:
   - Room exists, status is "playing"
   - Player is found in room
   - It's the player's turn (playerIndex === currentPlayerIndex)
   - Move is valid (empty cell or own cell, in bounds)
5. Server calls applyMove() → chain reactions resolve
6. Server updates board state, checks game-over
7. Server broadcasts "game:moveResult" to all clients in room

8. Client receives "game:moveResult"
   → Updates Zustand store (boardState, scores)
   → BoardRenderer detects grid changes
   → Queues explosion animations (orb flights, screen shake)
   → If winner exists, sets pendingGameFinish (waits for explosions to finish)

9. GameCanvas polls pendingGameFinish
   → When explosions complete → transitions to "gameover" phase
```

### State Management (Zustand)

The Zustand store (`lib/store.ts`) holds all client-side state:

```typescript
interface ClientGameState {
  phase: GamePhase; // "lobby" | "waiting" | "playing" | "gameover"
  room: GameRoom | null; // Current room info
  players: Player[]; // All players in room
  currentPlayer: Player | null; // This client's player
  boardState: BoardState | null; // Grid, scores, currentPlayerIndex, turnNumber
  pendingAnimation: AnimationFrame | null;
  gameHistory: GameMove[];
  error: string | null;
  selectedCell: [number, number] | null;
  isSubmittingMove: boolean;
  soundEnabled: boolean;
  pendingGameFinish: { outcome: string; winner?: any } | null;
}
```

Selectors are exported for common access patterns:

- `useGamePhase()`, `useRoom()`, `useBoardState()`, `useCurrentPlayer()`
- `useSelectedCell()`, `useIsSubmittingMove()`, `useGameError()`
- `useIsMyTurn(playerId, playerIndex)` — checks `currentPlayerIndex`
- `useScores()` — returns `boardState.scores`

### Rendering Pipeline

The `BoardRenderer` class (`lib/rendering.ts`) runs a 60fps `requestAnimationFrame` loop:

```
_loop(timestamp)
  ├── updateExplosions(dt)        // advance orb flights, ring expansion
  ├── updateCellAnimations(dt)    // orbit angle, pulse, spawn pop
  ├── update flash/vignette overlays
  └── drawFrame()
       ├── clear canvas + apply screen shake offset
       ├── drawGridLines()        // grid with turn-colored cells
       ├── drawCellsAndOrbs()     // ownership tint, critical mass dots, orbs
       │    └── drawOrbComplete() // 4-layer orb rendering per orb
       ├── drawExplosionEffects() // charge ring → scatter flights → impact flash
       ├── flash overlay (big chains)
       └── vignette overlay (medium chains)
```

## Key Architectural Decisions

1. **Canvas 2D over WebGL**: Simpler code, sufficient for a grid-based game with moderate animation needs. All rendering is in a single `BoardRenderer` class.

2. **Server-authoritative game logic**: The server runs `applyMove()`, `isGameOver()`, and `getNextActivePlayer()` — clients simply display the result. This prevents cheating.

3. **Zustand over Redux**: Lightweight, minimal boilerplate, perfect for this scale. No middleware needed.

4. **Synthesized audio over audio files**: `SoundManager` uses the Web Audio API to generate tones on the fly. No asset loading, no CORS issues, instant playback.

5. **MockSocket fallback**: When the Socket.io server is unavailable, the client automatically uses `MockSocket` which simulates a 2-player game locally. This makes development easy without running the server.

6. **Redis with in-memory fallback**: The server tries Redis first for room persistence. If Redis is unavailable, it falls back to an in-memory `Map`. This means the server works with or without Redis.

7. **Pending game finish pattern**: When a game-ending move occurs, the client stores it in `pendingGameFinish` and polls `BoardRenderer.hasActiveExplosions()`. The gameover screen only appears after all explosion animations complete.
