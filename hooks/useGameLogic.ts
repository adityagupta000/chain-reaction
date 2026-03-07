'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useGameStore, useBoardState, useRoom, useIsSubmittingMove } from '@/lib/store';
import { useSocketEmit } from './useSocket';
import { getSoundManager } from '@/lib/soundManager';
import { nanoid } from 'nanoid';

/**
 * Hook for handling game move logic and animations
 */
export function useGameMove(playerId: string) {
  const setError = useGameStore((s) => s.setError);
  const setSubmittingMove = useGameStore((s) => s.setSubmittingMove);
  const clearSelection = useGameStore((s) => s.clearSelection);
  const setBoardState = useGameStore((s) => s.setBoardState);
  const boardState = useBoardState();
  const room = useRoom();
  const soundManager = useRef(getSoundManager());
  const { submitMove } = useSocketEmit();
  const isSubmitting = useIsSubmittingMove();

  const handleMove = useCallback(
    (row: number, col: number) => {
      if (!boardState || !room || isSubmitting) {
        setError('Cannot make move right now');
        return;
      }

      // Check if cell is valid
      const cell = boardState.grid[row][col];
      if (!cell) {
        setError('Cell is empty');
        return;
      }

      // Play sound
      soundManager.current?.orbClick();

      // Submit move
      setSubmittingMove(true);
      const move = {
        playerId,
        row,
        col,
        timestamp: Date.now(),
      };

      submitMove(room.id, move);
    },
    [boardState, room, playerId, isSubmitting, submitMove, setError, setSubmittingMove]
  );

  return { handleMove };
}

/**
 * Hook for game timer and turn timeout
 */
export function useGameTimer() {
  const boardState = useBoardState();
  const room = useRoom();
  const { submitMove } = useSocketEmit();
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    if (!boardState || !room || room.status !== 'playing') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const currentPlayerIndex = boardState.currentPlayerIndex;
    const currentPlayer = room.players?.[currentPlayerIndex];
    if (!currentPlayer) return;

    // Auto-submit move if turn times out
    timeoutRef.current = setTimeout(() => {
      console.log('[Game] Turn timeout - auto-submitting move');

      const rows = boardState.grid.length;
      const cols = boardState.grid[0]?.length || 0;

      // Get a random valid move for the current player
      const validMoves: [number, number][] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = boardState.grid[r][c];
          if (cell.orbs === 0 || cell.owner === currentPlayerIndex) {
            validMoves.push([r, c]);
          }
        }
      }

      if (validMoves.length > 0) {
        const [row, col] = validMoves[Math.floor(Math.random() * validMoves.length)];
        submitMove(room.id, {
          playerId: currentPlayer.id,
          row,
          col,
          timestamp: Date.now(),
        });
      }
    }, 30000); // 30 second timeout

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [boardState?.currentPlayerIndex, room, boardState, submitMove]);
}

/**
 * Hook for sound effects during gameplay
 */
export function useGameSounds(enabled: boolean) {
  const soundManager = useRef(getSoundManager());

  useEffect(() => {
    soundManager.current?.setEnabled(enabled);
  }, [enabled]);

  return {
    playExplosion: () => soundManager.current?.explosion(),
    playChainReaction: () => soundManager.current?.chainReaction(),
    playTurnChange: () => soundManager.current?.turnChange(),
    playGameOver: () => soundManager.current?.gameOver(),
    playClick: () => soundManager.current?.orbClick(),
  };
}

/**
 * Hook for handling page visibility and re-join logic
 */
export function useGameRejoin(playerId: string) {
  const setError = useGameStore((s) => s.setError);
  const room = useRoom();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && room) {
        // Page is now visible - reconnect if needed
        console.log('[Game] Page is now visible - re-establishing connection');
        // Socket auto-reconnects, but we could add explicit logic here
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [room]);
}
