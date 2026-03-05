# How to Run Chain Reaction Game

## Quick Start (Development Mode - No Backend Required)

The game now includes a **mock socket** system that allows you to play without running a separate backend server. This is perfect for development and testing.

### Step 1: Install Dependencies
```bash
pnpm install
```

### Step 2: Run the Development Server
```bash
pnpm dev
```

The app will be available at `http://localhost:3000`

### Step 3: Play the Game
1. Open `http://localhost:3000` in your browser
2. Enter a player name
3. Either:
   - **Create a new room** - You'll wait for another player (or one will be simulated)
   - **Join an existing room** - Copy the room ID from another window/tab
4. Start the game and play!

**In offline/mock mode**, the game will automatically simulate your opponent's moves with realistic 2-second delays between turns.

---

## Full Stack Mode (With Real Backend Server)

To run with a real Socket.io backend server for multiplayer across different machines:

### Prerequisites
- Node.js 18+
- Redis (optional - falls back to in-memory storage)

### Step 1: Install Dependencies
```bash
pnpm install
```

### Step 2: Set Up Environment Variables
Create a `.env.local` file:
```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Step 3: Start Redis (if available)
```bash
redis-server
```

If Redis isn't available, the server will use in-memory storage (rooms persist during the session).

### Step 4: Run Both Frontend and Backend
```bash
pnpm run dev:both
```

This runs:
- Next.js dev server on `http://localhost:3000`
- Socket.io backend on `http://localhost:3001`

### Step 5: Play with Multiple Clients
- Open `http://localhost:3000` in multiple browser windows/tabs
- Or share the URL with friends to play across different machines

---

## Troubleshooting

### "Connection failed" Error
This means the Socket.io backend server isn't running. You have two options:
1. **Use offline/mock mode** (default) - Just keep playing, the game will use simulated opponents
2. **Start the backend server** - Run `pnpm run dev:both` instead

### Game Works Locally but Not Across Machines
Make sure your backend server is accessible:
1. Update `NEXT_PUBLIC_SOCKET_URL` to your server's IP or domain
2. Ensure port 3001 is not blocked by a firewall
3. Both machines must be on the same network or the server must be publicly accessible

### Redis Connection Issues
If Redis isn't available:
- The server will automatically fall back to in-memory storage
- Rooms will persist as long as the server is running
- Rooms will be lost when the server restarts

---

## Architecture

```
Client (Browser)
    ↓
Next.js Frontend (localhost:3000)
    ↓
Socket.io Client
    ↓
Either:
  A) MockSocket (offline development) → Game runs locally with simulated opponent
  B) Real Socket.io Server (localhost:3001) → Multiplayer with real backend
     ↓
     Express Server + Socket.io
     ↓
     Redis (optional) or In-Memory Storage
```

---

## Performance Notes

- **Offline Mode**: Low latency, instant feedback, great for development
- **Network Mode**: Real-time multiplayer, server validates all moves
- **Canvas Rendering**: 60fps animation regardless of network

Enjoy playing Chain Reaction!
