"use client";

import { useState } from "react";
import { useSocketEmit } from "@/hooks/useSocket";
import { useSocket } from "@/hooks/useSocket";
import { useGameError } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { AnimatedBackground } from "./AnimatedBackground";
import { AVAILABLE_COLORS, type PlayerColor } from "@/lib/types";

export function Lobby() {
  const [playerName, setPlayerName] = useState("");
  const [roomNameInput, setRoomNameInput] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [isLoading, setIsLoading] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [selectedColor, setSelectedColor] = useState<PlayerColor | null>(null);
  const [gridRows, setGridRows] = useState(9);
  const [gridCols, setGridCols] = useState(6);
  const error = useGameError();
  const { joinAsPlayer, createRoom, joinRoom } = useSocketEmit();

  // Initialize socket
  useSocket();

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !roomNameInput.trim() || !selectedColor) return;

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
    if (!playerName.trim() || !roomIdInput.trim() || !selectedColor) return;

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
    <div className="min-h-screen motion-bg flex items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_50%)] pointer-events-none"></div>
      <Card className="w-full max-w-md bg-white border-2 border-blue-400 shadow-2xl shadow-blue-200 relative z-10">
        <div className="p-8">
          <h1 className="text-5xl font-black text-center mb-2 bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-lg">
            CHAIN REACTION
          </h1>
          <p className="text-center text-gray-700 mb-8 font-bold tracking-wide">
            TAP TO EXPAND • CREATE EXPLOSIONS • DOMINATE
          </p>

          {error && (
            <div className="bg-red-100 border border-red-400 rounded-lg p-4 mb-6 flex items-start gap-3 shadow-lg shadow-red-200">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-red-700 text-sm font-semibold">{error}</p>
            </div>
          )}

          {mode === "menu" && (
            <div className="space-y-4">
              <Input
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-blue-50 border-blue-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:shadow-lg focus:shadow-blue-200"
              />

              <Button
                onClick={() => setMode("create")}
                className="w-full bg-linear-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold shadow-lg shadow-blue-400 hover:shadow-blue-500 transition-all"
              >
                CREATE ROOM
              </Button>

              <Button
                onClick={() => setMode("join")}
                className="w-full bg-linear-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold shadow-lg shadow-purple-400 hover:shadow-purple-500 transition-all"
              >
                JOIN ROOM
              </Button>
            </div>
          )}

          {mode === "create" && (
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <Input
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-blue-50 border-blue-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:shadow-lg focus:shadow-blue-200"
                disabled={isLoading}
              />

              <Input
                placeholder="Room name"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                className="bg-blue-50 border-blue-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:shadow-lg focus:shadow-blue-200"
                disabled={isLoading}
              />

              {/* Player Count Selector */}
              <div>
                <label className="text-sm text-gray-700 mb-2 block font-bold">
                  PLAYERS
                </label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setMaxPlayers(count)}
                      disabled={isLoading}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                        maxPlayers === count
                          ? "bg-linear-to-r from-blue-500 to-blue-600 text-white ring-2 ring-blue-300 shadow-lg shadow-blue-400"
                          : "bg-blue-50 text-gray-700 border border-blue-300 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-200"
                      }`}
                    >
                      {count}P
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Size Selector */}
              <div>
                <label className="text-sm text-gray-700 mb-2 block font-bold">
                  GRID
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
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                        gridRows === preset.r && gridCols === preset.c
                          ? "bg-linear-to-r from-blue-500 to-blue-600 text-white ring-2 ring-blue-300 shadow-lg shadow-blue-400"
                          : "bg-blue-50 text-gray-700 border border-blue-300 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-200"
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
                className="w-full bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold shadow-lg shadow-green-400 hover:shadow-green-500 transition-all disabled:opacity-50"
              >
                {isLoading ? "CONNECTING..." : "START GAME"}
              </Button>

              <Button
                type="button"
                onClick={() => setMode("menu")}
                className="w-full bg-gray-100 text-gray-700 border border-gray-300 hover:border-gray-500 hover:shadow-lg hover:shadow-gray-300 font-bold"
                disabled={isLoading}
              >
                BACK
              </Button>
            </form>
          )}

          {mode === "join" && (
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <Input
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-blue-50 border-blue-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:shadow-lg focus:shadow-blue-200"
                disabled={isLoading}
              />

              <Input
                placeholder="Room ID"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                className="bg-blue-50 border-blue-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:shadow-lg focus:shadow-blue-200"
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
                className="w-full bg-linear-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold shadow-lg shadow-purple-400 hover:shadow-purple-500 transition-all disabled:opacity-50"
              >
                {isLoading ? "CONNECTING..." : "JOIN ROOM"}
              </Button>

              <Button
                type="button"
                onClick={() => setMode("menu")}
                className="w-full bg-gray-100 text-gray-700 border border-gray-300 hover:border-gray-500 hover:shadow-lg hover:shadow-gray-300 font-bold"
                disabled={isLoading}
              >
                BACK
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
  selected: PlayerColor | null;
  onChange: (color: PlayerColor) => void;
  disabled?: boolean;
  takenColors?: PlayerColor[];
}) {
  return (
    <div>
      <label className="text-sm text-gray-700 mb-2 block font-bold">
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
