'use client';

import { useRoom, useBoardState, useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function GameOver() {
  const room = useRoom();
  const boardState = useBoardState();
  const reset = useGameStore((s) => s.reset);

  if (!room || !boardState) return null;

  const scores = boardState.scores;
  const host = room.host;
  const guest = room.guest;

  const hostScore = scores[host.id] || 0;
  const guestScore = guest ? scores[guest.id] || 0 : 0;

  const winner =
    hostScore > guestScore
      ? host
      : guestScore > hostScore
      ? guest
      : null;

  const handlePlayAgain = () => {
    reset();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <div className="p-8 text-center">
          {winner ? (
            <>
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 mb-4">
                {winner.name} Wins!
              </h1>
              <p className="text-slate-300 mb-8">
                Congratulations on your explosive victory!
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-bold text-white mb-4">
                It's a Draw!
              </h1>
              <p className="text-slate-300 mb-8">
                Both players are equally explosive!
              </p>
            </>
          )}

          {/* Final Scores */}
          <div className="bg-slate-700 rounded-lg p-6 mb-8 space-y-3">
            <ScoreRow
              name={host.name}
              score={hostScore}
              color="blue"
              isWinner={winner?.id === host.id}
            />
            {guest && (
              <ScoreRow
                name={guest.name}
                score={guestScore}
                color="red"
                isWinner={winner?.id === guest.id}
              />
            )}
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
  color,
  isWinner,
}: {
  name: string;
  score: number;
  color: 'blue' | 'red';
  isWinner: boolean;
}) {
  const bgColor = color === 'blue' ? 'bg-blue-900/30' : 'bg-red-900/30';
  const borderColor = color === 'blue' ? 'border-blue-600' : 'border-red-600';

  return (
    <div
      className={`${bgColor} border ${borderColor} rounded-lg p-4 flex items-center justify-between ${
        isWinner ? 'ring-2 ring-yellow-400' : ''
      }`}
    >
      <span className={`font-semibold ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
        {name}
      </span>
      <span className="text-2xl font-bold text-white">{score}</span>
    </div>
  );
}
