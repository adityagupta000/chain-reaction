"use client";

import { useEffect, useRef, useState } from "react";
import {
  useBoardState,
  useSelectedCell,
  useIsSubmittingMove,
  useRoom,
  useGameStore,
} from "@/lib/store";
import { useSocketEmit } from "@/hooks/useSocket";
import { BoardRenderer } from "@/lib/rendering";
import type { PlayerColor } from "@/lib/types";

interface GameCanvasProps {
  roomId: string;
  playerId: string;
  playerColor: PlayerColor;
  isMyTurn: boolean;
}

export function GameCanvas({
  roomId,
  playerId,
  playerColor,
  isMyTurn,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);
  const boardState = useBoardState();
  const room = useRoom();
  const selectedCell = useSelectedCell();
  const isSubmittingMove = useIsSubmittingMove();
  const gameError = useGameStore((s) => s.error);
  const { submitMove } = useSocketEmit();

  const [turnWarning, setTurnWarning] = useState(false);
  const [errorWarning, setErrorWarning] = useState(false);
  const turnWarningTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const errorWarningTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastErrorRef = useRef<string>("");

  // Keep latest values in refs so click handler never goes stale
  const isMyTurnRef = useRef(isMyTurn);
  const boardStateRef = useRef(boardState);
  const isSubmittingRef = useRef(isSubmittingMove);
  const playerIdRef = useRef(playerId);
  const roomIdRef = useRef(roomId);

  isMyTurnRef.current = isMyTurn;
  boardStateRef.current = boardState;
  isSubmittingRef.current = isSubmittingMove;
  playerIdRef.current = playerId;
  roomIdRef.current = roomId;

  const gridRows = room?.gridRows || 9;
  const gridCols = room?.gridCols || 6;

  // Watch for game errors and show warning popup
  useEffect(() => {
    if (gameError && gameError !== lastErrorRef.current) {
      lastErrorRef.current = gameError;
      setErrorWarning(true);
      if (errorWarningTimer.current) clearTimeout(errorWarningTimer.current);
      errorWarningTimer.current = setTimeout(
        () => setErrorWarning(false),
        2500,
      );
    }
  }, [gameError]);

  // Handle delayed game finish (wait for explosions to complete)
  useEffect(() => {
    const pendingFinish = useGameStore.getState().pendingGameFinish;
    if (!pendingFinish || !rendererRef.current) return;

    // Check if explosions are still active
    if (rendererRef.current.hasActiveExplosions()) {
      // Still animating - check again soon
      const timer = setTimeout(() => {
        // This will be called repeatedly until explosions are done
      }, 50);
      return () => clearTimeout(timer);
    }

    // Explosions are done - now transition to gameover
    useGameStore.getState().setPhase("gameover");
    useGameStore.getState().setPendingGameFinish(null);
  }, []);

  // Check pending finish status continuously while playing
  useEffect(() => {
    if (!rendererRef.current) return;

    const checkFinish = () => {
      const pendingFinish = useGameStore.getState().pendingGameFinish;
      if (pendingFinish && !rendererRef.current?.hasActiveExplosions()) {
        useGameStore.getState().setPhase("gameover");
        useGameStore.getState().setPendingGameFinish(null);
      }
    };

    const interval = setInterval(checkFinish, 50);
    return () => clearInterval(interval);
  }, []);

  // Initialize renderer ONCE (only re-create if grid size changes)
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new BoardRenderer(canvasRef.current, gridRows, gridCols);
    rendererRef.current = renderer;

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [gridRows, gridCols]);

  // Click handler — uses refs so it never goes stale
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleCanvasClick = (e: MouseEvent) => {
      if (
        !boardStateRef.current ||
        isSubmittingRef.current ||
        !rendererRef.current
      )
        return;

      // Show warning if it's not this player's turn
      if (!isMyTurnRef.current) {
        setTurnWarning(true);
        if (turnWarningTimer.current) clearTimeout(turnWarningTimer.current);
        turnWarningTimer.current = setTimeout(
          () => setTurnWarning(false),
          1500,
        );
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cell = rendererRef.current.getCellFromPixel(x, y);
      if (cell) {
        const [row, col] = cell;
        submitMove(roomIdRef.current, {
          playerId: playerIdRef.current,
          row,
          col,
          timestamp: Date.now(),
        });
      }
    };

    canvas.addEventListener("click", handleCanvasClick);
    return () => {
      canvas.removeEventListener("click", handleCanvasClick);
      if (turnWarningTimer.current) clearTimeout(turnWarningTimer.current);
      if (errorWarningTimer.current) clearTimeout(errorWarningTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Render board whenever state changes
  useEffect(() => {
    if (!boardState || !rendererRef.current) return;

    if (selectedCell) {
      rendererRef.current.setSelectedCell(selectedCell[0], selectedCell[1]);
    } else {
      rendererRef.current.setSelectedCell(null, null);
    }

    rendererRef.current.renderOnce(boardState.grid, room?.players || []);
  }, [boardState, selectedCell, room?.players]);

  // Update grid color based on whose turn it is
  useEffect(() => {
    if (!rendererRef.current || !boardState) return;

    // Find the current turn player by index
    const currentRoom = room;
    if (currentRoom?.players && boardState.currentPlayerIndex !== undefined) {
      const turnPlayer = currentRoom.players[boardState.currentPlayerIndex];
      if (turnPlayer) {
        rendererRef.current.setGridColor(turnPlayer.color);
      }
    }
  }, [boardState?.currentPlayerIndex, room?.players]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          cursor: isMyTurn && !isSubmittingMove ? "pointer" : "default",
          opacity: isSubmittingMove ? 0.7 : 1,
        }}
      />
      {isSubmittingMove && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {turnWarning && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-red-600/90 text-white px-6 py-3 rounded-lg font-semibold text-sm shadow-lg backdrop-blur-sm">
            Not your turn!
          </div>
        </div>
      )}
      {errorWarning && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-red-600/40 text-red-50 px-6 py-3 rounded-lg font-semibold text-sm shadow-lg backdrop-blur-md border border-red-500/30">
            {gameError}
          </div>
        </div>
      )}
    </div>
  );
}
