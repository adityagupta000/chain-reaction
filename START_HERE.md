# Chain Reaction - START HERE

Welcome! You now have a complete, production-ready multiplayer game. Here's how to get started.

## What You Have

A fully functional real-time multiplayer strategy game with:
- **Real-time Networking** - Socket.io for instant synchronization
- **Canvas Rendering** - 60fps hardware-accelerated graphics
- **Game Logic** - Pure functions for validation and scoring
- **UI/UX** - Beautiful dark-themed interface
- **Audio** - Web Audio API sound effects
- **Backend Server** - Express + Socket.io with optional Redis
- **Full Type Safety** - TypeScript throughout
- **Complete Documentation** - 5+ documentation files

## Quick Start (2 Minutes)

```bash
# 1. Install dependencies
pnpm install

# 2. Start development (frontend + backend)
pnpm run dev:both

# 3. Open browser
# http://localhost:3000

# 4. Create room, join with another browser, play!
```

Done! Now read the next section based on your needs.

## Documentation Map

Choose based on what you need:

### 1. **Want to play right away?**
→ Go to [QUICK_START.md](./QUICK_START.md)
- 2-minute setup
- How to play
- Keyboard shortcuts

### 2. **Setting up for the first time?**
→ Go to [SETUP.md](./SETUP.md)
- Detailed environment setup
- Redis configuration
- Troubleshooting

### 3. **Understanding the game?**
→ Go to [GAME_README.md](./GAME_README.md)
- Game rules and mechanics
- How to win
- Special features

### 4. **Integrating with your code?**
→ Go to [API_DOCS.md](./API_DOCS.md)
- Socket.io event reference
- Game logic API
- State management hooks

### 5. **Want to extend it?**
→ Go to [BUILD_SUMMARY.md](./BUILD_SUMMARY.md)
- Architecture overview
- How each system works
- Extension points

