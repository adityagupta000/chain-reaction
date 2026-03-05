# Chain Reaction - Multiplayer Game

A fast-paced, real-time multiplayer strategy game built with Next.js, React, Socket.io, and Canvas.

## Features

- **Real-time Multiplayer**: Play with friends using Socket.io for instant synchronization
- **Canvas Rendering**: Smooth 60fps gameplay with GSAP-like animations
- **Game Logic Engine**: Pure, shareable game logic between client and server
- **Chain Reactions**: Click orbs to trigger explosive chain reactions using BFS algorithm
- **Turn-based Strategy**: Take turns making moves with automatic timeout
- **Sound Effects**: Web Audio API for dynamic sound generation
- **Responsive UI**: Beautiful dark-themed interface with Tailwind CSS

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main game page
│   └── globals.css         # Global styles
├── components/
│   ├── Game.tsx            # Main game orchestrator
│   ├── Lobby.tsx           # Room creation/joining
│   ├── WaitingRoom.tsx     # Wait for opponent
│   ├── GameCanvas.tsx      # Canvas rendering
│   ├── GameHUD.tsx         # Score/timer display
│   └── GameOver.tsx        # Game result screen
├── hooks/
│   ├── useSocket.ts        # Socket.io integration
│   ├── useGameLogic.ts     # Game logic hooks
│   └── use-*.ts            # Utility hooks
├── lib/
│   ├── types.ts            # TypeScript interfaces
│   ├── gameEngine.ts       # Core game logic (pure functions)
│   ├── store.ts            # Zustand state management
│   ├── rendering.ts        # Canvas rendering system
│   ├── soundManager.ts     # Audio effects
│   └── constants.ts        # Game constants
├── server/
│   └── index.ts            # Express + Socket.io server
└── public/
    └── sounds/             # Audio files
```

## Getting Started

### Prerequisites

- Node.js 18+
- Redis (for game state persistence)

### Installation

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Set up environment variables**
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

3. **Start Redis** (if you have it installed)
   ```bash
   redis-server
   ```

4. **Run development server**
   ```bash
   # Terminal 1: Next.js frontend
   pnpm dev

   # Terminal 2: Game server
   node --loader tsx server/index.ts
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Game Rules

### Objective
Earn the highest score by clicking orbs and creating chain reactions.

### How to Play
1. **Click** an orb to add it to your collection
2. **Connected** orbs of the same color create a **chain reaction**
3. **Chain reactions** spread to adjacent orbs using breadth-first search
4. Each orb is worth points equal to its **mass** (1-4)
5. Players take turns, with 30-second time limits per move
6. Game ends when no more moves are available

### Scoring
- Your score increases by the mass of all orbs in your chain reaction
- Neutral orbs count for everyone
- Highest score wins!

## Architecture

### Game Logic (Pure Functions)
The game logic in `lib/gameEngine.ts` is completely pure and shareable between client and server:
- `initializeBoard()` - Create a new game board
- `validateMove()` - Check if a move is legal
- `applyMove()` - Execute a move and calculate results
- `isGameOver()` - Check if the game has ended
- `getWinner()` - Determine the winner

### Rendering Pipeline
The Canvas rendering system (`lib/rendering.ts`) provides:
- **ParticleSystem** - Emit and animate particle effects
- **OrbAnimator** - Handle orb animations (movement, scale, opacity)
- **ScreenShaker** - Camera shake effects during explosions
- **BoardRenderer** - Main canvas rendering with all effects combined

### State Management
Uses **Zustand** (`lib/store.ts`) for client state:
- Game phase (lobby, waiting, playing, gameover)
- Board state and player info
- Selected cells and animations
- Error messages and user preferences

### Real-time Communication
**Socket.io** (`hooks/useSocket.ts`) handles:
- Room creation and joining
- Move submission and validation
- Board state synchronization
- Chat messages
- Player connection/disconnection

### Backend Server
Express + Socket.io server (`server/index.ts`):
- Manages game rooms with optional Redis persistence
- Validates all moves server-side
- Broadcasts board updates to both players
- Handles disconnection recovery

## API Routes

### Socket.io Events

**Emit (Client to Server)**
- `player:join` - Join as a named player
- `room:create` - Create a new game room
- `room:join` - Join an existing room
- `game:start` - Start the game (host only)
- `game:move` - Submit a move
- `chat:send` - Send a chat message

**Listen (Server to Client)**
- `room:created` - Room was created successfully
- `room:updated` - Room state changed
- `game:started` - Game has begun
- `game:moveReceived` - Move was processed
- `game:invalid-move` - Move was rejected
- `game:finished` - Game has ended
- `chat:message` - Chat message received

## Performance Tips

1. **Canvas Rendering**: Decoupled from network - renders at 60fps regardless of server timing
2. **Optimistic UI**: Client predicts moves immediately, validates against server
3. **Redis Caching**: Game state persisted for auto-rejoin on disconnect
4. **Lazy Animation**: Particle effects only run when needed

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires Canvas, Web Audio API, and WebSocket support.

## Contributing

This is a complete game implementation. Feel free to extend with:
- More orb types and special abilities
- Leaderboards and statistics
- Custom themes and skins
- AI single-player mode
- Mobile touch optimizations

## License

MIT
