'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store';
import type { GameMove, GameRoom, BoardState } from '@/lib/types';

let globalSocket: any = null;
let connectionAttempts = 0;

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
        const { io } = await import('socket.io-client');
        
        const socket = io(
          process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001',
          {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 3,
            transports: ['websocket', 'polling'],
          }
        );

        globalSocket = socket;
        socketRef.current = socket;

        // ========================================================================
        // SOCKET.IO EVENT LISTENERS
        // ========================================================================

        socket.on('connect', () => {
          console.log('[Socket] Connected:', socket.id);
          connectionAttempts = 0;
        });

        socket.on('connect_error', (error: any) => {
          connectionAttempts++;
          console.warn('[Socket] Connection error:', error);
          if (connectionAttempts <= 1) {
            useGameStore.getState().setError(null);
          } else {
            useGameStore.getState().setError('Connection failed - running in offline mode');
          }
        });

        socket.on('error', (data: { message: string }) => {
          console.error('[Socket] Error:', data.message);
          useGameStore.getState().setError(data.message);
        });

        socket.on('room:created', (data: { room: GameRoom }) => {
          console.log('[Socket] Room created:', data.room.id);
          useGameStore.getState().setRoom(data.room);
          useGameStore.getState().setPhase('waiting');
        });

        socket.on('room:updated', (data: { room: GameRoom }) => {
          console.log('[Socket] Room updated');
          useGameStore.getState().setRoom(data.room);
        });

        socket.on('game:started', (data: { boardState: BoardState }) => {
          console.log('[Socket] Game started');
          useGameStore.getState().setBoardState(data.boardState);
          useGameStore.getState().setPhase('playing');
          useGameStore.getState().setError(null);
        });

        socket.on(
          'game:moveReceived',
          (data: { move: GameMove; boardState: BoardState; scores: Record<string, number> }) => {
            console.log('[Socket] Move received:', data.move);
            useGameStore.getState().setBoardState(data.boardState);
            useGameStore.getState().addToHistory(data.move);
            useGameStore.getState().clearSelection();
            useGameStore.getState().setSubmittingMove(false);
          }
        );

        socket.on('game:invalid-move', (data: { reason: string }) => {
          console.error('[Socket] Invalid move:', data.reason);
          useGameStore.getState().setError(data.reason);
          useGameStore.getState().setSubmittingMove(false);
          useGameStore.getState().clearSelection();
        });

        socket.on('game:finished', (data: { outcome: string; winner?: any }) => {
          console.log('[Socket] Game finished:', data.outcome);
          useGameStore.getState().setPhase('gameover');
        });

        socket.on('disconnect', () => {
          console.log('[Socket] Disconnected');
          globalSocket = null;
        });

        return () => {
          // Keep socket alive on unmount
        };
      } catch (error) {
        console.warn('[Socket] Failed to initialize Socket.io:', error);
        // Fallback to mock socket for development
        _initMockSocket();
      }
    };

    async function _initMockSocket() {
      try {
        const { MockSocket } = await import('@/lib/mockSocket');
        const mockSocket = new MockSocket();
        
        globalSocket = mockSocket;
        socketRef.current = mockSocket;
        
        console.log('[Socket] Using mock socket for offline development');
        useGameStore.getState().setError(null);
        
        return () => {};
      } catch (err) {
        console.error('[Socket] Failed to initialize mock socket:', err);
        useGameStore.getState().setError('Connection unavailable');
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
    joinAsPlayer: (playerName: string) => {
      if (globalSocket) {
        if (typeof globalSocket.emit === 'function') {
          // Real Socket.io
          globalSocket.emit('player:join', { playerName });
        } else if (typeof globalSocket.create_room === 'function') {
          // Mock socket - store player info
          if (typeof window !== 'undefined') {
            localStorage.setItem('playerName', playerName);
          }
        }
      }
    },

    createRoom: (roomName: string) => {
      if (globalSocket) {
        if (typeof globalSocket.create_room === 'function') {
          // Mock socket
          const playerId = typeof window !== 'undefined' 
            ? localStorage.getItem('playerId') || ''
            : '';
          const playerName = typeof window !== 'undefined'
            ? localStorage.getItem('playerName') || 'Player'
            : 'Player';
          globalSocket.create_room({ roomName }, playerId, playerName);
        } else {
          // Real Socket.io
          globalSocket.emit('room:create', { roomName });
        }
      }
    },

    joinRoom: (roomId: string, playerName: string) => {
      if (globalSocket) {
        if (typeof globalSocket.join_room === 'function') {
          // Mock socket
          const playerId = typeof window !== 'undefined'
            ? localStorage.getItem('playerId') || ''
            : '';
          globalSocket.join_room({ roomId }, playerId, playerName);
        } else {
          // Real Socket.io
          globalSocket.emit('room:join', { roomId, playerName });
        }
      }
    },

    startGame: (roomId: string) => {
      if (globalSocket) {
        if (typeof globalSocket.start_game === 'function') {
          // Mock socket
          globalSocket.start_game();
        } else {
          // Real Socket.io
          globalSocket.emit('game:start', { roomId });
        }
      }
    },

    submitMove: (roomId: string, move: GameMove) => {
      if (globalSocket) {
        if (typeof globalSocket.submit_move === 'function') {
          // Mock socket
          globalSocket.submit_move(move);
        } else {
          // Real Socket.io
          globalSocket.emit('game:move', { roomId, move });
        }
      }
    },

    sendChat: (roomId: string, message: string) => {
      if (globalSocket) {
        if (typeof globalSocket.emit === 'function') {
          // Real Socket.io
          globalSocket.emit('chat:send', { roomId, message });
        }
      }
    },

    disconnect: () => {
      if (globalSocket) {
        globalSocket.disconnect();
      }
      globalSocket = null;
    },
  };
}
