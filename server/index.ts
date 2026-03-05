import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import type {
  GameRoom,
  Player,
  BoardState,
  GameMove,
  GameOutcome,
  SocketEvents,
  ChatMessage,
} from '../lib/types';
import {
  createBoardState,
  validateMove,
  applyMove,
  getNextTurn,
  getValidMoves,
  isGameOver,
  getWinner,
} from '../lib/gameEngine';
import { nanoid } from 'nanoid';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST'],
  },
});

// Initialize Redis
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

// In-memory fallback if Redis is unavailable
const rooms = new Map<string, GameRoom>();
const playerSockets = new Map<string, string>(); // playerId -> socketId

// ============================================================================
// REDIS HELPERS
// ============================================================================

async function saveRoom(room: GameRoom): Promise<void> {
  try {
    await redis.set(`room:${room.id}`, JSON.stringify(room), 'EX', 3600); // 1 hour TTL
    rooms.set(room.id, room);
  } catch (error) {
    console.error('[Server] Failed to save room to Redis:', error);
    rooms.set(room.id, room);
  }
}

async function getRoom(roomId: string): Promise<GameRoom | null> {
  try {
    const cached = rooms.get(roomId);
    if (cached) return cached;

    const data = await redis.get(`room:${roomId}`);
    if (data) {
      const room = JSON.parse(data);
      rooms.set(roomId, room);
      return room;
    }
    return null;
  } catch (error) {
    console.error('[Server] Failed to get room from Redis:', error);
    return rooms.get(roomId) || null;
  }
}

async function deleteRoom(roomId: string): Promise<void> {
  try {
    await redis.del(`room:${roomId}`);
    rooms.delete(roomId);
  } catch (error) {
    console.error('[Server] Failed to delete room from Redis:', error);
    rooms.delete(roomId);
  }
}

// ============================================================================
// SOCKET.IO HANDLERS
// ============================================================================

io.on('connection', (socket) => {
  console.log(`[Server] Player connected: ${socket.id}`);

  socket.on('player:join', async (data: { playerName: string }) => {
    const playerId = nanoid();
    playerSockets.set(playerId, socket.id);
    socket.data.playerId = playerId;
    socket.data.playerName = data.playerName;

    console.log(`[Server] Player joined: ${playerId} - ${data.playerName}`);
  });

  socket.on('room:create', async (data: { roomName: string }) => {
    const playerId = socket.data.playerId;
    const playerName = socket.data.playerName;

    if (!playerId || !playerName) {
      socket.emit('error', { message: 'Player not authenticated' });
      return;
    }

    const roomId = nanoid();
    const host: Player = {
      id: playerId,
      name: playerName,
      role: 'host',
      color: 'blue',
      score: 0,
      isActive: true,
      socketId: socket.id,
    };

    const room: GameRoom = {
      id: roomId,
      name: data.roomName,
      host,
      status: 'waiting',
      boardState: createBoardState(playerId),
      createdAt: Date.now(),
      maxPlayers: 2,
    };

    await saveRoom(room);
    socket.join(roomId);
    socket.emit('room:created', { room });
    io.to(roomId).emit('room:updated', { room });

    console.log(`[Server] Room created: ${roomId}`);
  });

  socket.on('room:join', async (data: { roomId: string; playerName: string }) => {
    const playerId = socket.data.playerId;

    if (!playerId) {
      socket.emit('error', { message: 'Player not authenticated' });
      return;
    }

    const room = await getRoom(data.roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.guest) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    const guest: Player = {
      id: playerId,
      name: data.playerName,
      role: 'guest',
      color: 'red',
      score: 0,
      isActive: false,
      socketId: socket.id,
    };

    room.guest = guest;
    room.boardState.scores[playerId] = 0;

    await saveRoom(room);
    socket.join(data.roomId);

    io.to(data.roomId).emit('room:updated', { room });
    console.log(`[Server] Player joined room: ${data.roomId}`);
  });

  socket.on('game:start', async (data: { roomId: string }) => {
    const room = await getRoom(data.roomId);
    if (!room || room.status !== 'waiting') {
      socket.emit('error', { message: 'Invalid room state' });
      return;
    }

    if (!room.guest) {
      socket.emit('error', { message: 'Waiting for second player' });
      return;
    }

    room.status = 'playing';
    room.boardState = createBoardState(room.host.id);
    room.boardState.scores[room.guest.id] = 0;

    await saveRoom(room);
    io.to(data.roomId).emit('game:started', {
      boardState: room.boardState,
    });

    console.log(`[Server] Game started in room: ${data.roomId}`);
  });

  socket.on('game:move', async (data: { roomId: string; move: GameMove }) => {
    const room = await getRoom(data.roomId);
    if (!room || room.status !== 'playing') {
      socket.emit('error', { message: 'Invalid room state' });
      return;
    }

    const { move } = data;
    const boardState = room.boardState;

    // Determine player color
    const player = room.host.id === move.playerId ? room.host : room.guest;
    if (!player) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }

    // Validate move
    const validation = validateMove(move, boardState, boardState.turn);
    if (!validation.valid) {
      socket.emit('game:invalid-move', { reason: validation.reason || 'Invalid move' });
      return;
    }

    // Apply move
    const result = applyMove(boardState, move, player.color);
    boardState.grid = result.newGrid;
    boardState.scores = result.scores;
    boardState.turn = getNextTurn(
      boardState.turn,
      room.guest ? [room.host.id, room.guest.id] : [room.host.id]
    );
    boardState.turnNumber += 1;
    boardState.lastMoveAt = Date.now();

    // Check for game over
    if (isGameOver(boardState)) {
      room.status = 'finished';
      const playersList = room.guest
        ? [room.host, room.guest]
        : [room.host];
      const winner = getWinner(boardState.scores, playersList);
      const outcome: GameOutcome =
        room.host.score === room.guest?.score ? 'draw' : 'win';

      await saveRoom(room);
      io.to(data.roomId).emit('game:finished', {
        outcome,
        winner,
      });
    } else {
      await saveRoom(room);
      io.to(data.roomId).emit('game:moveReceived', {
        move,
        boardState,
        scores: boardState.scores,
      });
    }

    console.log(`[Server] Move processed: ${move.playerId} at (${move.row}, ${move.col})`);
  });

  socket.on('chat:send', (data: { roomId: string; message: string }) => {
    const playerId = socket.data.playerId;
    const playerName = socket.data.playerName;

    if (!playerId || !playerName) return;

    const chatMessage: ChatMessage = {
      id: nanoid(),
      playerId,
      playerName,
      message: data.message,
      timestamp: Date.now(),
    };

    io.to(data.roomId).emit('chat:message', chatMessage);
    console.log(`[Server] Chat message in ${data.roomId}: ${playerName}: ${data.message}`);
  });

  socket.on('disconnect', () => {
    const playerId = socket.data.playerId;
    playerSockets.delete(playerId);
    console.log(`[Server] Player disconnected: ${playerId}`);
  });
});

// ============================================================================
// EXPRESS ROUTES
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values());
  res.json(roomList);
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    redis.disconnect();
    process.exit(0);
  });
});
