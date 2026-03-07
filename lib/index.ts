/**
 * Central exports for all game libraries
 * Import commonly used types and functions from here
 */

// Types
export * from "./types";

// Game Logic
export {
  initializeBoard,
  createBoardState,
  isValidMove,
  applyMove,
  getNextActivePlayer,
  isGameOver,
  getWinner,
  computeScores,
  getCriticalMass,
  getEliminatedPlayers,
} from "./gameEngine";

// State Management
export { useGameStore } from "./store";
export {
  useGamePhase,
  useCurrentPlayer,
  useRoom,
  useBoardState,
  useSelectedCell,
  useIsSubmittingMove,
  useGameError,
  useSoundEnabled,
  usePendingAnimation,
  useGameHistory,
  useIsMyTurn,
  useScores,
} from "./store";

// Rendering
export { ParticleSystem, ScreenShaker, BoardRenderer } from "./rendering";

// Sound
export { getSoundManager, SoundManager } from "./soundManager";

// Constants
export * from "./constants";
