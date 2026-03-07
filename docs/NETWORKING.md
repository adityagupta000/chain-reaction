# Networking

The game uses **Socket.io 4** for real-time client-server communication. The server runs on Express and handles room management, move validation, and state broadcasting. An offline `MockSocket` provides development without a server.

## Server (`server/index.ts`)

### Stack

- **Express 4** — HTTP server, health check, room listing API
- **Socket.io 4** — WebSocket with long-polling fallback
- **Redis (ioredis 5)** — Game state persistence (1-hour TTL)
- **In-memory Map** — Automatic fallback when Redis is unavailable

### CORS

```typescript
cors: {
  origin: process.env.NODE_ENV === "production" ? false : "*",
  methods: ["GET", "POST"]
}
```

### Redis Configuration

```typescript
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: () => null, // Don't retry
  enableReadyCheck: false,
  enableOfflineQueue: false,
});
```

Redis errors are silently swallowed — all operations fall back to the in-memory `Map<string, GameRoom>`.

### REST Endpoints

| Endpoint         | Description                 |
| ---------------- | --------------------------- |
| `GET /health`    | Returns `{ status: "ok" }`  |
| `GET /api/rooms` | Returns all rooms in memory |

## Socket.io Events

### Client → Server

| Event          | Payload                                                   | Description                      |
| -------------- | --------------------------------------------------------- | -------------------------------- |
| `player:join`  | `{ playerName }`                                          | Register player, get assigned ID |
| `room:create`  | `{ roomName, maxPlayers?, color?, gridRows?, gridCols? }` | Create a new room                |
| `room:join`    | `{ roomId, playerName, color? }`                          | Join an existing room            |
| `color:change` | `{ roomId, color }`                                       | Change color in waiting room     |
| `game:start`   | `{ roomId }`                                              | Host starts the game             |
| `game:move`    | `{ roomId, move: GameMove }`                              | Submit a move                    |
| `chat:send`    | `{ roomId, message }`                                     | Send a chat message              |

### Server → Client

| Event               | Payload                                                                | Description                                                  |
| ------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| `player:joined`     | `{ playerId, playerName }`                                             | Acknowledgment with assigned player ID                       |
| `room:created`      | `{ room: GameRoom }`                                                   | Room creation confirmed                                      |
| `room:updated`      | `{ room: GameRoom }`                                                   | Room state changed (new player, color change, etc.)          |
| `color:unavailable` | `{ message, takenColors[] }`                                           | Requested color is taken; includes auto-assigned alternative |
| `game:started`      | `{ boardState }`                                                       | Game has begun                                               |
| `game:moveResult`   | `{ boardState, scores, explosionSequence, eliminatedPlayers, winner }` | Move result broadcast to all players                         |
| `game:invalid-move` | `{ reason }`                                                           | Move was rejected                                            |
| `chat:message`      | `ChatMessage`                                                          | Chat message broadcast                                       |
| `error`             | `{ message }`                                                          | General error                                                |

### Move Processing Flow

```
1. Client emits "game:move" { roomId, move: { playerId, row, col, timestamp } }

2. Server validates:
   a. Room exists and status === "playing"
   b. Player found in room.players
   c. playerIndex === boardState.currentPlayerIndex  (turn order)
   d. isValidMove(grid, row, col, playerIndex, rows, cols)

3. Server processes:
   a. applyMove(boardState, move, playerIndex, players) → ExplosionResult
   b. Update grid, scores
   c. Mark player.hasMovedOnce = true
   d. Advance turn: getNextActivePlayer()
   e. Increment turnNumber, update lastMoveAt

4. Check game over:
   - If isGameOver() → set room.status = "finished", get winner
   - Either way → emit "game:moveResult" to all in room

5. Save room to Redis + in-memory
```

### Room Creation Flow

```
1. Client emits "player:join" → server assigns nanoid, stores socketId
2. Server emits "player:joined" → client stores playerId in localStorage
3. Client emits "room:create" { roomName, maxPlayers, color, gridRows, gridCols }
4. Server creates GameRoom with host player, saves to Redis
5. Server emits "room:created" + "room:updated" to room
```

### Room Join Flow

```
1. Guest emits "player:join" → gets playerId
2. Guest emits "room:join" { roomId, playerName, color }
3. Server checks:
   - Room exists
   - Room not full (players.length < maxPlayers)
   - Color availability (auto-picks if taken)
4. Server adds guest to room.players, saves
5. Server emits "room:updated" to all in room
```

### Color Conflict Resolution

When a player requests a taken color:

1. Server finds first available color from `["blue", "red", "green", "yellow", "purple"]`
2. Assigns that color to the player
3. Emits `color:unavailable` with a message explaining the auto-assignment

## Client Socket (`hooks/useSocket.ts`)

### Connection Strategy

```typescript
const socket = io(
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001",
  {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 3,
    transports: ["websocket", "polling"],
  },
);
```

If Socket.io fails to connect (after import or connection errors), the client falls back to `MockSocket`.

### Global Socket Pattern

The socket is stored in a module-level `globalSocket` variable to ensure a single connection across all components. The `useSocket()` hook returns a ref to this global instance.

### Emit Helpers (`useSocketEmit`)

Returns an object with typed methods:

| Method                                            | Parameters            | Description                                        |
| ------------------------------------------------- | --------------------- | -------------------------------------------------- |
| `joinAsPlayer(name)`                              | `string`              | Async — waits for `player:joined` ack (1s timeout) |
| `createRoom(name, maxPlayers, color, rows, cols)` | Various               | Create room                                        |
| `joinRoom(roomId, name, color)`                   | Various               | Join room                                          |
| `startGame(roomId)`                               | `string`              | Host starts                                        |
| `submitMove(roomId, move)`                        | `string, GameMove`    | Submit a move                                      |
| `sendChat(roomId, message)`                       | `string, string`      | Chat                                               |
| `changeColor(roomId, color)`                      | `string, PlayerColor` | Change color                                       |
| `disconnect()`                                    | —                     | Disconnect                                         |

### joinAsPlayer Connection Handling

`joinAsPlayer()` is async and handles connection timing:

1. Checks if `globalSocket` exists (retries after 200ms if not)
2. Polls for socket connection (up to 50 attempts × 100ms = 5s)
3. Once connected, emits `player:join` and waits for `player:joined` ack
4. Falls back after 1s timeout if ack doesn't arrive

## Mock Socket (`lib/mockSocket.ts`)

The `MockSocket` class simulates the server for offline development. It implements the same event interface as Socket.io.

### Features

- Creates rooms with a host player
- Adds an AI guest player automatically on room creation
- Validates moves (turn order, cell ownership)
- Processes game logic locally via `applyMove()`
- Simulates opponent moves after a 1-second delay
- Detects game over and emits appropriate events

### Differences from Real Server

| Feature       | Real Server        | MockSocket                   |
| ------------- | ------------------ | ---------------------------- |
| Players       | 2–5 real players   | 1 human + 1 AI               |
| Validation    | Full server-side   | Client-side simulation       |
| Persistence   | Redis + memory     | None (session only)          |
| Latency       | Network round-trip | Immediate (~300ms simulated) |
| Color changes | Broadcast to all   | Local only                   |

### AI Opponent

The mock socket simulates an opponent by:

1. Waiting 1 second after the human moves
2. Finding all valid cells for the AI player
3. Picking a random valid cell
4. Calling `applyMove()` locally
5. Emitting `game:moveResult` with the updated state
