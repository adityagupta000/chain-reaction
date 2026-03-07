// Mock Socket.io implementation for offline development
import { GameRoom, Player, BoardState, GameMove, Cell } from "./types";
import {
  createBoardState,
  applyMove,
  getNextActivePlayer,
  isGameOver,
} from "./gameEngine";
import { nanoid } from "nanoid";

export class MockSocket {
  private listeners: Map<string, Function[]> = new Map();
  public id: string;
  private rooms: Map<string, GameRoom> = new Map();
  private currentRoom: GameRoom | null = null;
  private currentPlayerId: string = "";
  private simulationTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.id = nanoid();
    // Simulate connection after a short delay
    setTimeout(() => {
      this.emit("connect");
    }, 500);
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
  }

  emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  emit_with_delay(event: string, data: any, delay: number = 300) {
    setTimeout(() => {
      this.emit(event, data);
    }, delay);
  }

  disconnect() {
    this.emit("disconnect");
    if (this.simulationTimeout) clearTimeout(this.simulationTimeout);
  }

  // ========================================================================
  // GAME LOGIC
  // ========================================================================

  create_room(
    data: { roomName: string },
    playerId: string,
    playerName: string,
  ) {
    this.currentPlayerId = playerId;
    const room: GameRoom = {
      id: nanoid(),
      name: data.roomName,
      host: {
        id: playerId,
        name: playerName,
        role: "host",
        color: "blue",
        score: 0,
        isActive: true,
        socketId: this.id,
        hasMovedOnce: false,
      },
      status: "waiting",
      boardState: createBoardState(0),
      createdAt: Date.now(),
      maxPlayers: 2,
      gridRows: 9,
      gridCols: 6,
      players: [],
    };

    room.players = [room.host];
    this.currentRoom = room;
    this.rooms.set(room.id, room);

    this.emit("room:created", { room });
    this.emit("room:updated", { room });
  }

  join_room(data: { roomId: string }, playerId: string, playerName: string) {
    const room = this.rooms.get(data.roomId);
    if (!room) {
      this.emit("error", { message: "Room not found" });
      return;
    }

    if (room.guest) {
      this.emit("error", { message: "Room is full" });
      return;
    }

    this.currentPlayerId = playerId;
    const guest: Player = {
      id: playerId,
      name: playerName,
      role: "guest",
      color: "red",
      score: 0,
      isActive: false,
      socketId: this.id,
      hasMovedOnce: false,
    };

    room.guest = guest;
    room.players.push(guest);
    room.boardState.scores[playerId] = 0;
    this.currentRoom = room;

    this.emit("room:updated", { room });
  }

  start_game() {
    if (!this.currentRoom) {
      this.emit("error", { message: "No room" });
      return;
    }

    const room = this.currentRoom;
    if (room.status !== "waiting" || !room.guest) {
      this.emit("error", { message: "Cannot start game" });
      return;
    }

    room.status = "playing";
    room.players = [room.host, room.guest];
    room.boardState = createBoardState(
      0,
      room.gridRows || 9,
      room.gridCols || 6,
    );
    room.boardState.scores[room.host.id] = 0;
    room.boardState.scores[room.guest.id] = 0;

    this.emit("game:started", { boardState: room.boardState });

    // Simulate opponent moves for demo
    this._simulateOpponentMoves();
  }

  submit_move(move: GameMove) {
    if (!this.currentRoom) {
      this.emit("error", { message: "No room" });
      return;
    }

    const room = this.currentRoom;
    const boardState = room.boardState;

    // Find playerIndex
    const playerIndex = room.players.findIndex((p) => p.id === move.playerId);
    if (playerIndex === -1) {
      this.emit("game:invalid-move", { reason: "Player not found" });
      return;
    }

    const player = room.players[playerIndex];

    // Validate turn order
    if (playerIndex !== boardState.currentPlayerIndex) {
      this.emit("game:invalid-move", { reason: "It's not your turn" });
      return;
    }

    // Apply move using new signature
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

    // Check game over
    const gameOver = isGameOver(boardState.grid, room.players);
    const winner = gameOver
      ? room.players.find(
          (p) => p.hasMovedOnce && boardState.scores[p.id] > 0,
        ) || null
      : null;

    if (gameOver) {
      room.status = "finished";
    }

    this.emit("game:moveResult", {
      move,
      boardState,
      scores: boardState.scores,
      explosionSequence: result.explosionSequence,
      eliminatedPlayers: [],
      winner,
    });

    // Simulate opponent move after a delay (only if game not over)
    if (!gameOver && room.guest) {
      this._simulateOpponentMoves();
    }
  }

  private _simulateOpponentMoves() {
    if (!this.currentRoom || this.currentRoom.status !== "playing") return;

    if (this.simulationTimeout) clearTimeout(this.simulationTimeout);

    this.simulationTimeout = setTimeout(() => {
      if (!this.currentRoom) return;

      const room = this.currentRoom;
      const boardState = room.boardState;
      const opponentIndex =
        room.players.length > 1 && room.players[0].id === this.currentPlayerId
          ? 1
          : 0;
      const opponent = room.players[opponentIndex];

      if (!opponent || boardState.currentPlayerIndex !== opponentIndex) return;

      // Make a random valid move (empty cell or own cell)
      const validMoves: GameMove[] = [];
      for (let row = 0; row < boardState.grid.length; row++) {
        for (let col = 0; col < boardState.grid[row].length; col++) {
          const cell = boardState.grid[row][col];
          // Can place on empty cell or own cell
          if (cell.orbs === 0 || cell.owner === opponentIndex) {
            validMoves.push({
              playerId: opponent.id,
              row,
              col,
              timestamp: Date.now(),
            });
          }
        }
      }

      if (validMoves.length > 0) {
        const randomMove =
          validMoves[Math.floor(Math.random() * validMoves.length)];
        const result = applyMove(
          boardState,
          randomMove,
          opponentIndex,
          room.players,
        );
        boardState.grid = result.newGrid;
        boardState.scores = result.scores;

        // Mark opponent as having moved
        opponent.hasMovedOnce = true;

        // Get next active player
        boardState.currentPlayerIndex = getNextActivePlayer(
          boardState.currentPlayerIndex,
          room.players,
          boardState.grid,
        );
        boardState.turnNumber += 1;
        boardState.lastMoveAt = Date.now();

        if (isGameOver(boardState.grid, room.players)) {
          room.status = "finished";
          const winnerPlayer = room.players.find(
            (p) => p.hasMovedOnce && boardState.scores[p.id] > 0,
          ) || null;
          this.emit("game:moveResult", {
            move: randomMove,
            boardState,
            scores: boardState.scores,
            explosionSequence: result.explosionSequence,
            eliminatedPlayers: [],
            winner: winnerPlayer,
          });
        } else {
          this.emit("game:moveResult", {
            move: randomMove,
            boardState,
            scores: boardState.scores,
            explosionSequence: result.explosionSequence,
            eliminatedPlayers: [],
            winner: null,
          });
          // Continue simulation
          this._simulateOpponentMoves();
        }
      }
    }, 2000); // 2 second delay between opponent moves
  }
}
