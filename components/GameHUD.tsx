'use client';

import { useRoom, useBoardState, useGameStore } from '@/lib/store';
import { GAME_SETTINGS } from '@/lib/constants';
import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface GameHUDProps {
  playerId: string;
}

export function GameHUD({ playerId }: GameHUDProps) {
  const room = useRoom();
  const boardState = useBoardState();
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const [timeLeft, setTimeLeft] = useState(GAME_SETTINGS.turnTimeoutMs / 1000);

  const currentPlayer = room?.host.id === boardState?.turn ? room.host : room?.guest;
  const scores = boardState?.scores || {};

  // Update turn timer
  useEffect(() => {
    if (!boardState?.lastMoveAt) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - boardState.lastMoveAt;
      const remaining = Math.max(
        0,
        GAME_SETTINGS.turnTimeoutMs - elapsed
      );
      setTimeLeft(Math.ceil(remaining / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [boardState?.lastMoveAt]);

  if (!room) return null;

  return (
    <div className="bg-slate-800 border-b border-slate-700 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Top Row: Players and Turn Timer */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-8">
            <PlayerScore
              name={room.host.name}
              score={scores[room.host.id] || 0}
              color="blue"
              isActive={boardState?.turn === room.host.id}
              isCurrentPlayer={playerId === room.host.id}
            />
            {room.guest && (
              <PlayerScore
                name={room.guest.name}
                score={scores[room.guest.id] || 0}
                color="red"
                isActive={boardState?.turn === room.guest.id}
                isCurrentPlayer={playerId === room.guest.id}
              />
            )}
          </div>

          {/* Turn Timer */}
          <div className="text-center">
            <div className={`text-3xl font-bold font-mono ${
              timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'
            }`}>
              {timeLeft}s
            </div>
            <p className="text-sm text-slate-400">
              {currentPlayer?.name}'s Turn
            </p>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Toggle sound"
          >
            {soundEnabled ? (
              <Volume2 className="w-6 h-6 text-slate-300" />
            ) : (
              <VolumeX className="w-6 h-6 text-slate-500" />
            )}
          </button>
        </div>

        {/* Game Stats */}
        <div className="flex justify-between text-sm text-slate-400">
          <div>
            Turn {boardState?.turnNumber || 0}
          </div>
          <div>
            Room: {room.id.slice(0, 8)}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerScore({
  name,
  score,
  color,
  isActive,
  isCurrentPlayer,
}: {
  name: string;
  score: number;
  color: 'blue' | 'red';
  isActive: boolean;
  isCurrentPlayer: boolean;
}) {
  const bgColor = color === 'blue' ? 'bg-blue-900/30' : 'bg-red-900/30';
  const borderColor = color === 'blue' ? 'border-blue-600' : 'border-red-600';
  const textColor = color === 'blue' ? 'text-blue-400' : 'text-red-400';
  const dotColor = color === 'blue' ? 'bg-blue-500' : 'bg-red-500';

  return (
    <div
      className={`${bgColor} border ${borderColor} rounded-lg p-4 ${
        isActive ? 'ring-2 ring-offset-2 ring-offset-slate-800 ' + (color === 'blue' ? 'ring-blue-500' : 'ring-red-500') : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${dotColor} ${isActive ? 'animate-pulse' : ''}`} />
        <div>
          <p className="font-semibold text-white">{name}</p>
          <p className={`text-sm ${textColor}`}>Score: {score}</p>
        </div>
      </div>
    </div>
  );
}
