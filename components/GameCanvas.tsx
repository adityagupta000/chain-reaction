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
  const isAnimating = useGameStore((s) => s.isAnimating);
  const pendingMoveQueue = useGameStore((s) => s.pendingMoveQueue);
  const gameError = useGameStore((s) => s.error);
  const { submitMove } = useSocketEmit();

  const [turnWarning, setTurnWarning] = useState(false);
  const [errorWarning, setErrorWarning] = useState(false);
  const [chainCount, setChainCount] = useState(0);
  const [eliminationMsg, setEliminationMsg] = useState<string | null>(null);
  const turnWarningTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const errorWarningTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const eliminationTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastErrorRef = useRef<string>("");

  // Keep latest values in refs so click handler never goes stale
  const isMyTurnRef = useRef(isMyTurn);
  const boardStateRef = useRef(boardState);
  const isSubmittingRef = useRef(isSubmittingMove);
  const isAnimatingRef = useRef(isAnimating);
  const playerIdRef = useRef(playerId);
  const roomIdRef = useRef(roomId);

  isMyTurnRef.current = isMyTurn;
  boardStateRef.current = boardState;
  isSubmittingRef.current = isSubmittingMove;
  isAnimatingRef.current = isAnimating;
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

  // ── CHAIN ANIMATION: consume from pendingMoveQueue ──
  useEffect(() => {
    const pending = pendingMoveQueue[0];
    if (!pending || !rendererRef.current || !boardState || !room?.players)
      return;
    if (rendererRef.current.isChainAnimating) return; // wait for current animation

    const renderer = rendererRef.current;
    const preMoveGrid = boardState.grid;

    useGameStore.getState().setAnimating(true);
    setChainCount(0);

    renderer.startChainAnimation(
      preMoveGrid,
      pending.move.row,
      pending.move.col,
      pending.move.playerIndex,
      pending.explosionSequence,
      pending.boardState.grid,
      room.players,
      // onChainStep
      (step: number) => {
        setChainCount(step);
      },
      // onElimination
      (playerIndex: number) => {
        const eliminatedPlayer = room.players[playerIndex];
        if (eliminatedPlayer) {
          setEliminationMsg(`${eliminatedPlayer.name} eliminated!`);
          if (eliminationTimer.current) clearTimeout(eliminationTimer.current);
          eliminationTimer.current = setTimeout(
            () => setEliminationMsg(null),
            1500,
          );
        }
      },
      // onComplete
      () => {
        // Apply final board state and remove from queue
        useGameStore.getState().setBoardState(pending.boardState);
        useGameStore.getState().shiftPendingMoveQueue();
        setChainCount(0);

        // Handle game over with celebration delay
        if (pending.winner) {
          renderer.triggerVictoryFlash();
          useGameStore.getState().setAnimating(false);
          useGameStore.getState().setPendingGameFinish({
            outcome: "win",
            winner: pending.winner,
          });
          setTimeout(() => {
            useGameStore.getState().setPhase("gameover");
            useGameStore.getState().setPendingGameFinish(null);
          }, 1500);
        } else {
          // Check if there are more queued results — if not, stop animating
          const remaining = useGameStore.getState().pendingMoveQueue;
          if (remaining.length === 0) {
            useGameStore.getState().setAnimating(false);
          }
          // If there ARE more, the effect will re-fire because queue changed
        }
      },
    );
  }, [pendingMoveQueue.length, boardState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Click handler — uses refs so it never goes stale
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleCanvasClick = (e: MouseEvent) => {
      if (
        !boardStateRef.current ||
        isSubmittingRef.current ||
        isAnimatingRef.current ||
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
      if (eliminationTimer.current) clearTimeout(eliminationTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Extract the current turn player's color to use as a stable dependency
  const currentTurnPlayerColor =
    room?.players?.[boardState?.currentPlayerIndex ?? -1]?.color || null;
  const selectedCellKey = selectedCell
    ? `${selectedCell[0]},${selectedCell[1]}`
    : null;

  // Unified effect: set grid color and render board (only when NOT animating)
  useEffect(() => {
    if (!boardState || !rendererRef.current || !room?.players) return;
    if (rendererRef.current.isChainAnimating) return; // don't push grid during animation

    // Set grid color based on current turn player
    if (currentTurnPlayerColor) {
      rendererRef.current.setGridColor(currentTurnPlayerColor);
    }

    // Update selected cell
    if (selectedCell) {
      rendererRef.current.setSelectedCell(selectedCell[0], selectedCell[1]);
    } else {
      rendererRef.current.setSelectedCell(null, null);
    }

    // Render with the color already set
    rendererRef.current.renderOnce(boardState.grid, room.players);
  }, [
    currentTurnPlayerColor,
    selectedCellKey,
    boardState?.grid.length,
    room?.players.length,
    isAnimating,
  ]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          cursor:
            isMyTurn && !isSubmittingMove && !isAnimating
              ? "pointer"
              : "default",
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
      {eliminationMsg && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-red-900/80 text-red-100 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl backdrop-blur-sm border border-red-500/40">
            {eliminationMsg}
          </div>
        </div>
      )}
    </div>
  );
}
