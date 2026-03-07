import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import Redis from "ioredis";
import type {
  GameRoom,
  Player,
  BoardState,
  GameMove,
  GameOutcome,
  SocketEvents,
  ChatMessage,
  PlayerColor,
} from "../lib/types";
import {
  createBoardState,
  isValidMove,
  applyMove,
  getNextActivePlayer,
  isGameOver,
  getWinner,
  computeScores,
  getEliminatedPlayers,
} from "../lib/gameEngine";
import { nanoid } from "nanoid";

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? false : "*",
    methods: ["GET", "POST"],
  },
});

// Initialize Redis with error handling
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: () => null, // Don't retry connection
  enableReadyCheck: false,
  enableOfflineQueue: false,
});

// Suppress unhandled Redis errors - we'll handle them in the helper functions
redis.on("error", () => {
  // Silently ignore Redis errors - will use in-memory fallback
});

// In-memory fallback if Redis is unavailable
const rooms = new Map<string, GameRoom>();
const playerSockets = new Map<string, string>(); // playerId -> socketId

// ============================================================================
// REDIS HELPERS
// ============================================================================

async function saveRoom(room: GameRoom): Promise<void> {
  try {
    await redis.set(`room:${room.id}`, JSON.stringify(room), "EX", 3600); // 1 hour TTL
    rooms.set(room.id, room);
  } catch (error) {
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
    return rooms.get(roomId) || null;
  }
}

