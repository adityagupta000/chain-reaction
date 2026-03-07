# Setup & Deployment

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **pnpm** (package manager)
- **Redis** (optional — for persistent game state)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd chain-reaction

# Install dependencies
pnpm install
```

## Development

### Running Both Client & Server

```bash
pnpm dev:both
```

This uses `concurrently` to run:
- **Next.js dev server** on `http://localhost:3000`
- **Socket.io server** on `http://localhost:3001`

### Running Separately

```bash
# Terminal 1: Next.js client
pnpm dev

# Terminal 2: Socket.io server
pnpm dev:server
```

### Offline Mode (No Server)

If the Socket.io server is not running, the client automatically falls back to `MockSocket`. This provides a single-player experience against an AI opponent — convenient for UI development.

## Environment Variables

### Client

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:3001` | Socket.io server URL |

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP server port |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password (optional) |
| `NODE_ENV` | — | Set to `production` to restrict CORS |

## Build

```bash
# Production build
pnpm build

# Start production server
pnpm start
```

The build uses **Turbopack** for the Next.js dev server and standard Next.js compilation for production.

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `next dev` | Next.js dev server (port 3000) |
| `dev:server` | `node --import tsx server/index.ts` | Socket.io backend (port 3001) |
| `dev:both` | `concurrently "pnpm dev" "pnpm dev:server"` | Both concurrently |
| `build` | `next build` | Production build |
| `start` | `next start` | Production Next.js server |
| `lint` | `eslint .` | Run ESLint |

## Redis Setup

Redis is **optional**. The server automatically falls back to an in-memory `Map` if Redis is unavailable.

### With Redis

```bash
# Install Redis (macOS)
brew install redis
brew services start redis

# Install Redis (Ubuntu)
sudo apt install redis-server
sudo systemctl start redis

# Install Redis (Windows)
# Use WSL or Docker:
docker run -p 6379:6379 redis
```

### Without Redis

No configuration needed. Room data is stored in-memory and lost when the server restarts.

### Redis Behavior

- Room data has a **1-hour TTL** (`EX 3600`)
- Redis connection failures are silently handled
- All Redis operations have in-memory fallback
- `retryStrategy: () => null` — no reconnection attempts

## Project Dependencies

### Core Dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.1.6 | React framework |
| `react` / `react-dom` | 19.2.4 | UI library |
| `zustand` | ^4.4.0 | State management |
| `socket.io` | ^4.7.0 | WebSocket server |
| `socket.io-client` | ^4.7.0 | WebSocket client |
| `express` | ^4.18.0 | HTTP server |
| `ioredis` | ^5.3.0 | Redis client |
| `nanoid` | ^4.0.0 | ID generation |
| `framer-motion` | ^11.0.3 | Animations |
| `lucide-react` | ^0.564.0 | Icons |

### UI Dependencies

| Package | Purpose |
|---|---|
| `tailwind-merge`, `clsx`, `class-variance-authority` | CSS utility composition |
| `@radix-ui/*` (multiple) | Headless UI primitives (shadcn/ui) |
| `sonner` | Toast notifications |
| `next-themes` | Dark/light mode |
| `recharts` | Charts (available, not actively used) |

### Dev Dependencies

| Package | Purpose |
|---|---|
| `typescript` | 5.7.3 — Type checking |
| `tailwindcss` | ^4.2.0 — CSS framework |
| `@tailwindcss/postcss` | PostCSS integration |
| `tsx` | TypeScript execution for server |
| `concurrently` | Run multiple scripts |
| `tw-animate-css` | Tailwind animation utilities |

## Deployment Considerations

### Production CORS

When `NODE_ENV === "production"`, Socket.io CORS is set to `false` (same-origin only). For cross-origin deployment, update the CORS configuration in `server/index.ts`.

### Port Configuration

- Next.js defaults to port 3000
- Socket.io server defaults to port 3001
- Set `NEXT_PUBLIC_SOCKET_URL` on the client to point to the correct server URL in production

### Graceful Shutdown

The server handles `SIGTERM`:
1. Closes the HTTP server
2. Disconnects Redis
3. Exits cleanly

## Troubleshooting

### `.next/dev/lock` File

If `pnpm dev` hangs, the lock file may be stale:

```powershell
Remove-Item .next/dev/lock -ErrorAction Ignore
pnpm dev
```

### Socket Connection Failures

The client retries Socket.io connection 3 times, then falls back to `MockSocket`. Check:
1. Server is running (`pnpm dev:server`)
2. `NEXT_PUBLIC_SOCKET_URL` is correct
3. No firewall blocking port 3001

### Redis Connection

Redis errors are silently handled. To verify Redis:

```bash
redis-cli ping    # Should return PONG
```

If Redis is down, the server works fine with in-memory storage.
