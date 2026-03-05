'use client';

import { useEffect, useRef, useState } from 'react';
import { useBoardState, useSelectedCell, useIsSubmittingMove } from '@/lib/store';
import { useSocketEmit } from '@/hooks/useSocket';
import { BoardRenderer } from '@/lib/rendering';
import { nanoid } from 'nanoid';

interface GameCanvasProps {
  roomId: string;
  playerId: string;
  playerColor: 'blue' | 'red';
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
  const selectedCell = useSelectedCell();
  const isSubmittingMove = useIsSubmittingMove();
  const { submitMove } = useSocketEmit();
  const [loading, setLoading] = useState(true);

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new BoardRenderer(canvasRef.current);
    rendererRef.current = renderer;

    // Add click handler
    const handleCanvasClick = (e: MouseEvent) => {
      if (!isMyTurn || !boardState || isSubmittingMove) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert click coordinates to grid position
      // Import at top of component to avoid dynamic imports
      // Using hardcoded constants for click detection
      const BOARD_PADDING = 20;
      const CELL_SIZE = 60;
      const CELL_GAP = 4;
      const col = Math.floor((x - BOARD_PADDING) / (CELL_SIZE + CELL_GAP));
      const row = Math.floor((y - BOARD_PADDING) / (CELL_SIZE + CELL_GAP));

      if (row >= 0 && row < 6 && col >= 0 && col < 6) {
        // Submit move
        const move = {
          playerId,
          row,
          col,
          timestamp: Date.now(),
        };

        submitMove(roomId, move);
      }
    };

    canvasRef.current.addEventListener('click', handleCanvasClick);
    setLoading(false);

    return () => {
      canvasRef.current?.removeEventListener('click', handleCanvasClick);
      renderer.destroy();
    };
  }, [isMyTurn, boardState, isSubmittingMove, playerId, roomId, submitMove]);

  // Render board
  useEffect(() => {
    if (!boardState || !rendererRef.current) return;

    if (selectedCell) {
      rendererRef.current.setSelectedCell(selectedCell[0], selectedCell[1]);
    } else {
      rendererRef.current.setSelectedCell(null, null);
    }

    // Start rendering loop
    rendererRef.current.render(boardState.grid);
  }, [boardState, selectedCell]);

  return (
    <div className="relative w-full aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        style={{
          opacity: isSubmittingMove ? 0.5 : 1,
          pointerEvents: isMyTurn && !isSubmittingMove ? 'auto' : 'none',
        }}
      />
      {!isMyTurn && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <p className="text-white font-semibold">Opponent's Turn</p>
        </div>
      )}
      {isSubmittingMove && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
