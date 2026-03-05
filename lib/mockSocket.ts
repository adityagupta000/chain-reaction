// Mock Socket.io implementation for offline development
import { GameRoom, Player, BoardState, GameMove } from './types';
import { createBoardState, applyMove, getNextTurn, isGameOver } from './gameEngine';
import { nanoid } from 'nanoid';

export class MockSocket {
  private listeners: Map<string, Function[]> = new Map();
  public id: string;
  private rooms: Map<string, GameRoom> = new Map();
  private currentRoom: GameRoom | null = null;
  private currentPlayerId: string = '';
  private simulationTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.id = nanoid();
    // Simulate connection after a short delay
    setTimeout(() => {
      this.emit('connect');
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
    this.emit('disconnect');
    if (this.simulationTimeout) clearTimeout(this.simulationTimeout);
  }

  // ========================================================================
  // GAME LOGIC
  // ========================================================================

  create_room(data: { roomName: string }, playerId: string, playerName: string) {
    this.currentPlayerId = playerId;
    const room: GameRoom = {
      id: nanoid(),
      name: data.roomName,
      host: {
        id: playerId,
        name: playerName,
        role: 'host',
        color: 'blue',
        score: 0,
        isActive: true,
        socketId: this.id,
      },
      status: 'waiting',
      boardState: createBoardState(playerId),
      createdAt: Date.now(),
      maxPlayers: 2,
    };

    this.currentRoom = room;
    this.rooms.set(room.id, room);

    this.emit('room:created', { room });
    this.emit('room:updated', { room });
  }

  join_room(data: { roomId: string }, playerId: string, playerName: string) {
    const room = this.rooms.get(data.roomId);
    if (!room) {
      this.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.guest) {
      this.emit('error', { message: 'Room is full' });
      return;
    }

    this.currentPlayerId = playerId;
    const guest: Player = {
      id: playerId,
      name: playerName,
      role: 'guest',
      color: 'red',
      score: 0,
      isActive: false,
      socketId: this.id,
    };

    room.guest = guest;
    room.boardState.scores[playerId] = 0;
    this.currentRoom = room;

    this.emit('room:updated', { room });
  }

  start_game() {
    if (!this.currentRoom) {
      this.emit('error', { message: 'No room' });
      return;
    }

    const room = this.currentRoom;
    if (room.status !== 'waiting' || !room.guest) {
      this.emit('error', { message: 'Cannot start game' });
      return;
    }

    room.status = 'playing';
    room.boardState = createBoardState(room.host.id);
    room.boardState.scores[room.guest.id] = 0;

    this.emit('game:started', { boardState: room.boardState });

    // Simulate opponent moves for demo
    this._simulateOpponentMoves();
  }

  submit_move(move: GameMove) {
    if (!this.currentRoom) {
      this.emit('error', { message: 'No room' });
      return;
    }

    const room = this.currentRoom;
    const boardState = room.boardState;

    const player = room.host.id === move.playerId ? room.host : room.guest;
    if (!player) {
      this.emit('game:invalid-move', { reason: 'Player not found' });
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

    this.emit('game:moveReceived', {
      move,
      boardState,
      scores: boardState.scores,
    });

    // Simulate opponent move after a delay
    if (room.guest) {
      this._simulateOpponentMoves();
    }
  }

  private _simulateOpponentMoves() {
    if (!this.currentRoom || this.currentRoom.status !== 'playing') return;

    if (this.simulationTimeout) clearTimeout(this.simulationTimeout);

    this.simulationTimeout = setTimeout(() => {
      if (!this.currentRoom) return;

      const room = this.currentRoom;
      const boardState = room.boardState;
      const opponent = room.host.id === this.currentPlayerId ? room.guest : room.host;

      if (!opponent || boardState.turn !== opponent.id) return;

      // Make a random valid move
      const validMoves: GameMove[] = [];
      for (let row = 0; row < boardState.grid.length; row++) {
        for (let col = 0; col < boardState.grid[row].length; col++) {
          const orb = boardState.grid[row][col];
          if (orb && orb.color === opponent.color) {
            validMoves.push({ playerId: opponent.id, row, col });
          }
        }
      }

      if (validMoves.length > 0) {
        const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        const result = applyMove(boardState, randomMove, opponent.color);
        boardState.grid = result.newGrid;
        boardState.scores = result.scores;
        boardState.turn = getNextTurn(
          boardState.turn,
          room.guest ? [room.host.id, room.guest.id] : [room.host.id]
        );
        boardState.turnNumber += 1;
        boardState.lastMoveAt = Date.now();

        if (isGameOver(boardState)) {
          room.status = 'finished';
          this.emit('game:finished', {
            outcome: boardState.scores[this.currentPlayerId] > boardState.scores[opponent.id] ? 'win' : 'lose',
            winner: boardState.scores[this.currentPlayerId] > boardState.scores[opponent.id] ? this.currentPlayerId : opponent.id,
          });
        } else {
          this.emit('game:moveReceived', {
            move: randomMove,
            boardState,
            scores: boardState.scores,
          });
          // Continue simulation
          this._simulateOpponentMoves();
        }
      }
    }, 2000); // 2 second delay between opponent moves
  }
}
