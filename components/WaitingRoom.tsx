'use client';

import { useRoom } from '@/lib/store';
import { useSocketEmit } from '@/hooks/useSocket';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Share2, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export function WaitingRoom() {
  const room = useRoom();
  const { startGame } = useSocketEmit();
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(room.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    if (room.guest) {
      startGame(room.id);
    }
  };

  const isHost = room.host.id === room.host.id; // Simplified - should check auth
  const readyToStart = !!room.guest;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <div className="p-8">
          <h2 className="text-3xl font-bold text-white mb-6">Room: {room.name}</h2>

          <div className="space-y-4 mb-6">
            {/* Room ID Section */}
            <div className="bg-slate-700 rounded-lg p-4">
              <p className="text-sm text-slate-400 mb-2">Room ID</p>
              <div className="flex items-center justify-between">
                <code className="font-mono text-white text-sm">{room.id}</code>
                <button
                  onClick={handleCopyRoomId}
                  className="p-2 hover:bg-slate-600 rounded"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Players Section */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Players</p>
              <PlayerCard player={room.host} status="Host" color="blue" />
              {room.guest ? (
                <PlayerCard player={room.guest} status="Joined" color="red" />
              ) : (
                <div className="bg-slate-700 rounded-lg p-4 text-center text-slate-400">
                  Waiting for opponent...
                </div>
              )}
            </div>
          </div>

          {isHost && (
            <Button
              onClick={handleStartGame}
              disabled={!readyToStart}
              className={`w-full mb-4 ${
                readyToStart
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-slate-600 cursor-not-allowed'
              }`}
            >
              {readyToStart ? 'Start Game' : 'Waiting for Player...'}
            </Button>
          )}

          {!isHost && (
            <div className="bg-blue-900/50 border border-blue-600 rounded-lg p-4 text-center text-blue-200 mb-4">
              Waiting for host to start...
            </div>
          )}

          <Button
            variant="outline"
            className="w-full border-slate-600 text-slate-300"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share Link
          </Button>
        </div>
      </Card>
    </div>
  );
}

function PlayerCard({
  player,
  status,
  color,
}: {
  player: any;
  status: string;
  color: 'blue' | 'red';
}) {
  const bgColor = color === 'blue' ? 'bg-blue-900/30' : 'bg-red-900/30';
  const borderColor = color === 'blue' ? 'border-blue-600' : 'border-red-600';
  const dotColor = color === 'blue' ? 'bg-blue-500' : 'bg-red-500';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4 flex items-center gap-3`}>
      <div className={`w-3 h-3 rounded-full ${dotColor}`} />
      <div className="flex-1">
        <p className="font-semibold text-white">{player.name}</p>
        <p className="text-sm text-slate-400">{status}</p>
      </div>
    </div>
  );
}
