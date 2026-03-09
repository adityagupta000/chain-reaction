"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/lib/store";
import type { GameMove, GameRoom, BoardState, PlayerColor } from "@/lib/types";

let globalSocket: any = null;
let connectionAttempts = 0;
let playerJoinedPromise: ((value: void) => void) | null = null;
let playerJoinedTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function useSocket() {
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (globalSocket) {
      socketRef.current = globalSocket;
      return;
    }

    // Try to dynamically import Socket.io only when available
    const initSocket = async () => {
      try {
        const { io } = await import("socket.io-client");

        const socket = io(
          process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001",
          {
            reconnection: true,
            reconnectionDelay: 500,
            reconnectionDelayMax: 3000,
            reconnectionAttempts: 5,
            transports: ["websocket"],
            upgrade: false,
          },
        );

        globalSocket = socket;
        socketRef.current = socket;

        // ========================================================================
        // SOCKET.IO EVENT LISTENERS
        // ========================================================================

        socket.on("connect", () => {
          console.log("[Socket] Connected:", socket.id);
          connectionAttempts = 0;
        });

        socket.on(
          "player:joined",
          (data: { playerId: string; playerName: string }) => {
            console.log(
              "[Socket] Player joined confirmed, playerId:",
              data.playerId,
            );
            // Store the playerId from server
            if (typeof window !== "undefined") {
              localStorage.setItem("playerId", data.playerId);
            }
            if (playerJoinedPromise) {
              if (playerJoinedTimeoutId) {
                clearTimeout(playerJoinedTimeoutId);
                playerJoinedTimeoutId = null;
              }
              playerJoinedPromise();
              playerJoinedPromise = null;
            }
          },
        );

        socket.on("connect_error", (error: any) => {
          connectionAttempts++;
          console.warn("[Socket] Connection error:", error);
          if (connectionAttempts <= 1) {
            useGameStore.getState().setError(null);
          } else {
            useGameStore
              .getState()
              .setError("Connection failed - running in offline mode");
          }
        });

        socket.on("error", (data: { message: string }) => {
          console.error("[Socket] Error from server:", data.message);
          useGameStore.getState().setError(data.message);
        });

        socket.on("room:created", (data: { room: GameRoom }) => {
          console.log("[Socket] Room created:", data.room.id);
          useGameStore.getState().setRoom(data.room);
          useGameStore.getState().setPhase("waiting");
        });

        socket.on("room:updated", (data: { room: GameRoom }) => {
          console.log("[Socket] Room updated:", {
            roomId: data.room.id,
            host: data.room.host.name,
            players: data.room.players?.map(
              (p: any) => `${p.name}(${p.color})`,
            ),
            status: data.room.status,
          });

          // Update room in store
          useGameStore.getState().setRoom(data.room);

          // If we're in lobby and there are 2+ players, transition to waiting
          const currentPhase = useGameStore.getState().phase;
          if (
            currentPhase === "lobby" &&
            data.room.players &&
            data.room.players.length >= 2
          ) {
            console.log(
              "[Socket] Multiple players present - transitioning to waiting phase",
            );
            useGameStore.getState().setPhase("waiting");
          }
        });

        socket.on(
          "color:unavailable",
          (data: { message: string; takenColors: PlayerColor[] }) => {
            console.log("[Socket] Color unavailable:", data.message);
            useGameStore.getState().setError(data.message);
          },
        );

        socket.on("game:started", (data: { boardState: BoardState }) => {
          console.log("[Socket] Game started");
          useGameStore.getState().setBoardState(data.boardState);
          useGameStore.getState().setPhase("playing");
          useGameStore.getState().setError(null);
        });

        socket.on(
          "game:moveResult",
          (data: {
            boardState: BoardState;
            move: { row: number; col: number; playerIndex: number };
            scores: Record<string, number>;
            explosionSequence: any[];
            eliminatedPlayers: number[];
            winner: any | null;
          }) => {
            console.log(
              "[Socket] Move result received, chain length:",
              data.explosionSequence.length,
            );

            // Push to queue — the renderer will animate and apply each in order
            useGameStore.getState().pushPendingMoveResult({
              boardState: data.boardState,
              move: data.move,
              explosionSequence: data.explosionSequence,
              scores: data.scores,
              eliminatedPlayers: data.eliminatedPlayers,
              winner: data.winner,
            });
            useGameStore.getState().clearSelection();
            useGameStore.getState().setSubmittingMove(false);
          },
        );

        socket.on("game:invalid-move", (data: { reason: string }) => {
          useGameStore.getState().setError(data.reason);
          useGameStore.getState().setSubmittingMove(false);
          useGameStore.getState().clearSelection();
        });

        socket.on("disconnect", () => {
          console.log("[Socket] Disconnected");
          globalSocket = null;
        });

        return () => {
          // Keep socket alive on unmount
        };
      } catch (error) {
        console.warn("[Socket] Failed to initialize Socket.io:", error);
        // Fallback to mock socket for development
        _initMockSocket();
      }
    };

    async function _initMockSocket() {
      try {
        const { MockSocket } = await import("@/lib/mockSocket");
        const mockSocket = new MockSocket();

        globalSocket = mockSocket;
        socketRef.current = mockSocket;

        console.log("[Socket] Using mock socket for offline development");
        useGameStore.getState().setError(null);

        return () => {};
      } catch (err) {
        console.error("[Socket] Failed to initialize mock socket:", err);
        useGameStore.getState().setError("Connection unavailable");
      }
    }

    initSocket();
  }, []);

  return socketRef.current;
}