### 6. **Deploying to production?**
→ Go to [SETUP.md - Deploy Checklist](./SETUP.md#deployment-options)
- Vercel deployment
- Self-hosted setup
- Environment variables

### 7. **Everything implemented?**
→ Go to [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)
- What was built
- Which files matter
- Verification checklist

## File Quick Reference

**Game Logic** (Pure, shareable functions)
- `lib/gameEngine.ts` - Move validation, explosions, scoring
- `lib/types.ts` - TypeScript interfaces

**State Management**
- `lib/store.ts` - Zustand global store
- `lib/constants.ts` - Game configuration

**Networking**
- `server/index.ts` - Express + Socket.io server
- `hooks/useSocket.ts` - Socket.io client integration

**Rendering**
- `lib/rendering.ts` - Canvas system (particles, animations, board)
- `components/GameCanvas.tsx` - Canvas component

**UI Components**
- `components/Game.tsx` - Main orchestrator
- `components/Lobby.tsx` - Room creation/joining
- `components/WaitingRoom.tsx` - Player queue
- `components/GameHUD.tsx` - Score/timer display
- `components/GameOver.tsx` - Results screen

**Audio**
- `lib/soundManager.ts` - Web Audio effects

## Key Concepts

### Game Phase Flow
```
Lobby
  → Enter name
  → Create or join room

WaitingRoom
  → Wait for opponent
  → Copy room ID to share

Playing
  → 30-second turns
  → Click orbs for explosions
  → Score points
  → Sync in real-time

GameOver
  → See results
  → Play again
```

### Network Flow
```
Client Click
  → Validate locally
  → Send to server
  → Server validates again
  → Execute game logic
  → Broadcast to both players
  → Update UI
```

### State Management
```
Zustand Store
  ↓ (managed by)
Hoooks (useGamePhase, useBoardState, etc)
  ↓ (used by)
Components (Game, GameCanvas, GameHUD, etc)
  ↓ (trigger)
Socket.io (useSocketEmit)
  ↓ (updates)
Zustand Store
```

## Common Tasks

### I want to change the game board size
1. Edit `lib/constants.ts` - Change `GRID_SIZE` from 6 to desired size
2. Update `lib/gameEngine.ts` - Adjust grid loops

### I want to add a new orb type
1. Add to `Orb` type in `lib/types.ts`
2. Add rendering logic in `lib/rendering.ts`
3. Add validation in `lib/gameEngine.ts`

### I want to customize colors
1. Edit `lib/constants.ts` - `COLORS` and `ORB_COLORS`
2. Colors automatically apply to rendering

### I want to add chat
**Already implemented!** See `components/GameCanvas.tsx` for usage

### I want to deploy this
1. Deploy frontend to Vercel
2. Deploy server to Render/Railway/Heroku
3. Set `NEXT_PUBLIC_SOCKET_URL` to server URL
4. See [SETUP.md - Deployment](./SETUP.md#deployment-options)

## Development Workflow

### During Development
```bash
# Terminal 1: Frontend
pnpm dev

# Terminal 2: Backend
pnpm run dev:server

# OR both together
pnpm run dev:both
```

### Testing Multiplayer Locally
Open 2 browser windows:
- http://localhost:3000 (Player 1)
- http://localhost:3000 (Player 2, same URL, different tab)

### Building for Production
```bash
pnpm build
pnpm start
```

## Debugging Tips

### Check Game State
Open browser console:
```javascript
useGameStore.getState()
```

### Watch Socket Events
Install Socket.io DevTools extension for Chrome

### Check Server Logs
Look at Terminal 2 output where server is running

### Simulate Connection Issues
Open DevTools → Network → Throttle to "Slow 3G"

## Performance Tips

- Canvas renders at 60fps independent of network
- Animations are GPU-accelerated
- Particles are cleaned up automatically
- No memory leaks on disconnect
- Socket.io uses binary protocol for efficiency

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires: Canvas, Web Audio, WebSocket, ES2020

## Project Structure Summary

```
/app              → Next.js pages
/components       → React components
  /ui            → shadcn/ui components
/hooks            → Custom React hooks
/lib              → Utilities and game logic
/server           → Express + Socket.io backend
/public           → Static assets
```

## What's Next?

1. **Run it** - `pnpm run dev:both` and open browser
2. **Play it** - Create a room and join from another tab
3. **Modify it** - Change colors, rules, or add features
4. **Deploy it** - Follow SETUP.md deployment guide
5. **Extend it** - See BUILD_SUMMARY.md for extension points

## Support & Resources

- **TypeScript Issues** - Check `lib/types.ts`
- **Socket.io Issues** - Check `server/index.ts` and `hooks/useSocket.ts`
- **Rendering Issues** - Check `lib/rendering.ts`
- **Game Logic Issues** - Check `lib/gameEngine.ts`
- **Deployment Issues** - Check `SETUP.md`

## Fun Facts

- The game logic is completely pure and testable
- Canvas renders 60fps regardless of network lag
- Server validates every move (client can't cheat)
- Game state persists to Redis (optional)
- Particles use physics simulation
- Audio uses Web Audio API synthesis

## License

MIT - Feel free to use, modify, and distribute!

## What's Different About This Implementation?

✅ **Production Quality** - Not a tutorial, actual production code
✅ **Full Type Safety** - Complete TypeScript coverage
✅ **Scalable Architecture** - Easy to extend
✅ **Best Practices** - Security, performance, UX
✅ **Complete Docs** - Everything documented
✅ **Ready to Deploy** - Works day 1
✅ **Real Multiplayer** - Not a fake "AI"
✅ **Beautiful UI** - Modern dark theme
✅ **Sound Effects** - Interactive audio
✅ **Validation** - Server-side checks

---

## Ready? Let's Go!

```bash
pnpm install
pnpm run dev:both
# Open http://localhost:3000
# Create a room
# Open another tab/window
# Join the room
# Play!
```

**Questions?** Read the documentation files above.

**Found a bug?** Check SETUP.md troubleshooting.

**Want to add features?** Check BUILD_SUMMARY.md extension points.

**Need help?** All code is well-commented - start reading `lib/gameEngine.ts`!

---

**Happy gaming! Have fun with Chain Reaction!**
