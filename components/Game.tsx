"use client";

import { useEffect, useState } from "react";
import {
  useGameStore,
  useGamePhase,
  useBoardState,
  useRoom,
} from "@/lib/store";
import { useSocket, useSocketEmit } from "@/hooks/useSocket";
import { Lobby } from "./Lobby";
import { WaitingRoom } from "./WaitingRoom";
import { GameCanvas } from "./GameCanvas";
import { GameHUD } from "./GameHUD";
import { GameOver } from "./GameOver";
import type { PlayerColor } from "@/lib/types";

export function Game() {
  const phase = useGamePhase();
  const boardState = useBoardState();
  const room = useRoom();
  const setPhase = useGameStore((s) => s.setPhase);
  const setError = useGameStore((s) => s.setError);
  const [playerId, setPlayerId] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  // Initialize socket
  useSocket();

  // Get playerId from server-assigned value stored by player:joined handler
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncPlayerId = () => {
      const id = localStorage.getItem("playerId");
      if (id) {
        setPlayerId(id);
        setMounted(true);
      }
    };

    // Check immediately
    syncPlayerId();

    // Poll for changes (covers case where socket assigns ID after mount)
    const interval = setInterval(syncPlayerId, 300);

    // Also listen for storage events from other tabs
    window.addEventListener("storage", syncPlayerId);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", syncPlayerId);
    };
  }, []);

  // Wait for hydration — show lobby even without playerId (it will be set during create/join)
  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Determine current player's color and turn
  const currentPlayer = room?.players?.find((p: any) => p.id === playerId);
  const playerColor: PlayerColor = currentPlayer?.color || "blue";
  const isMyTurn = boardState?.turn === playerId;

  // Render based on phase
  if (phase === "lobby") {
    return <Lobby />;
  }

  if (phase === "waiting") {
    return <WaitingRoom />;
  }

  if (phase === "playing" && room && boardState) {
    return (
      <div className="h-screen bg-black flex flex-col overflow-hidden">
        <GameHUD playerId={playerId} />
        <div className="flex-1 min-h-0">
          <GameCanvas
            roomId={room.id}
            playerId={playerId}
            playerColor={playerColor}
            isMyTurn={isMyTurn}
          />
        </div>
      </div>
    );
  }

  if (phase === "gameover") {
    return <GameOver />;
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>
  );
}
