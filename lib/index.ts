/**
 * Central exports for all game libraries
 * Import commonly used types and functions from here
 */

// Types
export * from './types';

// Game Logic
export {
  initializeBoard,
  createBoardState,
  validateMove,
  applyMove,
  getNextTurn,
  getValidMoves,
  isGameOver,
  getWinner,
  GRID_SIZE_EXPORT as GRID_SIZE,
  MAX_MASS_EXPORT as MAX_MASS,
} from './gameEngine';

// State Management
export { useGameStore } from './store';
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
} from './store';

// Rendering
export {
  ParticleSystem,
  OrbAnimator,
  ScreenShaker,
  BoardRenderer,
} from './rendering';

// Sound
export { getSoundManager, SoundManager } from './soundManager';

// Constants
export * from './constants';
