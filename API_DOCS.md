# Chain Reaction - API Documentation

## Socket.io Events

All Socket.io communication happens between client and server. The server validates all moves and broadcasts updates to both players.

### Client → Server Events

#### `player:join`
Authenticate a player by name.

**Emit:**
```typescript
socket.emit('player:join', {
  playerName: string
});
```

**Response:** None (implicit success). Listen for `room:created` or other events.

---

#### `room:create`
Create a new game room (host becomes host).

**Emit:**
```typescript
socket.emit('room:create', {
  roomName: string  // User-friendly room name
});
```

**Response:** `room:created` event with room details.

---

#### `room:join`
Join an existing room as guest.

**Emit:**
```typescript
socket.emit('room:join', {
  roomId: string,      // Room ID from host
  playerName: string   // Your player name
});
```

**Response:** `room:updated` event with updated room state.

**Errors:**
- "Room not found" - Invalid room ID
- "Room is full" - 2 players already in room

---

#### `game:start`
Start the game (host only).

**Emit:**
```typescript
socket.emit('game:start', {
  roomId: string
});
```

**Response:** `game:started` event with initial board state.

**Errors:**
- "Invalid room state" - Game already started
- "Waiting for second player" - Only 1 player in room

---

#### `game:move`
Submit a move (your turn only).

**Emit:**
```typescript
socket.emit('game:move', {
  roomId: string,
  move: {
    playerId: string,    // Your player ID
    row: number,         // 0-5
    col: number,         // 0-5
    timestamp: number    // Date.now()
  }
});
```

**Response:** Either `game:moveReceived` (valid) or `game:invalid-move` (invalid).

**Validation:**
- Cell must contain an orb
- Orb must be your color or neutral
- Must be your turn
- Game must be in progress

---

#### `chat:send`
Send a chat message to room.

**Emit:**
```typescript
socket.emit('chat:send', {
  roomId: string,
  message: string
});
```

**Response:** `chat:message` broadcast to all players.

---

### Server → Client Events

#### `room:created`
A room was successfully created.

**Data:**
```typescript
{
  room: GameRoom {
    id: string;
    name: string;
    host: Player;
    status: 'waiting' | 'playing' | 'finished';
    boardState: BoardState;
    createdAt: number;
    maxPlayers: 2;
  }
}
```

---

#### `room:updated`
Room state changed (player joined, started, etc).

**Data:**
```typescript
{
  room: GameRoom  // Full room object
}
```

**Triggers:**
- Player joined
- Game started
- Opponent disconnected
- Game finished

---

#### `game:started`
Game has begun. Board is initialized.

**Data:**
```typescript
{
  boardState: BoardState {
    grid: (Orb | null)[][];
    scores: { [playerId]: number };
    turn: string;          // Current player ID
    turnNumber: number;
    gameStartedAt: number;
    lastMoveAt: number;
  }
}
```

---

#### `game:moveReceived`
Your move was valid and processed.

**Data:**
```typescript
{
  move: GameMove;
  boardState: BoardState;  // Updated board
  scores: { [playerId]: number };
}
```

**Note:** Board is updated automatically. Animate changes and emit next turn.

---

#### `game:invalid-move`
Your move was rejected.

**Data:**
```typescript
{
  reason: string  // "Not your turn" | "Out of bounds" | "Cell is empty" | "Not your orb"
}
```

**Action:** Clear selection, show error message, allow retry.

---

#### `game:finished`
Game has ended.

**Data:**
```typescript
{
  outcome: 'win' | 'loss' | 'draw';
  winner?: {
    id: string;
    name: string;
  };
}
```

---

#### `chat:message`
A chat message was sent.

**Data:**
```typescript
{
  id: string;              // Unique message ID
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}
```

---

#### `error`
A generic error occurred.

**Data:**
```typescript
{
  message: string
}
```

---

## Game Logic API

Pure functions from `lib/gameEngine.ts`. Fully shareable between client and server.

