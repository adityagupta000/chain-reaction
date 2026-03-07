# Chain Reaction — Multiplayer Strategy Game

A real-time multiplayer **chain reaction** strategy game built with Next.js 16, React 19, Canvas 2D, and Socket.io. Players take turns placing orbs on a grid — when a cell reaches critical mass, it explodes and sends orbs to its neighbors, capturing them. The last player standing wins.

## Features

- **2–5 player** real-time multiplayer via Socket.io
- **Configurable grid sizes**: 6×6, 8×5, 9×6, 10×8, 12×8
- **BFS chain reaction explosions** with animated orb flights, screen shake, and visual effects
- **Custom orb rendering**: 4-layer system (glow → body gradient → rotating texture → specular highlight)
- **Orbiting multi-orb cells** with speed that increases near critical mass
- **Per-turn grid color** that reflects the current player's color
- **Web Audio API** synthesized sound effects (no audio files needed)
- **Offline / mock socket** mode for development without a server
- **Redis-backed** game state persistence with automatic in-memory fallback

## Tech Stack

| Layer       | Technology                                |
| ----------- | ----------------------------------------- |
| Framework   | Next.js 16.1.6, React 19, TypeScript 5.7  |
| Rendering   | Canvas 2D API (`BoardRenderer` class)     |
| State       | Zustand 4                                 |
| Networking  | Socket.io 4 (client + server)             |
| Server      | Express 4, Node.js                        |
| Persistence | Redis (ioredis 5) with in-memory fallback |
| Styling     | Tailwind CSS 4, shadcn/ui                 |
| Audio       | Web Audio API (synthesized tones)         |
| Build       | Turbopack (Next.js dev), pnpm             |

## Quick Start

```bash
# Install dependencies
pnpm install

# Run client + server together
pnpm dev:both

# Or run separately
pnpm dev           # Next.js on http://localhost:3000
pnpm dev:server    # Socket.io on http://localhost:3001
```

If no server is running, the game automatically falls back to a **MockSocket** for offline play.

## Project Structure

```
chain-reaction/
├── app/                    # Next.js app router
│   ├── layout.tsx          # Root layout with theme provider
│   ├── page.tsx            # Entry point → <Game />
│   └── globals.css         # Global styles
├── components/             # React components
│   ├── Game.tsx            # Phase router (lobby/waiting/playing/gameover)
│   ├── Lobby.tsx           # Room creation/joining, color picker, grid size
│   ├── WaitingRoom.tsx     # Pre-game lobby with player list
│   ├── GameCanvas.tsx      # Canvas wrapper with click handling
│   ├── GameHUD.tsx         # Top bar with scores and turn indicator
│   └── GameOver.tsx        # Results screen with rankings
├── hooks/                  # Custom React hooks
│   ├── useSocket.ts        # Socket.io initialization + emit helpers
│   └── useGameLogic.ts     # Game move, timer, sound, rejoin hooks
├── lib/                    # Core libraries
│   ├── types.ts            # All TypeScript interfaces
│   ├── gameEngine.ts       # Pure game logic (moves, explosions, scoring)
│   ├── rendering.ts        # BoardRenderer — Canvas 2D rendering engine
│   ├── store.ts            # Zustand state management
│   ├── soundManager.ts     # Web Audio API sound effects
│   ├── mockSocket.ts       # Offline mock socket for development
│   ├── constants.ts        # Grid sizes, animation timings, colors
│   ├── index.ts            # Central barrel exports
│   └── utils.ts            # Utility functions (cn, etc.)
├── server/
│   └── index.ts            # Express + Socket.io + Redis backend
├── public/                 # Static assets
└── docs/                   # Documentation (you are here)
    ├── README.md           # This file — project overview
    ├── ARCHITECTURE.md     # System architecture & data flow
    ├── GAME_ENGINE.md      # Game logic & chain reactions
    ├── RENDERING.md        # Canvas rendering engine
    ├── NETWORKING.md       # Socket.io events & room system
    ├── COMPONENTS.md       # React components reference
    ├── API_REFERENCE.md    # Complete API reference
    ├── SETUP_AND_DEPLOYMENT.md  # Setup, env vars, deployment
    └── CHANGELOG.md        # Version history & changes
```

## Game Rules

1. Players take turns placing orbs on the grid
2. You can place on **empty cells** or **cells you own**
3. Each cell has a **critical mass** equal to its number of neighbors (corners: 2, edges: 3, center: 4)
4. When a cell reaches critical mass, it **explodes** — sending 1 orb to each neighbor and becoming empty
5. Orbs that land on opponent cells **capture** them
6. Explosions can **chain react** across the board
7. The game cannot end until every player has moved at least once
8. A player is **eliminated** when they have 0 orbs remaining (after having moved)
9. Last player standing **wins**

## Player Colors

| Color  | Hex (Rendering) | Hex (UI)           |
| ------ | --------------- | ------------------ |
| Red    | `#FF4444`       | `#EF4444`          |
| Blue   | `#4488FF`       | `#3B82F6`          |
| Green  | `#44FF88`       | `#22C55E`          |
| Yellow | `#FFD700`       | `#EAB308`          |
| Purple | `#CC44FF`       | `#A855F7`          |
| Orange | `#FF8844`       | — (rendering only) |

## Documentation

| Document                                           | Description                                           |
| -------------------------------------------------- | ----------------------------------------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md)                 | System architecture, data flow, technology decisions  |
| [GAME_ENGINE.md](GAME_ENGINE.md)                   | Game logic, chain reactions, scoring, elimination     |
| [RENDERING.md](RENDERING.md)                       | Canvas rendering, orb visuals, explosions, animations |
| [NETWORKING.md](NETWORKING.md)                     | Socket.io events, room system, mock socket            |
| [COMPONENTS.md](COMPONENTS.md)                     | React components and their props                      |
| [API_REFERENCE.md](API_REFERENCE.md)               | Complete function/hook/event API reference            |
| [SETUP_AND_DEPLOYMENT.md](SETUP_AND_DEPLOYMENT.md) | Installation, environment variables, deployment       |
| [CHANGELOG.md](CHANGELOG.md)                       | Version history and recent changes                    |

## Scripts

```bash
pnpm dev           # Start Next.js dev server (port 3000)
pnpm dev:server    # Start Socket.io backend (port 3001)
pnpm dev:both      # Run both concurrently
pnpm build         # Production build
pnpm start         # Start production server
pnpm lint          # Run ESLint
```
