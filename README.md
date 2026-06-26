# Chain Reaction — Multiplayer Strategy Game

> A real-time multiplayer chain reaction strategy game built with Next.js 16, React 19, Canvas 2D, and Socket.io. 2–5 players take turns placing orbs on configurable grids — cells that reach critical mass explode, capturing neighbors in BFS chain reactions. Last player standing wins.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#license)

## Quick Start

```bash
pnpm install
pnpm dev:both       # Client on :3000, Server on :3001
```

Open `http://localhost:3000`, create a room, share the room ID, and play!

If no server is running, the game automatically falls back to offline mode with an AI opponent.

## Features

- **2–5 player** real-time multiplayer via Socket.io
- **Configurable grids**: 6×6, 8×5, 9×6, 10×8, 12×8
- **BFS chain reaction** explosions with animated orb flights and screen shake
- **4-layer orb rendering**: glow, body gradient, rotating texture stripes, specular highlight
- **Orbiting multi-orb cells** with speed increasing near critical mass
- **Per-turn grid color** tinting based on current player
- **Web Audio API** synthesized sound effects
- **Server-authoritative** move validation and game logic
- **Redis-backed** persistence with automatic in-memory fallback
- **Offline mode** via MockSocket for development

## Game Rules

1. Place orbs on **empty cells** or **cells you own**
2. Cells explode at **critical mass** (corners: 2, edges: 3, center: 4)
3. Explosions send 1 orb to each neighbor, **capturing** them
4. Chain reactions cascade across the board
5. Game can't end until all players have moved once
6. Last player with orbs on the board **wins**

## Documentation

All detailed documentation lives in the [`docs/`](./docs/) folder:

| Document                                                       | Description                                       |
| -------------------------------------------------------------- | ------------------------------------------------- |
| [docs/README.md](./docs/README.md)                             | Project overview and structure                    |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)                 | System architecture, data flow, tech decisions    |
| [docs/GAME_ENGINE.md](./docs/GAME_ENGINE.md)                   | Game logic, chain reactions, scoring, elimination |
| [docs/RENDERING.md](./docs/RENDERING.md)                       | Canvas rendering engine, orb visuals, explosions  |
| [docs/NETWORKING.md](./docs/NETWORKING.md)                     | Socket.io events, room system, mock socket        |
| [docs/COMPONENTS.md](./docs/COMPONENTS.md)                     | React components and their props                  |
| [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)               | Complete function, hook, and event API            |
| [docs/SETUP_AND_DEPLOYMENT.md](./docs/SETUP_AND_DEPLOYMENT.md) | Installation, env vars, deployment                |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md)                       | Version history and recent changes                |

## Tech Stack

| Layer       | Technology                                |
| ----------- | ----------------------------------------- |
| Framework   | Next.js 16.1.6, React 19, TypeScript 5.7  |
| Rendering   | Canvas 2D API (custom `BoardRenderer`)    |
| State       | Zustand 4                                 |
| Networking  | Socket.io 4 (client + server)             |
| Server      | Express 4, Node.js                        |
| Persistence | Redis (ioredis 5) with in-memory fallback |
| Styling     | Tailwind CSS 4, shadcn/ui                 |
| Audio       | Web Audio API (synthesized tones)         |

## Scripts

```bash
pnpm dev           # Next.js dev server (port 3000)
pnpm dev:server    # Socket.io backend (port 3001)
pnpm dev:both      # Run both concurrently
pnpm build         # Production build
pnpm start         # Start production server
pnpm lint          # Run ESLint
```

## Project Structure

```
chain-reaction/
├── app/                    # Next.js app router (layout, page, globals.css)
├── components/             # React components (Game, Lobby, WaitingRoom, GameCanvas, GameHUD, GameOver)
├── hooks/                  # Custom hooks (useSocket, useGameLogic)
├── lib/                    # Core libraries (gameEngine, rendering, store, soundManager, types, constants)
├── server/                 # Express + Socket.io backend
├── docs/                   # Full documentation
└── public/                 # Static assets
```

## Getting Help

1. Check [START_HERE.md](./START_HERE.md) for navigation
2. Read relevant documentation from the table above
3. Check [API_DOCS.md](./API_DOCS.md) for code reference
4. Review commented code in `lib/gameEngine.ts`
5. Check browser console for errors
6. Check server logs for issues

## Future Ideas

- [ ] Leaderboard system
- [ ] Player profiles & authentication
- [ ] Tournament mode
- [ ] AI single-player opponent
- [ ] Custom board sizes
- [ ] Power-ups & special orbs
- [ ] Daily challenges
- [ ] Replay system
- [ ] Spectator mode
- [ ] Mobile native app

## Contributing

Feel free to extend and modify! Some ideas:

- Add more visual effects
- Create themes/skins
- Add game modes
- Build mobile app
- Create admin dashboard
- Add analytics

## Questions?

All code is well-documented. Start with:

1. `START_HERE.md` - Overview
2. `QUICK_START.md` - Quick reference
3. `API_DOCS.md` - Code API
4. Source code comments

---

**Ready to play? Start with `pnpm install && pnpm run dev:both`**

Then open [START_HERE.md](./START_HERE.md) for next steps!
