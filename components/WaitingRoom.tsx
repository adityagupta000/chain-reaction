"use client";

import { useRoom } from "@/lib/store";
import { useSocketEmit } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { AVAILABLE_COLORS, type PlayerColor } from "@/lib/types";

export function WaitingRoom() {
  const room = useRoom();
  const { startGame, changeColor } = useSocketEmit();
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(room.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    console.log("[WaitingRoom] Start Game clicked, roomId:", room.id);
    if (room.players && room.players.length >= 2) {
      startGame(room.id);
    }
  };

  // Get current player ID from localStorage
  const currentPlayerId =
    typeof window !== "undefined" ? localStorage.getItem("playerId") : null;

  const isHost = currentPlayerId === room.host.id;
  const players = room.players || [
    room.host,
    ...(room.guest ? [room.guest] : []),
  ];
  const readyToStart = players.length >= 2;
  const takenColors = players.map((p) => p.color);

  const handleColorChange = (color: PlayerColor) => {
    changeColor(room.id, color);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <div className="p-8">
          <h2 className="text-3xl font-bold text-white mb-2">{room.name}</h2>
          <p className="text-slate-400 text-sm mb-6">
            {players.length} / {room.maxPlayers} players &middot;{" "}
            {room.gridRows || 9}×{room.gridCols || 6} grid
          </p>

          <div className="space-y-4 mb-6">
            {/* Room ID Section */}
            <div className="bg-slate-700 rounded-lg p-4">
              <p className="text-sm text-slate-400 mb-2">
                Room ID (share this)
              </p>
              <div className="flex items-center justify-between">
                <code className="font-mono text-white text-sm break-all">
                  {room.id}
                </code>
                <button
                  onClick={handleCopyRoomId}
                  className="p-2 hover:bg-slate-600 rounded ml-2 flex-shrink-0"
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
              {players.map((player, idx) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isCurrentPlayer={player.id === currentPlayerId}
                  isHost={player.id === room.host.id}
                />
              ))}
              {/* Empty slots */}
              {Array.from({ length: room.maxPlayers - players.length }).map(
                (_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="bg-slate-700/50 border border-dashed border-slate-600 rounded-lg p-4 text-center text-slate-500 text-sm"
                  >
                    Waiting for player...
                  </div>
                ),
              )}
            </div>

            {/* Color changer for current player */}
            <div className="bg-slate-700/50 rounded-lg p-4">
              <p className="text-sm text-slate-400 mb-2">Change Your Color</p>
              <div className="flex gap-2">
                {AVAILABLE_COLORS.map(({ value, label, hex }) => {
                  const taken =
                    takenColors.includes(value) &&
                    players.find((p) => p.id === currentPlayerId)?.color !==
                      value;
                  const isMyColor =
                    players.find((p) => p.id === currentPlayerId)?.color ===
                    value;
                  return (
                    <button
                      key={value}
                      onClick={() => !taken && handleColorChange(value)}
                      disabled={taken}
                      title={taken ? `${label} is taken` : label}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                        isMyColor
                          ? "ring-2 ring-white text-white scale-105"
                          : taken
                            ? "opacity-30 cursor-not-allowed text-white"
                            : "text-white hover:scale-105"
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {isHost && (
            <Button
              onClick={handleStartGame}
              disabled={!readyToStart}
              className={`w-full mb-4 ${
                readyToStart
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-slate-600 cursor-not-allowed"
              }`}
            >
              {readyToStart
                ? `Start Game (${players.length} players)`
                : "Waiting for Players..."}
            </Button>
          )}

          {!isHost && (
            <div className="bg-blue-900/50 border border-blue-600 rounded-lg p-4 text-center text-blue-200 mb-4">
              Waiting for host to start the game...
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function PlayerCard({
  player,
  isCurrentPlayer,
  isHost,
}: {
  player: any;
  isCurrentPlayer: boolean;
  isHost: boolean;
}) {
  const colorInfo = AVAILABLE_COLORS.find((c) => c.value === player.color);
  const hex = colorInfo?.hex || "#9CA3AF";

  return (
    <div
      className="rounded-lg p-4 flex items-center gap-3"
      style={{
        backgroundColor: `${hex}15`,
        borderWidth: 1,
        borderColor: `${hex}60`,
      }}
    >
      <div
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: hex }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate">
          {player.name}
          {isCurrentPlayer && (
            <span className="text-xs text-slate-400 ml-2">(You)</span>
          )}
        </p>
        <p className="text-xs text-slate-400">
          {isHost ? "Host" : "Player"} &middot;{" "}
          <span style={{ color: hex }}>{colorInfo?.label || player.color}</span>
        </p>
      </div>
    </div>
  );
}
