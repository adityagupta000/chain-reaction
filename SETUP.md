# Chain Reaction - Setup Guide

## Quick Start (Development)

### Option 1: Run Both Server and Client Together

```bash
# Install dependencies
pnpm install

# Run both in parallel
pnpm run dev:both
```

This will:
- Start Next.js dev server on http://localhost:3000
- Start Socket.io game server on http://localhost:3001

### Option 2: Run Separately (Recommended for Debugging)

```bash
# Terminal 1: Install and start frontend
pnpm install
pnpm dev

# Terminal 2: Start backend server
pnpm run dev:server
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env.local` and update values:

```bash
cp .env.example .env.local
```

**Key variables:**
- `NEXT_PUBLIC_SOCKET_URL` - Socket.io server URL (default: http://localhost:3001)
- `REDIS_HOST/PORT/PASSWORD` - Optional Redis for game state persistence
- `PORT` - Server port (default: 3001)

### Redis Setup (Optional but Recommended)

For game state persistence across server restarts:

```bash
# Mac (with Homebrew)
brew install redis
brew services start redis

# Linux (Ubuntu/Debian)
sudo apt-get install redis-server
sudo systemctl start redis-server

# Docker
docker run -d -p 6379:6379 redis:latest
```

Then in `.env.local`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Project Structure

```
/app                 - Next.js pages and layouts
/components          - React components
  /ui               - shadcn/ui components
/hooks               - Custom React hooks
  /useSocket.ts     - Socket.io integration
  /useGameLogic.ts  - Game logic helpers
/lib                 - Utilities and shared logic
  /gameEngine.ts    - Pure game logic (client/server shareable)
  /store.ts         - Zustand state management
  /rendering.ts     - Canvas rendering system
  /soundManager.ts  - Audio effects
  /types.ts         - TypeScript interfaces
  /constants.ts     - Game constants
/server              - Express + Socket.io server
  /index.ts         - Main server file
/public              - Static assets
  /sounds/          - Audio files (optional)
```

## Running Tests

```bash
pnpm test
```

## Building for Production

```bash
# Build Next.js app
pnpm build

# Start production server (frontend only)
pnpm start

# For production, deploy server separately or use Vercel's experimental services
```

## Deployment Options

### Option 1: Vercel (Recommended)
1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy with `vercel deploy`

**Note:** The Socket.io server needs to run separately:
- Deploy server to Render, Railway, or similar
- Set `NEXT_PUBLIC_SOCKET_URL` to your deployed server URL

### Option 2: Self-Hosted
1. Use PM2 or Docker to run both processes
2. Set up Redis for state persistence
3. Use Nginx as reverse proxy

Example with Docker:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm build
EXPOSE 3000 3001
CMD ["pnpm", "run", "dev:both"]
```

### Option 3: Vercel Experimental Services (When Available)
```js
// next.config.js
module.exports = {
  experimentalServices: [
    {
      name: 'game-server',
      command: 'node --loader tsx server/index.ts',
      port: 3001
    }
  ]
}
```

## Troubleshooting

### Socket.io Connection Fails
- Check `NEXT_PUBLIC_SOCKET_URL` matches server address
- Ensure server is running on correct port
- Check browser console for CORS errors
- Verify firewall allows WebSocket connections

### Redis Connection Fails
- Ensure Redis is running: `redis-cli ping`
- Check `REDIS_HOST` and `REDIS_PORT`
- If you don't have Redis, server falls back to in-memory storage

### Game State Lost on Refresh
- Install and configure Redis for persistence
- Or session storage is cleared in development mode

### Canvas Not Rendering
- Check browser console for WebGL/Canvas errors
- Ensure device pixel ratio is calculated correctly
- Try different browser (Chrome, Firefox, Safari)

### Slow Performance
- Check network latency with DevTools
- Reduce particle count in constants.ts
- Ensure server and client are on same machine for testing

## Development Tips

### Hot Reload
- Client: Next.js automatically reloads on file changes
- Server: Use `tsx --watch server/index.ts` for auto-restart

### Debugging
- Client: Use Chrome DevTools
- Server: Add `console.log` or use VS Code debugger
- Network: Use Socket.io dev tools browser extension

### Testing Multiplayer Locally
```bash
# Terminal 1
pnpm dev

# Terminal 2 (different port for second instance)
PORT=3001 pnpm dev

# Terminal 3 (game server)
pnpm run dev:server
```

Open two browser windows:
- http://localhost:3000 (Player 1)
- http://localhost:3001 (Player 2)

## Common Issues

| Issue | Solution |
|-------|----------|
| "Cannot find module 'socket.io'" | Run `pnpm install` |
| "EADDRINUSE: Port 3001 already in use" | Kill process: `lsof -ti:3001 \| xargs kill -9` |
| "Redis connection refused" | Start Redis or remove Redis config |
| "WebSocket connection failed" | Check `NEXT_PUBLIC_SOCKET_URL` and server running |
| "Move not being synced" | Check server logs and socket events in DevTools |

## Performance Optimization

### For Production
1. Enable compression: `gzip` in Nginx
2. Use CDN for static assets
3. Enable Redis for session/game state
4. Set appropriate CORS origins
5. Monitor Socket.io memory usage
6. Consider game state size limits

### For Development
1. Use `pnpm` for faster installs
2. Enable hot reload in both processes
3. Use VS Code TypeScript support
4. Keep Redis connection logs minimal

## Next Steps

1. Read `GAME_README.md` for gameplay rules
2. Check `lib/gameEngine.ts` to understand game logic
3. Explore `components/` to see UI structure
4. Review `hooks/useSocket.ts` for networking

Happy gaming!
