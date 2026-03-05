'use client';

import { useEffect, useState } from 'react';
import { useGameStore, useGamePhase, useBoardState, useRoom } from '@/lib/store';
import { useSocket, useSocketEmit } from '@/hooks/useSocket';
import { Lobby } from './Lobby';
import { WaitingRoom } from './WaitingRoom';
import { GameCanvas } from './GameCanvas';
import { GameHUD } from './GameHUD';
import { GameOver } from './GameOver';
import { nanoid } from 'nanoid';

export function Game() {
  const phase = useGamePhase();
  const boardState = useBoardState();
  const room = useRoom();
  const setPhase = useGameStore((s) => s.setPhase);
  const setError = useGameStore((s) => s.setError);
  const [playerId, setPlayerId] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  // Initialize socket
  useSocket();

  // Restore player ID on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem('playerId') || nanoid();
      localStorage.setItem('playerId', storedId);
      setPlayerId(storedId);
      setMounted(true);
    }
  }, []);

  // Wait for hydration
  if (!mounted || !playerId) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Determine current player's color and turn
  const playerColor = room?.host.id === playerId ? room.host.color : room?.guest?.color;
  const isMyTurn = boardState?.turn === playerId;

  // Render based on phase
  if (phase === 'lobby') {
    return <Lobby />;
  }

  if (phase === 'waiting') {
    return <WaitingRoom />;
  }

  if (phase === 'playing' && room && boardState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <GameHUD playerId={playerId} />
        
        <main className="max-w-7xl mx-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Canvas */}
            <div className="lg:col-span-2">
              <GameCanvas
                roomId={room.id}
                playerId={playerId}
                playerColor={playerColor as 'blue' | 'red'}
                isMyTurn={isMyTurn}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <GameInfo room={room} playerId={playerId} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'gameover') {
    return <GameOver />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>
  );
}

function GameInfo({ room, playerId }: { room: any; playerId: string }) {
  const isHost = room?.host.id === playerId;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Players</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-white text-sm">
              {room?.host.name}
              {isHost && <span className="text-xs text-slate-400 ml-2">(You)</span>}
            </span>
          </div>
          {room?.guest && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-white text-sm">
                {room.guest.name}
                {!isHost && <span className="text-xs text-slate-400 ml-2">(You)</span>}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-700 pt-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Room ID</h3>
        <code className="text-xs font-mono bg-slate-900 p-2 rounded block text-slate-300 break-all">
          {room?.id}
        </code>
      </div>

      <div className="bg-blue-900/30 border border-blue-600 rounded p-3">
        <p className="text-xs text-blue-200">
          Share this room ID with your opponent to join!
        </p>
      </div>
    </div>
  );
}
