"use client";

import { useRoom, useBoardState } from "@/lib/store";
import { AVAILABLE_COLORS } from "@/lib/types";

interface GameHUDProps {
  playerId: string;
}

export function GameHUD({ playerId }: GameHUDProps) {
  const room = useRoom();
  const boardState = useBoardState();

  const players = room?.players || [];
  const currentTurnPlayer = players.find((p) => p.id === boardState?.turn);
  const scores = boardState?.scores || {};

  if (!room) return null;

  return (
    <div className="bg-black/90 border-b border-gray-800 px-4 py-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Players with scores */}
        <div className="flex items-center gap-3 flex-wrap">
          {players.map((player) => {
            const colorInfo = AVAILABLE_COLORS.find(
              (c) => c.value === player.color,
            );
            const hex = colorInfo?.hex || "#9CA3AF";
            const isActive = boardState?.turn === player.id;
            const isMe = player.id === playerId;
            return (
              <div
                key={player.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${
                  isActive ? "ring-1 ring-white/50" : ""
                }`}
                style={{
                  backgroundColor: isActive ? `${hex}30` : "transparent",
                }}
              >
                <div
                  className={`w-3 h-3 rounded-full ${isActive ? "animate-pulse" : ""}`}
                  style={{ backgroundColor: hex }}
                />
                <span className="text-white text-sm font-medium">
                  {player.name}
                  {isMe && (
                    <span className="text-gray-400 text-xs ml-1">(You)</span>
                  )}
                </span>
                <span className="text-sm font-bold" style={{ color: hex }}>
                  {scores[player.id] || 0}
                </span>
              </div>
            );
          })}
        </div>

        {/* Turn indicator */}
        <div className="text-sm text-gray-300">
          <span
            className="font-medium"
            style={{
              color:
                AVAILABLE_COLORS.find(
                  (c) => c.value === currentTurnPlayer?.color,
                )?.hex || "#fff",
            }}
          >
            {currentTurnPlayer?.id === playerId
              ? "Your Turn"
              : `${currentTurnPlayer?.name || "..."}'s Turn`}
          </span>
        </div>
      </div>
    </div>
  );
}
