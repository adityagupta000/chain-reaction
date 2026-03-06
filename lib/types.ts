// ============================================================================
// GAME STATE TYPES
// ============================================================================

export type GamePhase = "lobby" | "waiting" | "playing" | "gameover";
export type PlayerRole = "host" | "guest";
export type GameOutcome = "win" | "loss" | "draw";

export type PlayerColor = "blue" | "red" | "green" | "yellow" | "purple";

export const AVAILABLE_COLORS: {
  value: PlayerColor;
  label: string;
  hex: string;
}[] = [
  { value: "blue", label: "Blue", hex: "#3B82F6" },
  { value: "red", label: "Red", hex: "#EF4444" },
  { value: "green", label: "Green", hex: "#22C55E" },
  { value: "yellow", label: "Yellow", hex: "#EAB308" },
  { value: "purple", label: "Purple", hex: "#A855F7" },
];

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  color: PlayerColor;
  score: number;
  isActive: boolean; // whose turn it is
  socketId?: string;
}

export interface Orb {
  color: PlayerColor | "neutral";
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
  players: Player[];
  status: "waiting" | "playing" | "finished";
  boardState: BoardState;
  createdAt: number;
  maxPlayers: number;
  gridRows: number;
  gridCols: number;
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
  type: "move" | "explosion" | "shake" | "spawn" | "particle";
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
  "player:join": { playerName: string };
  "room:create": {
    roomName: string;
    maxPlayers: number;
    color: PlayerColor;
    gridRows: number;
    gridCols: number;
  };
  "room:join": { roomId: string; playerName: string; color: PlayerColor };
  "color:change": { roomId: string; color: PlayerColor };
  "game:start": { roomId: string };
  "game:move": { roomId: string; move: GameMove };
  "chat:send": { roomId: string; message: string };

  // Receive on client
  "player:joined": { players: Player[] };
  "room:created": { room: GameRoom };
  "room:updated": { room: GameRoom };
  "color:unavailable": { message: string; takenColors: PlayerColor[] };
  "game:started": { boardState: BoardState };
  "game:moveReceived": {
    move: GameMove;
    boardState: BoardState;
    scores: Record<string, number>;
  };
  "game:invalid-move": { reason: string };
  "game:finished": { outcome: GameOutcome; winner?: Player };
  "chat:message": ChatMessage;
  "player:left": { playerId: string };
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
