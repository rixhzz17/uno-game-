import { io, Socket } from 'socket.io-client';
import {
  ChatMessage,
  ClientToServerEvents,
  GameStatePublic,
  PrivatePlayerState,
  ServerToClientEvents,
} from '../types/game.js';
import { soundManager } from '../utils/audio.js';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:3001'
    : '');

export class UnoSocketClient {
  public socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private gameStateListeners: ((state: GameStatePublic) => void)[] = [];
  private privateStateListeners: ((state: PrivatePlayerState) => void)[] = [];
  private chatListeners: ((msg: ChatMessage) => void)[] = [];
  private chatHistoryListeners: ((history: ChatMessage[]) => void)[] = [];
  private errorListeners: ((err: string) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];

  constructor() {
    this.socket = io(BACKEND_URL || undefined, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      this.connectionListeners.forEach((l) => l(true));
      this.tryAutoReconnect();
    });

    this.socket.on('disconnect', () => {
      this.connectionListeners.forEach((l) => l(false));
    });

    this.socket.on('game_state_update', (state) => {
      this.gameStateListeners.forEach((l) => l(state));
    });

    this.socket.on('private_state_update', (state) => {
      this.privateStateListeners.forEach((l) => l(state));
    });

    this.socket.on('chat_message', (msg) => {
      this.chatListeners.forEach((l) => l(msg));
    });

    this.socket.on('chat_history', (history) => {
      this.chatHistoryListeners.forEach((l) => l(history));
    });

    this.socket.on('sound_effect', (sound) => {
      soundManager.playSound(sound);
    });

    this.socket.on('error_message', (err) => {
      this.errorListeners.forEach((l) => l(err));
    });
  }

  public tryAutoReconnect(): void {
    const sessionToken = sessionStorage.getItem('uno_session_token');
    const roomCode = sessionStorage.getItem('uno_room_code');
    if (sessionToken && roomCode) {
      this.socket.emit('reconnect_session', { sessionToken, roomCode }, (res) => {
        if (!res.success) {
          // Stale session cleared
          sessionStorage.removeItem('uno_session_token');
          sessionStorage.removeItem('uno_room_code');
        }
      });
    }
  }

  public saveSession(sessionToken: string, roomCode: string): void {
    sessionStorage.setItem('uno_session_token', sessionToken);
    sessionStorage.setItem('uno_room_code', roomCode);
  }

  public clearSession(): void {
    sessionStorage.removeItem('uno_session_token');
    sessionStorage.removeItem('uno_room_code');
  }

  public onGameState(callback: (state: GameStatePublic) => void): () => void {
    this.gameStateListeners.push(callback);
    return () => {
      this.gameStateListeners = this.gameStateListeners.filter((l) => l !== callback);
    };
  }

  public onPrivateState(callback: (state: PrivatePlayerState) => void): () => void {
    this.privateStateListeners.push(callback);
    return () => {
      this.privateStateListeners = this.privateStateListeners.filter((l) => l !== callback);
    };
  }

  public onChatMessage(callback: (msg: ChatMessage) => void): () => void {
    this.chatListeners.push(callback);
    return () => {
      this.chatListeners = this.chatListeners.filter((l) => l !== callback);
    };
  }

  public onChatHistory(callback: (history: ChatMessage[]) => void): () => void {
    this.chatHistoryListeners.push(callback);
    return () => {
      this.chatHistoryListeners = this.chatHistoryListeners.filter((l) => l !== callback);
    };
  }

  public onError(callback: (err: string) => void): () => void {
    this.errorListeners.push(callback);
    return () => {
      this.errorListeners = this.errorListeners.filter((l) => l !== callback);
    };
  }

  public onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionListeners.push(callback);
    return () => {
      this.connectionListeners = this.connectionListeners.filter((l) => l !== callback);
    };
  }
}

export const socketClient = new UnoSocketClient();
