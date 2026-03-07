"use client";

import { create } from "zustand";
import type {
  ClientGameState,
  GamePhase,
  Player,
  GameRoom,
  BoardState,
  GameMove,
  AnimationFrame,
  ChatMessage,
} from "./types";

interface GameStore extends ClientGameState {
  // Phase management
  setPhase: (phase: GamePhase) => void;

  // Player management
  setCurrentPlayer: (player: Player | null) => void;
  setPlayers: (players: Player[]) => void;

  // Room management
  setRoom: (room: GameRoom | null) => void;
  setBoardState: (boardState: BoardState | null) => void;

  // Move management
  selectCell: (row: number, col: number) => void;
  clearSelection: () => void;
  setSubmittingMove: (submitting: boolean) => void;
  addToHistory: (move: GameMove) => void;
  clearHistory: () => void;

  // Animation
  setPendingAnimation: (animation: AnimationFrame | null) => void;

  // Game finish
  setPendingGameFinish: (
    data: { outcome: string; winner?: any } | null,
  ) => void;

  // Error handling
  setError: (error: string | null) => void;

  // Sound
  toggleSound: () => void;

  // Reset
  reset: () => void;
}

const initialState: ClientGameState = {
  phase: "lobby",
  room: null,
  players: [],
  currentPlayer: null,
  boardState: null,
  pendingAnimation: null,
  gameHistory: [],
  error: null,
  selectedCell: null,
  isSubmittingMove: false,
  soundEnabled: true,
  pendingGameFinish: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),

  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  setPlayers: (players) => set({ players }),

  setRoom: (room) => set({ room }),
  setBoardState: (boardState) => set({ boardState }),

  selectCell: (row, col) => {
    set((state) => {
      // Toggle selection
      if (state.selectedCell?.[0] === row && state.selectedCell?.[1] === col) {
        return { selectedCell: null };
      }
      return { selectedCell: [row, col] };
    });
  },

  clearSelection: () => set({ selectedCell: null }),

  setSubmittingMove: (submitting) => set({ isSubmittingMove: submitting }),

  addToHistory: (move) => {
    set((state) => ({
      gameHistory: [...state.gameHistory, move],
    }));
  },

  clearHistory: () => set({ gameHistory: [] }),

  setPendingAnimation: (animation) => set({ pendingAnimation: animation }),

  setPendingGameFinish: (data) => set({ pendingGameFinish: data }),

  setError: (error) => set({ error }),

  toggleSound: () => {
    set((state) => ({
      soundEnabled: !state.soundEnabled,
    }));
  },

  reset: () => set(initialState),
}));

// ============================================================================
// SELECTORS
// ============================================================================

export const useGamePhase = () => useGameStore((state) => state.phase);
export const useCurrentPlayer = () =>
  useGameStore((state) => state.currentPlayer);
export const useRoom = () => useGameStore((state) => state.room);
export const useBoardState = () => useGameStore((state) => state.boardState);
export const useSelectedCell = () =>
  useGameStore((state) => state.selectedCell);
export const useIsSubmittingMove = () =>
  useGameStore((state) => state.isSubmittingMove);
export const useGameError = () => useGameStore((state) => state.error);
export const useSoundEnabled = () =>
  useGameStore((state) => state.soundEnabled);
export const usePendingAnimation = () =>
  useGameStore((state) => state.pendingAnimation);
export const useGameHistory = () => useGameStore((state) => state.gameHistory);

// Helper selector to determine if it's the current player's turn
export const useIsMyTurn = (playerId?: string) => {
  const boardState = useGameStore((state) => state.boardState);
  return boardState?.turn === playerId;
};

// Helper selector to get scores
export const useScores = () => {
  const boardState = useGameStore((state) => state.boardState);
  return boardState?.scores || {};
};
