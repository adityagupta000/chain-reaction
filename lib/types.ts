// ============================================================================
// GAME STATE TYPES
// ============================================================================

export type GamePhase = 'lobby' | 'waiting' | 'playing' | 'gameover';
export type PlayerRole = 'host' | 'guest';
export type GameOutcome = 'win' | 'loss' | 'draw';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  color: 'blue' | 'red';
  score: number;
  isActive: boolean; // whose turn it is
  socketId?: string;
}

export interface Orb {
  color: 'blue' | 'red' | 'neutral';
  mass: number;
}

export interface BoardState {
  grid: (Orb | null)[][];
  scores: Record<string, number>;
  turn: string; // player id
  turnNumber: number;
  gameStartedAt: number;
  lastMoveAt: number;
}

export interface GameRoom {
  id: string;
  name: string;
  host: Player;
  guest?: Player;
  status: 'waiting' | 'playing' | 'finished';
  boardState: BoardState;
  createdAt: number;
  maxPlayers: number;
}

export interface GameMove {
  playerId: string;
  row: number;
  col: number;
  timestamp: number;
}

export interface MoveValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ExplosionResult {
  scores: Record<string, number>;
  newGrid: (Orb | null)[][];
  cellsAffected: Set<string>;
}

export interface AnimationFrame {
  type: 'move' | 'explosion' | 'shake' | 'spawn' | 'particle';
  timestamp: number;
  duration: number;
  data: Record<string, any>;
}

// ============================================================================
// CLIENT STATE TYPES
// ============================================================================

export interface ClientGameState {
  phase: GamePhase;
  room: GameRoom | null;
  players: Player[];
  currentPlayer: Player | null;
  boardState: BoardState | null;
  pendingAnimation: AnimationFrame | null;
  gameHistory: GameMove[];
  error: string | null;
  selectedCell: [number, number] | null;
  isSubmittingMove: boolean;
  soundEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

// ============================================================================
// SOCKET.IO EVENT TYPES
// ============================================================================

export interface SocketEvents {
  // Emit from client
  'player:join': { playerName: string };
  'room:create': { roomName: string };
  'room:join': { roomId: string; playerName: string };
  'game:start': { roomId: string };
  'game:move': { roomId: string; move: GameMove };
  'chat:send': { roomId: string; message: string };

  // Receive on client
  'player:joined': { players: Player[] };
  'room:created': { room: GameRoom };
  'room:updated': { room: GameRoom };
  'game:started': { boardState: BoardState };
  'game:moveReceived': {
    move: GameMove;
    boardState: BoardState;
    scores: Record<string, number>;
  };
  'game:invalid-move': { reason: string };
  'game:finished': { outcome: GameOutcome; winner?: Player };
  'chat:message': ChatMessage;
  'player:left': { playerId: string };
}

// ============================================================================
// RENDERING TYPES
// ============================================================================

export interface ParticleData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface OrbAnimationState {
  row: number;
  col: number;
  targetRow?: number;
  targetCol?: number;
  startTime: number;
  duration: number;
  scale: number;
  opacity: number;
  particles: ParticleData[];
}

export interface ScreenShakeState {
  intensity: number;
  duration: number;
  startTime: number;
}