async function deleteRoom(roomId: string): Promise<void> {
  try {
    await redis.del(`room:${roomId}`);
    rooms.delete(roomId);
  } catch (error) {
    rooms.delete(roomId);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getTakenColors(room: GameRoom): PlayerColor[] {
  return room.players.map((p) => p.color);
}

// ============================================================================
// SOCKET.IO HANDLERS
// ============================================================================

io.on("connection", (socket) => {
  console.log(`[Server] Player connected: ${socket.id}`);

  socket.on("player:join", async (data: { playerName: string }) => {
    const playerId = nanoid();
    playerSockets.set(playerId, socket.id);
    socket.data.playerId = playerId;
    socket.data.playerName = data.playerName;

    console.log(`[Server] Player joined: ${playerId} - ${data.playerName}`);

    // Send acknowledgment back to client
    socket.emit("player:joined", { playerId, playerName: data.playerName });
  });

  socket.on(
    "room:create",
    async (data: {
      roomName: string;
      maxPlayers?: number;
      color?: PlayerColor;
      gridRows?: number;
      gridCols?: number;
    }) => {
      const playerId = socket.data.playerId;
      const playerName = socket.data.playerName;

      if (!playerId || !playerName) {
        socket.emit("error", { message: "Player not authenticated" });
        return;
      }

      const maxPlayers = Math.min(5, Math.max(2, data.maxPlayers || 2));
      const color: PlayerColor = data.color || "blue";
      const gridRows = Math.min(15, Math.max(3, data.gridRows || 9));
      const gridCols = Math.min(15, Math.max(3, data.gridCols || 6));

      const roomId = nanoid();
      const host: Player = {
        id: playerId,
        name: playerName,
        role: "host",
        color,
        score: 0,
        isActive: true,
        socketId: socket.id,
        hasMovedOnce: false,
      };

      const room: GameRoom = {
        id: roomId,
        name: data.roomName,
        host,
        players: [host],
        status: "waiting",
        boardState: createBoardState(playerId, gridRows, gridCols),
        createdAt: Date.now(),
        maxPlayers,
        gridRows,
        gridCols,
      };

      await saveRoom(room);
      socket.join(roomId);
      socket.emit("room:created", { room });
      io.to(roomId).emit("room:updated", { room });

      console.log(
        `[Server] Room created: ${roomId} (maxPlayers: ${maxPlayers}, hostColor: ${color})`,
      );
    },
  );

  socket.on(
    "room:join",
    async (data: {
      roomId: string;
      playerName: string;
      color?: PlayerColor;
    }) => {
      const playerId = socket.data.playerId;
      console.log(
        `[Server] Room join request: roomId=${data.roomId}, playerId=${playerId}, playerName=${data.playerName}, color=${data.color}`,
      );

      if (!playerId) {
        socket.emit("error", { message: "Player not authenticated" });
        return;
      }

      const room = await getRoom(data.roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      if (room.players.length >= room.maxPlayers) {
        socket.emit("error", { message: "Room is full" });
        return;
      }

      // Check color availability
      const takenColors = getTakenColors(room);
      let chosenColor: PlayerColor = data.color || "red";

      if (takenColors.includes(chosenColor)) {
        // Auto-pick first available color
        const allColors: PlayerColor[] = [
          "blue",
          "red",
          "green",
          "yellow",
          "purple",
        ];
        const available = allColors.filter((c) => !takenColors.includes(c));
        if (available.length === 0) {
          socket.emit("error", { message: "No colors available" });
          return;
        }
        chosenColor = available[0];
        socket.emit("color:unavailable", {
          message: `Color already taken, assigned ${chosenColor} instead`,
          takenColors,
        });
      }

      const guest: Player = {
        id: playerId,
        name: data.playerName,
        role: "guest",
        color: chosenColor,
        score: 0,
        isActive: false,
        socketId: socket.id,
        hasMovedOnce: false,
      };

      room.players.push(guest);
      // Keep backward compat: set guest to the first non-host player
      if (room.players.length === 2) {
        room.guest = guest;
      }
      room.boardState.scores[playerId] = 0;

      await saveRoom(room);
      socket.join(data.roomId);

      console.log(
        `[Server] Player joined room: ${data.roomId}, name: ${data.playerName}, color: ${chosenColor} (${room.players.length}/${room.maxPlayers})`,
      );
      io.to(data.roomId).emit("room:updated", { room });
    },
  );

  socket.on(
    "color:change",
    async (data: { roomId: string; color: PlayerColor }) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;

      const room = await getRoom(data.roomId);
      if (!room) return;

      const takenColors = room.players
        .filter((p) => p.id !== playerId)
        .map((p) => p.color);

      if (takenColors.includes(data.color)) {
        socket.emit("color:unavailable", {
          message: `${data.color} is already taken`,
          takenColors,
        });
        return;
      }

      // Update player color
      const player = room.players.find((p) => p.id === playerId);
      if (player) {
        player.color = data.color;
        if (room.host.id === playerId) room.host.color = data.color;
        if (room.guest && room.guest.id === playerId)
          room.guest.color = data.color;
        await saveRoom(room);
        io.to(data.roomId).emit("room:updated", { room });
        console.log(
          `[Server] Player ${playerId} changed color to ${data.color}`,
        );
      }
    },
  );

  socket.on("game:start", async (data: { roomId: string }) => {
    const room = await getRoom(data.roomId);
    if (!room || room.status !== "waiting") {
      socket.emit("error", { message: "Invalid room state" });
      return;
    }

    if (room.players.length < 2) {
      socket.emit("error", { message: "Need at least 2 players to start" });
      return;
    }

    room.status = "playing";
    room.boardState = createBoardState(
      room.host.id,
      room.gridRows,
      room.gridCols,
    );
    // Initialize scores for all players
    for (const player of room.players) {
      room.boardState.scores[player.id] = 0;
    }

    await saveRoom(room);
    io.to(data.roomId).emit("game:started", {
      boardState: room.boardState,
    });

    console.log(
      `[Server] Game started in room: ${data.roomId} with ${room.players.length} players`,
    );
  });

  socket.on("game:move", async (data: { roomId: string; move: GameMove }) => {
    const room = await getRoom(data.roomId);
    if (!room || room.status !== "playing") {
      socket.emit("error", { message: "Invalid room state" });
      return;
    }

    const { move } = data;
    const boardState = room.boardState;

    // Find the player who made the move and their index
    const playerIndex = room.players.findIndex((p) => p.id === move.playerId);
    if (playerIndex === -1) {
      socket.emit("error", { message: "Player not found" });
      return;
    }
    const player = room.players[playerIndex];

    // Validate move using new isValidMove signature
    const rows = boardState.grid.length;
    const cols = boardState.grid[0]?.length || 0;
    const isValid = isValidMove(
      boardState.grid,
      move.row,
      move.col,
      playerIndex,
      rows,
      cols,
    );
    if (!isValid) {
      socket.emit("game:invalid-move", {
        reason: "Invalid move - cannot place on opponent cell or out of bounds",
      });
      return;
    }

    // Apply move using new applyMove signature
    const result = applyMove(boardState, move, playerIndex, room.players);
    boardState.grid = result.newGrid;
    boardState.scores = result.scores;

    // Mark player as having moved
    player.hasMovedOnce = true;

    // Get next active player
    boardState.currentPlayerIndex = getNextActivePlayer(
      boardState.currentPlayerIndex,
      room.players,
      boardState.grid,
    );
    boardState.turnNumber += 1;
    boardState.lastMoveAt = Date.now();

    // Check for game over
    if (isGameOver(boardState.grid, room.players)) {
      room.status = "finished";
      const winner = getWinner(boardState.grid, room.players);
      const eliminatedPlayers = getEliminatedPlayers(
        boardState.grid,
        room.players,
      );

      await saveRoom(room);
      io.to(data.roomId).emit("game:moveResult", {
        boardState,
        explosionSequence: result.explosionSequence,
        scores: boardState.scores,
        eliminatedPlayers,
        winner,
      });
    } else {
      const eliminatedPlayers = getEliminatedPlayers(
        boardState.grid,
        room.players,
      );
      await saveRoom(room);
      io.to(data.roomId).emit("game:moveResult", {
        boardState,
        explosionSequence: result.explosionSequence,
        scores: boardState.scores,
        eliminatedPlayers,
        winner: null,
      });
    }

    console.log(
      `[Server] Move processed: ${move.playerId} at (${move.row}, ${move.col})`,
    );
  });

  socket.on("chat:send", (data: { roomId: string; message: string }) => {
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

    io.to(data.roomId).emit("chat:message", chatMessage);
    console.log(
      `[Server] Chat message in ${data.roomId}: ${playerName}: ${data.message}`,
    );
  });

  socket.on("disconnect", () => {
    const playerId = socket.data.playerId;
    playerSockets.delete(playerId);
    console.log(`[Server] Player disconnected: ${playerId}`);
  });
});

// ============================================================================
// EXPRESS ROUTES
// ============================================================================

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/rooms", (req, res) => {
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
process.on("SIGTERM", async () => {
  console.log("[Server] SIGTERM signal received: closing HTTP server");
  httpServer.close(() => {
    console.log("[Server] HTTP server closed");
    redis.disconnect();
    process.exit(0);
  });
});