### `initializeBoard(): (Orb | null)[][]`
Create a new 6x6 game board with random orbs.

```typescript
const board = initializeBoard();
// Returns 6x6 grid with ~40% spawn probability
```

---

### `createBoardState(hostId: string): BoardState`
Initialize game state for new game.

```typescript
const boardState = createBoardState(player1Id);
```

**Returns:**
```typescript
{
  grid: (Orb | null)[][];
  scores: { [playerId]: 0 };
  turn: hostId;
  turnNumber: 0;
  gameStartedAt: Date.now();
  lastMoveAt: Date.now();
}
```

---

### `validateMove(move, boardState, currentPlayerId): MoveValidationResult`
Check if a move is legal.

```typescript
const result = validateMove(move, boardState, boardState.turn);
if (result.valid) {
  // Safe to execute
} else {
  console.log(result.reason); // "Not your turn", "Cell is empty", etc
}
```

---

### `applyMove(boardState, move, playerColor): ExplosionResult`
Execute a move and calculate results.

```typescript
const result = applyMove(boardState, move, 'blue');
// Returns new board, scores, affected cells
```

**Returns:**
```typescript
{
  scores: { [playerId]: newScore };
  newGrid: (Orb | null)[][];
  cellsAffected: Set<"row,col">;
}
```

---

### `getNextTurn(currentPlayerId, playerIds): string`
Get next player's ID.

```typescript
const nextId = getNextTurn(boardState.turn, [player1Id, player2Id]);
boardState.turn = nextId;
```

---

### `getValidMoves(boardState): [number, number][]`
List all valid moves (cells with orbs).

```typescript
const moves = getValidMoves(boardState);
// [[0,0], [0,2], [1,1], ...]
```

---

### `isGameOver(boardState): boolean`
Check if game has ended.

```typescript
if (isGameOver(boardState)) {
  // Show game over screen
}
```

**Condition:** No valid moves remain.

---

### `getWinner(scores, players): Player | null`
Determine winner by highest score.

```typescript
const winner = getWinner(boardState.scores, [player1, player2]);
if (winner) {
  console.log(`${winner.name} wins!`);
} else {
  console.log("It's a draw!");
}
```

---

## State Management API

Zustand store hooks for React components.

### `useGameStore()`
Access full game state.

```typescript
const gameState = useGameStore();
const phase = gameState.phase;
const room = gameState.room;
// ... all state
```

---

### Selector Hooks

```typescript
// Phase
const phase = useGamePhase(); // 'lobby' | 'waiting' | 'playing' | 'gameover'

// Players
const currentPlayer = useCurrentPlayer();
const players = useGameStore((s) => s.players);

// Room
const room = useRoom();

// Board
const boardState = useBoardState();
const selectedCell = useSelectedCell(); // [row, col] | null
const scores = useScores(); // { playerId: score }

// UI State
const error = useGameError(); // null | string
const isSubmittingMove = useIsSubmittingMove();
const soundEnabled = useSoundEnabled();
const history = useGameHistory(); // GameMove[]

// Computed
const isMyTurn = useIsMyTurn(playerId); // boolean
const pendingAnimation = usePendingAnimation();
```

---

### State Setters

```typescript
const store = useGameStore();

store.setPhase('playing');
store.setRoom(room);
store.setBoardState(boardState);
store.setCurrentPlayer(player);
store.selectCell(row, col);
store.clearSelection();
store.setSubmittingMove(true);
store.addToHistory(move);
store.clearHistory();
store.setPendingAnimation(animation);
store.setError('Invalid move');
store.toggleSound();
store.reset();
```

---

## Socket.io Hook API

Connection and event handling.

### `useSocket(): Socket | null`
Initialize Socket.io connection.

```typescript
useEffect(() => {
  const socket = useSocket();
  // Listeners auto-registered
}, []);
```

---

### `useSocketEmit()`
Access emit functions.

