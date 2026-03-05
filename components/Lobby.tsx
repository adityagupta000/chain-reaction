'use client';

import { useState } from 'react';
import { useSocketEmit } from '@/hooks/useSocket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export function Lobby() {
  const [playerName, setPlayerName] = useState('');
  const [roomNameInput, setRoomNameInput] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const { joinAsPlayer, createRoom, joinRoom } = useSocketEmit();

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !roomNameInput.trim()) return;

    joinAsPlayer(playerName);
    createRoom(roomNameInput);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !roomIdInput.trim()) return;

    joinAsPlayer(playerName);
    joinRoom(roomIdInput, playerName);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <div className="p-8">
          <h1 className="text-4xl font-bold text-center mb-2 text-white">
            Chain Reaction
          </h1>
          <p className="text-center text-slate-400 mb-8">
            Tap to expand your orbs and create explosive chain reactions!
          </p>

          {mode === 'menu' && (
            <div className="space-y-4">
              <Input
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
              />

              <Button
                onClick={() => setMode('create')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Create Room
              </Button>

              <Button
                onClick={() => setMode('join')}
                variant="outline"
                className="w-full border-slate-600 text-white hover:bg-slate-700"
              >
                Join Room
              </Button>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <Input
                placeholder="Room name"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
              />

              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                Create & Wait
              </Button>

              <Button
                type="button"
                onClick={() => setMode('menu')}
                variant="ghost"
                className="w-full text-slate-400"
              >
                Back
              </Button>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <Input
                placeholder="Room ID"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
              />

              <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">
                Join Room
              </Button>

              <Button
                type="button"
                onClick={() => setMode('menu')}
                variant="ghost"
                className="w-full text-slate-400"
              >
                Back
              </Button>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
