"use client";

import { useRoom, useBoardState, useGameStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AVAILABLE_COLORS } from "@/lib/types";
import { AnimatedBackground } from "./AnimatedBackground";
import { Confetti } from "./Confetti";

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
    <div className="min-h-screen motion-bg flex items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />
      <Confetti />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_50%)] pointer-events-none"></div>
      <Card className="w-full max-w-md bg-white border-2 border-blue-400 shadow-2xl shadow-blue-200 relative z-10">
        <div className="p-8 text-center">
          {isDraw ? (
            <>
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-yellow-500 to-yellow-600 mb-4">
                IT'S A DRAW!
              </h1>
              <p className="text-gray-700 mb-8 font-semibold">
                Multiple players tied for glory!
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-yellow-500 to-orange-500 mb-4">
                🏆 {ranked[0]?.name.toUpperCase()} WINS! 🏆
              </h1>
              <p className="text-gray-700 mb-8 font-semibold">
                EXPLOSIVE VICTORY!
              </p>
            </>
          )}

          {/* Final Scores */}
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-6 mb-8 space-y-3">
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
            className="w-full bg-linear-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold shadow-lg shadow-blue-400 hover:shadow-blue-500 transition-all"
          >
            PLAY AGAIN
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
        <span className="text-slate-500 text-sm w-5">#{rank}</span>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: hex }}
        />
        <span
          className={`font-semibold ${isWinner ? "text-yellow-600" : "text-gray-900"}`}
        >
          {name}
        </span>
      </div>
      <span className="text-2xl font-bold text-gray-900">{score}</span>
    </div>
  );
}
