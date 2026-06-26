# Components

All React components are client-side (`"use client"`) and live in the `components/` directory.

## Game (`Game.tsx`)

The root game component. Acts as a **phase router** — renders different components based on the current game phase.

### Behavior

1. Initializes the socket connection via `useSocket()`
2. Retrieves `playerId` from `localStorage` (set by `player:joined` handler)
3. Polls localStorage every 300ms until `playerId` is available
4. Computes `currentPlayerIndex` and `isMyTurn` from room data
5. Renders the component matching the current phase

### Phase Routing

| Phase      | Rendered Component               |
| ---------- | -------------------------------- |
| `lobby`    | `<Lobby />`                      |
| `waiting`  | `<WaitingRoom />`                |
| `playing`  | `<GameHUD />` + `<GameCanvas />` |
| `gameover` | `<GameOver />`                   |

### Loading State

Shows "INITIALIZING..." with animated background while waiting for hydration and playerId.

---

## Lobby (`Lobby.tsx`)

The entry screen where players create or join game rooms.

### UI Sections

1. **Name input** — player display name
2. **Mode selector** — "CREATE ROOM" / "JOIN ROOM" buttons
3. **Create Room form**:
   - Room name input
   - Player count selector: `2P`, `3P`, `4P`, `5P`
   - Grid size presets: `6×6`, `8×5`, `9×6`, `10×8`, `12×8`
   - Color picker (5 colors)
4. **Join Room form**:
   - Room ID input
   - Color picker

### State

```typescript
const [playerName, setPlayerName] = useState("");
const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
const [maxPlayers, setMaxPlayers] = useState(2);
const [selectedColor, setSelectedColor] = useState<PlayerColor>("blue");
const [gridRows, setGridRows] = useState(9);
const [gridCols, setGridCols] = useState(6);
```

### Flow

1. User enters name and clicks "CREATE ROOM"
2. `joinAsPlayer(name)` is called (async — waits for server ack)
3. `createRoom(name, maxPlayers, color, gridRows, gridCols)` is emitted
4. Server responds with `room:created` → Zustand store transitions to `waiting` phase

### ColorPicker Component

Renders 5 color buttons from `AVAILABLE_COLORS`. Disabled state depends on `isLoading`.

---

## WaitingRoom (`WaitingRoom.tsx`)

Displayed between room creation and game start. Shows who's in the room and lets players change colors.

### UI Sections

1. **Room header**: Room name, player count, grid dimensions
2. **Room ID**: Copy-to-clipboard button
3. **Player list**: Shows connected players with their colors in `PlayerCard`s
4. **Empty slots**: "WAITING..." placeholders for unfilled positions
5. **Color selector**: Change your color (taken colors are dimmed)
6. **Start button** (host only): Enabled when ≥ 2 players present

### Key Behaviors

- Only the **host** can start the game
- Color changes emit `color:change` → server validates → broadcasts `room:updated`
- Taken colors show as 20% opacity and are non-clickable
- `navigator.clipboard.writeText()` for room ID copying

---

## GameCanvas (`GameCanvas.tsx`)

The main gameplay component. Wraps an HTML `<canvas>` element and manages the `BoardRenderer`.

### Props

```typescript
interface GameCanvasProps {
  roomId: string;
  playerId: string;
  playerColor: PlayerColor;
  isMyTurn: boolean;
}
```

### Initialization

1. Creates `BoardRenderer` on mount (re-creates if `gridRows`/`gridCols` change)
2. Installs a single click handler via `useEffect([], ...)` that reads from refs
3. Refs keep `isMyTurn`, `boardState`, `isSubmitting`, `playerId`, `roomId` current without reinstalling the handler

### Click Handling

```
Canvas click → getBoundingClientRect()
  → getCellFromPixel(x, y) → [row, col]
  → submitMove(roomId, { playerId, row, col, timestamp })
```

If it's not the player's turn, shows a "Not your turn!" toast for 1.5s instead.

### State Sync

- `boardState` changes → calls `rendererRef.current.renderOnce(grid, players)`
- `currentPlayerIndex` changes → calls `rendererRef.current.setGridColor(turnPlayer.color)`
- `selectedCell` changes → calls `rendererRef.current.setSelectedCell(row, col)`

### Pending Game Finish

Polls every 50ms via `setInterval`:

1. Checks `useGameStore.getState().pendingGameFinish`
2. Checks `rendererRef.current.hasActiveExplosions()`
3. When pending finish exists AND no active explosions → transitions to `gameover`

### Warning Toasts

- **Turn warning**: "Not your turn!" — red toast, 1.5s
- **Error warning**: Shows `gameError` from store — red toast, 2.5s

---

## GameHUD (`GameHUD.tsx`)

Top bar during gameplay, showing player information and turn indicator.

### Props

```typescript
interface GameHUDProps {
  playerId: string;
}
```

### Display

- **Left**: Player list — each player shows:
  - Colored dot (from `AVAILABLE_COLORS` hex)
  - Player name (with "(You)" suffix if matches `playerId`)
  - Score (from `boardState.scores`)
  - Active turn highlight (background tint + pulsing dot)
- **Right**: Turn indicator — "Your Turn" or "{name}'s Turn"

---

## GameOver (`GameOver.tsx`)

Results screen after the game ends.

### Display

1. **Winner announcement**: "🏆 {NAME} WINS! 🏆" or "IT'S A DRAW!"
2. **Rankings table**: Players sorted by score descending
   - Each row shows rank (#1–#5), colored dot, name, score
   - Winner row has a gold ring highlight
3. **Play Again button**: Calls `reset()` on the Zustand store and redirects to `/`

### Components

- `AnimatedBackground` — animated CSS background
- `Confetti` — celebratory particle effect
- `ScoreRow` — individual player score display

---

## Supporting Components

### AnimatedBackground

CSS-based animated background with radial gradients and motion effects. Used in Lobby, WaitingRoom, and GameOver screens.

### Confetti

Celebratory confetti particle effect displayed on the GameOver screen.

### theme-provider

Next-themes integration for dark/light mode support (wraps the app in `layout.tsx`).