```typescript
const {
  joinAsPlayer,
  createRoom,
  joinRoom,
  startGame,
  submitMove,
  sendChat,
  disconnect
} = useSocketEmit();

// Usage
joinAsPlayer('Alice');
createRoom('Game Room 1');
joinRoom(roomId, 'Bob');
startGame(roomId);
submitMove(roomId, move);
sendChat(roomId, 'Good game!');
```

---

## Rendering API

Canvas rendering system.

### `BoardRenderer`

```typescript
const renderer = new BoardRenderer(canvasElement);

// Rendering loop
function animate() {
  renderer.render(boardState.grid);
}

// Interactions
renderer.setSelectedCell(row, col);
renderer.emitParticles(row, col, 'blue');
renderer.addScreenShake();

// Cleanup
renderer.destroy();
```

---

### `ParticleSystem`

```typescript
const particles = new ParticleSystem();

// Emit particles at position
particles.emit(x, y, color, count, velocity);

// Update (called from animation loop)
particles.update(deltaTime);

// Render
particles.render(ctx);

// Clear
particles.clear();
```

---

### `OrbAnimator`

```typescript
const animator = new OrbAnimator();

// Add animation
animator.addAnimation(row, col, targetRow, targetCol, duration);

// Update (called from animation loop)
animator.update(deltaTime);

// Clear
animator.clear();
```

---

### `ScreenShaker`

```typescript
const shaker = new ScreenShaker();

// Trigger shake
shaker.addShake(intensity, duration);

// Get offset
const { x, y } = shaker.getOffset();
ctx.translate(x, y);
```

---

## Sound API

Web Audio synthesizer.

### `getSoundManager(): SoundManager`

```typescript
const soundManager = getSoundManager();

soundManager.setEnabled(true);
soundManager.orbClick();
soundManager.explosion();
soundManager.chainReaction();
soundManager.turnChange();
soundManager.gameOver();
soundManager.buttonClick();
soundManager.destroy();
```

---

## Type Definitions

### Core Types

```typescript
interface Player {
  id: string;
  name: string;
  role: 'host' | 'guest';
  color: 'blue' | 'red';
  score: number;
  isActive: boolean;
  socketId?: string;
}

interface Orb {
  color: 'blue' | 'red' | 'neutral';
  mass: number; // 1-4
}

interface GameMove {
  playerId: string;
  row: number;
  col: number;
  timestamp: number;
}

interface BoardState {
  grid: (Orb | null)[][];
  scores: Record<string, number>;
  turn: string;
  turnNumber: number;
  gameStartedAt: number;
  lastMoveAt: number;
}

interface GameRoom {
  id: string;
  name: string;
  host: Player;
  guest?: Player;
  status: 'waiting' | 'playing' | 'finished';
  boardState: BoardState;
  createdAt: number;
  maxPlayers: number;
}
```

---

## Error Handling

### Client-side

```typescript
// Listen for errors
const error = useGameError();
if (error) {
  // Show error toast/alert
  store.setError(null); // Clear after showing
}
```

### Server-side

```typescript
// Validate before operations
const validation = validateMove(move, boardState, turn);
if (!validation.valid) {
  socket.emit('game:invalid-move', { reason: validation.reason });
  return;
}
```

---

## Best Practices

1. **Always validate on server** - Never trust client moves
2. **Use selectors** - Avoid re-renders with Zustand selectors
3. **Clean up listeners** - Remove socket listeners on unmount
4. **Handle disconnections** - Assume network can be unreliable
5. **Optimize rendering** - Use Canvas carefully for performance
6. **Type everything** - Leverage TypeScript for safety

---

## Performance Metrics

- **Canvas FPS**: 60fps (decoupled from network)
- **Move latency**: 50-100ms typical
- **Payload size**: 100-200 bytes per move
- **Memory**: ~2MB for game state + UI

---

See `GAME_README.md` and `SETUP.md` for more details!
