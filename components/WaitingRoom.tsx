"use client";

import { useRoom } from "@/lib/store";
import { useSocketEmit } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { AVAILABLE_COLORS, type PlayerColor } from "@/lib/types";
import { AnimatedBackground } from "./AnimatedBackground";

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
    <div className="min-h-screen motion-bg flex items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_50%)] pointer-events-none"></div>
      <Card className="w-full max-w-md bg-white border-2 border-blue-400 shadow-2xl shadow-blue-200 relative z-10">
        <div className="p-8">
          <h2 className="text-3xl font-black text-blue-600 mb-2">
            {room.name.toUpperCase()}
          </h2>
          <p className="text-gray-700 text-sm mb-6 font-semibold">
            {players.length} / {room.maxPlayers} PLAYERS • {room.gridRows || 9}×
            {room.gridCols || 6}
          </p>

          <div className="space-y-4 mb-6">
            {/* Room ID Section */}
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2 font-bold">
                ROOM ID (SHARE)
              </p>
              <div className="flex items-center justify-between">
                <code className="font-mono text-gray-900 text-sm break-all">
                  {room.id}
                </code>
                <button
                  onClick={handleCopyRoomId}
                  className="p-2 hover:bg-blue-200 rounded ml-2 shrink-0 transition"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-blue-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Players Section */}
            <div className="space-y-3">
              <p className="text-sm text-gray-700 font-bold">PLAYERS</p>
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
                    className="bg-blue-50 border border-dashed border-blue-300 rounded-lg p-4 text-center text-blue-400 text-sm font-semibold"
                  >
                    WAITING...
                  </div>
                ),
              )}
            </div>

            {/* Color changer for current player */}
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2 font-bold">
                SELECT COLOR
              </p>
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
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                        isMyColor
                          ? "ring-2 ring-blue-500 scale-105 shadow-lg"
                          : taken
                            ? "opacity-20 cursor-not-allowed"
                            : "hover:scale-105 shadow-md"
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
              className={`w-full mb-4 font-bold shadow-lg transition-all ${
                readyToStart
                  ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-green-400 hover:shadow-green-500"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {readyToStart
                ? `⚡ START GAME (${players.length} PLAYERS)`
                : "Waiting for Players..."}
            </Button>
          )}

          {!isHost && (
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 text-center text-blue-700 mb-4 font-semibold">
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
        <p className="font-semibold text-gray-900 truncate">
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