// ============================================================================
// EMIT HELPERS
// ============================================================================

export function useSocketEmit() {
  return {
    joinAsPlayer: (playerName: string): Promise<void> => {
      return new Promise((resolve) => {
        if (!globalSocket) {
          console.warn(
            "[Socket] joinAsPlayer: globalSocket not initialized, retrying...",
          );
          setTimeout(() => {
            // Recursive retry
            useSocketEmit().joinAsPlayer(playerName).then(resolve);
          }, 200);
          return;
        }

        // Wait for socket to be connected
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait (50 * 100ms)

        const checkConnection = () => {
          attempts++;
          console.log(
            `[Socket] Connection check ${attempts}/50, connected: ${globalSocket?.connected}`,
          );

          if (globalSocket?.connected) {
            // Real Socket.io - send event and wait for acknowledgment
            console.log(
              "[Socket] Socket connected! Emitting player:join for:",
              playerName,
            );
            playerJoinedPromise = resolve;
            globalSocket.emit("player:join", { playerName });

            // Fallback timeout in case acknowledgment doesn't arrive
            playerJoinedTimeoutId = setTimeout(() => {
              if (playerJoinedPromise === resolve) {
                console.warn(
                  "[Socket] Player join acknowledgment timeout after 1s, but proceeding",
                );
                playerJoinedPromise = null;
                playerJoinedTimeoutId = null;
                resolve();
              }
            }, 1000);
          } else if (attempts < maxAttempts) {
            console.log(
              `[Socket] Waiting for connection... (${attempts}/${maxAttempts})`,
            );
            setTimeout(checkConnection, 100);
          } else {
            console.error("[Socket] Connection timeout - proceeding anyway");
            resolve();
          }
        };

        checkConnection();
      });
    },

    createRoom: (
      roomName: string,
      maxPlayers: number = 2,
      color: PlayerColor = "blue",
      gridRows: number = 9,
      gridCols: number = 6,
    ) => {
      console.log(
        "[Socket] createRoom called with:",
        roomName,
        "maxPlayers:",
        maxPlayers,
        "color:",
        color,
        "grid:",
        gridRows,
        "x",
        gridCols,
      );
      if (!globalSocket) {
        console.error("[Socket] createRoom: globalSocket not initialized");
        return;
      }

      if (typeof globalSocket.emit === "function") {
        globalSocket.emit("room:create", {
          roomName,
          maxPlayers,
          color,
          gridRows,
          gridCols,
        });
      } else {
        console.warn("[Socket] Socket.emit not available");
      }
    },

    joinRoom: (
      roomId: string,
      playerName: string,
      color: PlayerColor = "red",
    ) => {
      console.log("[Socket] joinRoom called with:", {
        roomId,
        playerName,
        color,
      });
      if (!globalSocket) {
        console.error("[Socket] joinRoom: globalSocket not initialized");
        return;
      }

      console.log(
        "[Socket] Socket state - connected:",
        globalSocket.connected,
        "emit type:",
        typeof globalSocket.emit,
      );

      if (typeof globalSocket.emit === "function") {
        console.log("[Socket] Emitting room:join with:", {
          roomId,
          playerName,
          color,
        });
        globalSocket.emit("room:join", { roomId, playerName, color });
      } else {
        console.warn("[Socket] Socket.emit not available");
      }
    },

    startGame: (roomId: string) => {
      console.log("[Socket] startGame called with roomId:", roomId);
      if (globalSocket) {
        if (typeof globalSocket.start_game === "function") {
          // Mock socket
          console.log("[Socket] Using mock socket for start_game");
          globalSocket.start_game();
        } else {
          // Real Socket.io
          console.log("[Socket] Emitting game:start event");
          globalSocket.emit("game:start", { roomId });
        }
      } else {
        console.error("[Socket] globalSocket not initialized for startGame");
      }
    },

    submitMove: (roomId: string, move: GameMove) => {
      if (globalSocket) {
        if (typeof globalSocket.submit_move === "function") {
          // Mock socket
          globalSocket.submit_move(move);
        } else {
          // Real Socket.io
          globalSocket.emit("game:move", { roomId, move });
        }
      }
    },

    sendChat: (roomId: string, message: string) => {
      if (globalSocket) {
        if (typeof globalSocket.emit === "function") {
          // Real Socket.io
          globalSocket.emit("chat:send", { roomId, message });
        }
      }
    },

    disconnect: () => {
      if (globalSocket) {
        globalSocket.disconnect();
      }
      globalSocket = null;
    },

    changeColor: (roomId: string, color: PlayerColor) => {
      if (globalSocket && typeof globalSocket.emit === "function") {
        globalSocket.emit("color:change", { roomId, color });
      }
    },
  };
}
