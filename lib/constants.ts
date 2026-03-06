// ============================================================================
// GRID & RENDERING
// ============================================================================

export const GRID_SIZE = 6;
export const CELL_SIZE = 60;
export const CELL_GAP = 4;
export const BOARD_PADDING = 20;

export const BOARD_WIDTH =
  GRID_SIZE * CELL_SIZE + (GRID_SIZE - 1) * CELL_GAP + BOARD_PADDING * 2;
export const BOARD_HEIGHT =
  GRID_SIZE * CELL_SIZE + (GRID_SIZE - 1) * CELL_GAP + BOARD_PADDING * 2;

// ============================================================================
// ANIMATION TIMINGS (ms)
// ============================================================================

export const ANIMATION_DURATIONS = {
  orbMove: 400,
  orbSpawn: 300,
  orbExplode: 500,
  particleLife: 800,
  screenShake: 300,
  turnTransition: 1000,
};

export const ANIMATION_DELAYS = {
  chainReaction: 100, // delay between explosion waves
  particleEmit: 50,
};

// ============================================================================
// GAME SETTINGS
// ============================================================================

export const GAME_SETTINGS = {
  maxPlayers: 5,
  turnTimeoutMs: 30000, // 30 seconds
  minPlayersToStart: 2,
  spawnProbability: 0.4,
  maxOrbMass: 4,
};

// ============================================================================
// COLORS
// ============================================================================

export const COLORS: Record<string, string> = {
  blue: "#3B82F6",
  red: "#EF4444",
  green: "#22C55E",
  yellow: "#EAB308",
  purple: "#A855F7",
  neutral: "#9CA3AF",
  background: "#0F172A",
  surface: "#1E293B",
  border: "#334155",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  success: "#10B981",
  danger: "#EF4444",
};

export const ORB_COLORS: Record<string, string> = {
  blue: "#3B82F6",
  red: "#EF4444",
  green: "#22C55E",
  yellow: "#EAB308",
  purple: "#A855F7",
  neutral: "#9CA3AF",
};

export const PARTICLE_COLORS: Record<string, string[]> = {
  blue: ["#3B82F6", "#60A5FA", "#BFDBFE"],
  red: ["#EF4444", "#F87171", "#FECACA"],
  green: ["#22C55E", "#4ADE80", "#BBF7D0"],
  yellow: ["#EAB308", "#FACC15", "#FEF08A"],
  purple: ["#A855F7", "#C084FC", "#E9D5FF"],
  neutral: ["#9CA3AF", "#CBD5E1", "#E2E8F0"],
};

// ============================================================================
// UI SIZES
// ============================================================================

export const SIZES = {
  xs: "8px",
  sm: "12px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  "2xl": "40px",
};

export const BORDER_RADIUS = {
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
};

// ============================================================================
// Z-INDEX
// ============================================================================

export const Z_INDEX = {
  background: 0,
  board: 10,
  particles: 15,
  ui: 20,
  modal: 30,
  toast: 40,
};

// ============================================================================
// SOUNDS
// ============================================================================

export const SOUNDS = {
  orbClick: "/sounds/orb-click.mp3",
  explosion: "/sounds/explosion.mp3",
  chainReaction: "/sounds/chain-reaction.mp3",
  gameOver: "/sounds/game-over.mp3",
  turnChange: "/sounds/turn-change.mp3",
  buttonClick: "/sounds/button-click.mp3",
};
