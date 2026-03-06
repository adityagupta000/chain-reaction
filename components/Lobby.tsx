"use client";

import { useState } from "react";
import { useSocketEmit } from "@/hooks/useSocket";
import { useSocket } from "@/hooks/useSocket";
import { useGameError } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { AVAILABLE_COLORS, type PlayerColor } from "@/lib/types";

export function Lobby() {
  const [playerName, setPlayerName] = useState("");
  const [roomNameInput, setRoomNameInput] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [isLoading, setIsLoading] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [selectedColor, setSelectedColor] = useState<PlayerColor>("blue");
  const [gridRows, setGridRows] = useState(9);
  const [gridCols, setGridCols] = useState(6);
  const error = useGameError();
  const { joinAsPlayer, createRoom, joinRoom } = useSocketEmit();

  // Initialize socket
  useSocket();

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !roomNameInput.trim()) return;

    try {
      setIsLoading(true);
      await joinAsPlayer(playerName);
      createRoom(roomNameInput, maxPlayers, selectedColor, gridRows, gridCols);
    } catch (error) {
      console.error("[Lobby] Error creating room:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !roomIdInput.trim()) return;

    try {
      setIsLoading(true);
      await joinAsPlayer(playerName);
      joinRoom(roomIdInput, playerName, selectedColor);
    } catch (error) {
      console.error("[Lobby] Error joining room:", error);
    } finally {
      setIsLoading(false);
    }
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

          {error && (
            <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {mode === "menu" && (
            <div className="space-y-4">
              <Input
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
              />

              <Button
                onClick={() => setMode("create")}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Create Room
              </Button>

              <Button
                onClick={() => setMode("join")}
                variant="outline"
                className="w-full border-slate-600 text-white hover:bg-slate-700"
              >
                Join Room
              </Button>
            </div>
          )}

          {mode === "create" && (
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <Input
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                disabled={isLoading}
              />

              <Input
                placeholder="Room name"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                disabled={isLoading}
              />

              {/* Player Count Selector */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">
                  Number of Players
                </label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setMaxPlayers(count)}
                      disabled={isLoading}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                        maxPlayers === count
                          ? "bg-blue-600 text-white ring-2 ring-blue-400"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      {count}P
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Size Selector */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">
                  Grid Size
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "6×6", r: 6, c: 6 },
                    { label: "8×5", r: 8, c: 5 },
                    { label: "9×6", r: 9, c: 6 },
                    { label: "10×8", r: 10, c: 8 },
                    { label: "12×8", r: 12, c: 8 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setGridRows(preset.r);
                        setGridCols(preset.c);
                      }}
                      disabled={isLoading}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                        gridRows === preset.r && gridCols === preset.c
                          ? "bg-blue-600 text-white ring-2 ring-blue-400"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              <ColorPicker
                selected={selectedColor}
                onChange={setSelectedColor}
                disabled={isLoading}
              />

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? "Connecting..." : "Create & Wait"}
              </Button>

              <Button
                type="button"
                onClick={() => setMode("menu")}
                variant="ghost"
                className="w-full text-slate-400"
                disabled={isLoading}
              >
                Back
              </Button>
            </form>
          )}

          {mode === "join" && (
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <Input
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                disabled={isLoading}
              />

              <Input
                placeholder="Room ID"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                disabled={isLoading}
              />

              {/* Color Picker */}
              <ColorPicker
                selected={selectedColor}
                onChange={setSelectedColor}
                disabled={isLoading}
              />

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                {isLoading ? "Connecting..." : "Join Room"}
              </Button>

              <Button
                type="button"
                onClick={() => setMode("menu")}
                variant="ghost"
                className="w-full text-slate-400"
                disabled={isLoading}
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

function ColorPicker({
  selected,
  onChange,
  disabled,
  takenColors = [],
}: {
  selected: PlayerColor;
  onChange: (color: PlayerColor) => void;
  disabled?: boolean;
  takenColors?: PlayerColor[];
}) {
  return (
    <div>
      <label className="text-sm text-slate-400 mb-2 block">
        Choose Your Color
      </label>
      <div className="flex gap-2">
        {AVAILABLE_COLORS.map(({ value, label, hex }) => {
          const taken = takenColors.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => !taken && onChange(value)}
              disabled={disabled || taken}
              title={taken ? `${label} is taken` : label}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all relative ${
                selected === value
                  ? "ring-2 ring-white text-white scale-105"
                  : taken
                    ? "opacity-30 cursor-not-allowed text-white"
                    : "text-white hover:scale-105"
              }`}
              style={{ backgroundColor: hex }}
            >
              {label}
              {taken && (
                <span className="absolute inset-0 flex items-center justify-center text-lg">
                  &#10005;
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
