# Chain Reaction - Quick Start

## Get Running in 2 Minutes

```bash
# 1. Install
pnpm install

# 2. Run (both frontend and backend)
pnpm run dev:both

# 3. Open browser
# http://localhost:3000
```

## How to Play

1. **Enter your name** in the lobby
2. **Create a room** or **join with room ID**
3. **Wait** for opponent or click "Start Game"
4. **Click orbs** to trigger chain reactions
5. **Earn points** equal to orb mass (1-4)
6. **Highest score wins**

## File Guide

| File | Purpose |
|------|---------|
| `lib/gameEngine.ts` | Core game logic (explosions, scoring) |
| `lib/store.ts` | Game state (Zustand) |
| `components/Game.tsx` | Main orchestrator |
| `components/GameCanvas.tsx` | Canvas rendering |
| `server/index.ts` | Socket.io server |
| `hooks/useSocket.ts` | Network communication |

## Key Hooks

```typescript
// Use board state
const boardState = useBoardState();
const selectedCell = useSelectedCell();

// Emit socket events
const { submitMove, startGame } = useSocketEmit();

// Game logic
const { handleMove } = useGameMove(playerId);

// Sounds
const { playExplosion } = useGameSounds(soundEnabled);
```

## Common Tasks

### Add New Sound Effect
```typescript
// In soundManager.ts
newEffect(): void {
  this.playTone(400, 200, 'sine');
}

// In components
const { playNewEffect } = useGameSounds(soundEnabled);
playNewEffect();
```

### Modify Game Rules
```typescript
// In lib/gameEngine.ts
- Change GRID_SIZE to resize board
- Adjust MAX_MASS for orb values
- Modify explosion algorithm in bfsExplosion()
```

### Change Colors
```typescript
// In lib/constants.ts
export const COLORS = {
  blue: '#3B82F6',    // Change these
  red: '#EF4444',
  // ...
};
```

### Add Chat
```typescript
// Already in hooks/useSocket.ts
const { sendChat } = useSocketEmit();
sendChat(roomId, message);

// Listen to messages in useSocket()
socket.on('chat:message', (msg) => { ... });
```

## Debug Commands

```javascript
// In browser console

// Check game state
useGameStore.getState()

// Emit socket event
io().emit('game:move', { roomId: '...', move: {...} })

// Check board
const state = useGameStore.getState();
console.log(state.boardState.grid);
```

## Troubleshooting Quick Fixes

| Problem | Fix |
|---------|-----|
| "Socket not connected" | Make sure `pnpm run dev:server` is running |
| "Port 3001 in use" | Kill: `lsof -ti:3001 \| xargs kill -9` |
| "Canvas not showing" | Check browser console, refresh page |
| "Move not working" | Check it's your turn, cell has orb |
| "Styles broken" | Clear `.next/` and rebuild |

## Environment Variables

```env
# Required
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# Optional (in-memory storage used if not set)
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Deploy Checklist

- [ ] Update `NEXT_PUBLIC_SOCKET_URL` for production
- [ ] Set up Redis or accept in-memory only
- [ ] Configure CORS in server/index.ts
- [ ] Test multiplayer with 2 browsers
- [ ] Enable HTTPS for production
- [ ] Set up monitoring/logging

## Architecture Overview

```
Frontend (Next.js 16 + React 19)
    ↓
Zustand Store (game state)
    ↓
Socket.io Client
    ↓
Express Server + Socket.io
    ↓
Redis (optional game persistence)
```

## Performance Metrics

- **Canvas FPS**: 60fps decoupled from network
- **Network Latency**: ~50ms typical
- **Game State Size**: ~2KB per move
- **Max Players**: 2 (easily extendable)

## Resources

- **Game Rules**: See GAME_README.md
- **Setup Guide**: See SETUP.md
- **Game Logic**: lib/gameEngine.ts (well-commented)
- **Examples**: components/ folder

## Next.js Commands

```bash
pnpm dev              # Start frontend
pnpm build            # Build for production
pnpm start            # Run production build
pnpm lint             # Check code
pnpm run dev:server   # Start game server only
pnpm run dev:both     # Run both together
```

That's it! Start building and have fun!
