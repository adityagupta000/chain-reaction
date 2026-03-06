"use client";

import { useRoom, useBoardState, useGameStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AVAILABLE_COLORS } from "@/lib/types";

export function GameOver() {
  const room = useRoom();
  const boardState = useBoardState();
  const reset = useGameStore((s) => s.reset);

  if (!room || !boardState) return null;

  const scores = boardState.scores;
  const players = room.players || [];

  // Sort players by score descending
  const ranked = [...players].sort(
    (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0),
  );

  const topScore = scores[ranked[0]?.id] || 0;
  const winners = ranked.filter((p) => (scores[p.id] || 0) === topScore);
  const isDraw = winners.length > 1;

  const handlePlayAgain = () => {
    reset();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-900 border-gray-800">
        <div className="p-8 text-center">
          {isDraw ? (
            <>
              <h1 className="text-4xl font-bold text-white mb-4">
                It's a Draw!
              </h1>
              <p className="text-slate-300 mb-8">
                Multiple players tied for the top!
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 mb-4">
                {ranked[0]?.name} Wins!
              </h1>
              <p className="text-slate-300 mb-8">
                Congratulations on your explosive victory!
              </p>
            </>
          )}

          {/* Final Scores */}
          <div className="bg-slate-700 rounded-lg p-6 mb-8 space-y-3">
            {ranked.map((player, idx) => {
              const colorInfo = AVAILABLE_COLORS.find(
                (c) => c.value === player.color,
              );
              return (
                <ScoreRow
                  key={player.id}
                  name={player.name}
                  score={scores[player.id] || 0}
                  hex={colorInfo?.hex || "#9CA3AF"}
                  isWinner={idx === 0 && !isDraw}
                  rank={idx + 1}
                />
              );
            })}
          </div>

          <Button
            onClick={handlePlayAgain}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            Play Again
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ScoreRow({
  name,
  score,
  hex,
  isWinner,
  rank,
}: {
  name: string;
  score: number;
  hex: string;
  isWinner: boolean;
  rank: number;
}) {
  return (
    <div
      className={`rounded-lg p-4 flex items-center justify-between ${
        isWinner ? "ring-2 ring-yellow-400" : ""
      }`}
      style={{
        backgroundColor: `${hex}20`,
        borderWidth: 1,
        borderColor: `${hex}60`,
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-slate-400 text-sm w-5">#{rank}</span>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: hex }}
        />
        <span
          className={`font-semibold ${isWinner ? "text-yellow-400" : "text-white"}`}
        >
          {name}
        </span>
      </div>
      <span className="text-2xl font-bold text-white">{score}</span>
    </div>
  );
}
