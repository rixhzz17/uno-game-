import { randomBytes } from 'crypto';
import { Server, Socket } from 'socket.io';
import { GameEngine } from '../game/engine.js';
import {
  ChatMessage,
  ClientToServerEvents,
  GameSettings,
  ServerToClientEvents,
} from '../types/game.js';

export interface PlayerSession {
  playerId: string;
  roomId: string;
  username: string;
  avatarSeed: string;
  socketId: string | null;
  lastActive: number;
}

export interface Room {
  id: string;
  code: string;
  engine: GameEngine;
  chatHistory: ChatMessage[];
  playerSessions: Map<string, PlayerSession>; // playerId -> PlayerSession
  turnTimerInterval: NodeJS.Timeout | null;
  cleanupTimeout: NodeJS.Timeout | null;
  lastMessageTimes: Map<string, number[]>; // For chat rate limiting
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map(); // roomId -> Room
  private codeToRoomId: Map<string, string> = new Map(); // roomCode -> roomId
  private sessions: Map<string, PlayerSession> = new Map(); // sessionToken -> PlayerSession
  private socketToSessionToken: Map<string, string> = new Map(); // socket.id -> sessionToken

  constructor(private io: Server<ClientToServerEvents, ServerToClientEvents>) {}

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.codeToRoomId.has(code));
    return code;
  }

  public generateSessionToken(): string {
    return randomBytes(16).toString('hex');
  }

  public createRoom(
    username: string,
    existingSessionToken?: string,
    socketId?: string
  ): { room: Room; sessionToken: string; playerId: string } {
    const cleanUsername = username.trim().slice(0, 16);
    const roomId = randomBytes(8).toString('hex');
    const roomCode = this.generateRoomCode();
    const sessionToken = existingSessionToken || this.generateSessionToken();
    const playerId = randomBytes(8).toString('hex');

    const engine = new GameEngine(roomId, roomCode, playerId);
    engine.addPlayer(playerId, cleanUsername);

    const session: PlayerSession = {
      playerId,
      roomId,
      username: cleanUsername,
      avatarSeed: cleanUsername,
      socketId: socketId || null,
      lastActive: Date.now(),
    };

    const room: Room = {
      id: roomId,
      code: roomCode,
      engine,
      chatHistory: [],
      playerSessions: new Map([[playerId, session]]),
      turnTimerInterval: null,
      cleanupTimeout: null,
      lastMessageTimes: new Map(),
    };

    this.rooms.set(roomId, room);
    this.codeToRoomId.set(roomCode, roomId);
    this.sessions.set(sessionToken, session);
    if (socketId) {
      this.socketToSessionToken.set(socketId, sessionToken);
    }

    this.addSystemMessage(room, `🎉 Room created! Welcome, ${cleanUsername} (Host).`);
    return { room, sessionToken, playerId };
  }

  public joinRoom(
    roomCode: string,
    username: string,
    existingSessionToken?: string,
    socketId?: string
  ): { success: boolean; room?: Room; sessionToken?: string; playerId?: string; error?: string } {
    const cleanCode = roomCode.trim().toUpperCase();
    const roomId = this.codeToRoomId.get(cleanCode);
    if (!roomId) {
      return { success: false, error: 'Room not found. Check the code and try again.' };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room is no longer active.' };
    }

    if (room.engine.status !== 'lobby') {
      return { success: false, error: 'Game has already started in this room.' };
    }

    if (room.engine.players.length >= room.engine.settings.maxPlayers) {
      return { success: false, error: 'Room is full (10 players max).' };
    }

    const cleanUsername = username.trim().slice(0, 16);
    if (!cleanUsername) {
      return { success: false, error: 'Invalid username.' };
    }

    const sessionToken = existingSessionToken || this.generateSessionToken();
    const playerId = randomBytes(8).toString('hex');

    const added = room.engine.addPlayer(playerId, cleanUsername);
    if (!added) {
      return { success: false, error: 'Could not join room.' };
    }

    const session: PlayerSession = {
      playerId,
      roomId: room.id,
      username: cleanUsername,
      avatarSeed: cleanUsername,
      socketId: socketId || null,
      lastActive: Date.now(),
    };

    room.playerSessions.set(playerId, session);
    this.sessions.set(sessionToken, session);
    if (socketId) {
      this.socketToSessionToken.set(socketId, sessionToken);
    }

    this.addSystemMessage(room, `👋 ${cleanUsername} joined the room.`);
    this.broadcastState(room);

    return { success: true, room, sessionToken, playerId };
  }

  public reconnect(
    sessionToken: string,
    roomCode: string,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ): { success: boolean; room?: Room; playerId?: string; error?: string } {
    const session = this.sessions.get(sessionToken);
    if (!session) {
      return { success: false, error: 'Session expired or not found.' };
    }

    const room = this.rooms.get(session.roomId);
    if (!room || room.code !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'Room not found or code mismatch.' };
    }

    const player = room.engine.players.find((p) => p.id === session.playerId);
    if (!player) {
      return { success: false, error: 'Player seat is no longer in this room.' };
    }

    // Reattach socket
    session.socketId = socket.id;
    session.lastActive = Date.now();
    player.isConnected = true;
    this.socketToSessionToken.set(socket.id, sessionToken);

    socket.join(room.id);

    // Cancel room cleanup timeout if running
    if (room.cleanupTimeout) {
      clearTimeout(room.cleanupTimeout);
      room.cleanupTimeout = null;
    }

    this.addSystemMessage(room, `🔄 ${player.username} reconnected.`);
    this.syncPlayer(room, session.playerId, socket);
    this.broadcastState(room);

    return { success: true, room, playerId: session.playerId };
  }

  public handleDisconnect(socketId: string): void {
    const sessionToken = this.socketToSessionToken.get(socketId);
    if (!sessionToken) return;

    this.socketToSessionToken.delete(socketId);
    const session = this.sessions.get(sessionToken);
    if (!session) return;

    const room = this.rooms.get(session.roomId);
    if (!room) return;

    const player = room.engine.players.find((p) => p.id === session.playerId);
    if (!player) return;

    player.isConnected = false;
    session.socketId = null;

    this.addSystemMessage(room, `⚠️ ${player.username} disconnected.`);
    this.broadcastState(room);

    // If all players disconnected, schedule room cleanup in 5 minutes
    const allDisconnected = room.engine.players.every((p) => !p.isConnected);
    if (allDisconnected && !room.cleanupTimeout) {
      room.cleanupTimeout = setTimeout(() => {
        this.destroyRoom(room.id);
      }, 5 * 60 * 1000);
    }
  }

  public leaveRoom(socketId: string): void {
    const sessionToken = this.socketToSessionToken.get(socketId);
    if (!sessionToken) return;

    const session = this.sessions.get(sessionToken);
    if (!session) return;

    const room = this.rooms.get(session.roomId);
    if (!room) return;

    const username = session.username;
    room.engine.removePlayer(session.playerId);
    room.playerSessions.delete(session.playerId);
    this.sessions.delete(sessionToken);
    this.socketToSessionToken.delete(socketId);

    this.addSystemMessage(room, `🚪 ${username} left the room.`);

    if (room.engine.players.length === 0) {
      this.destroyRoom(room.id);
    } else {
      this.broadcastState(room);
    }
  }

  public toggleReady(socketId: string): void {
    const session = this.getSessionBySocketId(socketId);
    if (!session) return;

    const room = this.rooms.get(session.roomId);
    if (!room || room.engine.status !== 'lobby') return;

    const player = room.engine.players.find((p) => p.id === session.playerId);
    if (!player) return;

    player.isReady = !player.isReady;
    this.broadcastState(room);
  }

  public updateSettings(socketId: string, newSettings: Partial<GameSettings>): void {
    const session = this.getSessionBySocketId(socketId);
    if (!session) return;

    const room = this.rooms.get(session.roomId);
    if (!room || room.engine.status !== 'lobby') return;

    // Only host can change settings
    if (room.engine.hostId !== session.playerId) return;

    room.engine.settings = {
      ...room.engine.settings,
      ...newSettings,
      customCards: {
        ...room.engine.settings.customCards,
        ...(newSettings.customCards || {}),
      },
    };

    this.broadcastState(room);
  }

  public startGame(socketId: string): void {
    const session = this.getSessionBySocketId(socketId);
    if (!session) return;

    const room = this.rooms.get(session.roomId);
    if (!room || room.engine.status !== 'lobby') return;

    // Only host can start game
    if (room.engine.hostId !== session.playerId) return;

    const success = room.engine.startGame();
    if (!success) {
      this.io.to(socketId).emit('error_message', 'Need at least 2 players to start!');
      return;
    }

    this.startTurnTimer(room);
    this.broadcastState(room);
    this.io.to(room.id).emit('sound_effect', 'play');
  }

  public startNextRound(socketId: string): void {
    const session = this.getSessionBySocketId(socketId);
    if (!session) return;

    const room = this.rooms.get(session.roomId);
    if (!room || room.engine.status !== 'round_over') return;

    if (room.engine.hostId !== session.playerId) return;

    const success = room.engine.startNextRound();
    if (success) {
      this.startTurnTimer(room);
      this.broadcastState(room);
      this.io.to(room.id).emit('sound_effect', 'play');
    }
  }

  private startTurnTimer(room: Room): void {
    if (room.turnTimerInterval) {
      clearInterval(room.turnTimerInterval);
      room.turnTimerInterval = null;
    }

    if (room.engine.settings.turnTimerSec <= 0) return;

    room.turnTimerInterval = setInterval(() => {
      if (room.engine.status !== 'playing') {
        if (room.turnTimerInterval) clearInterval(room.turnTimerInterval);
        room.turnTimerInterval = null;
        return;
      }

      if (room.engine.turnDeadline && Date.now() >= room.engine.turnDeadline) {
        // Time expired! Auto-play or auto-draw for current player
        const current = room.engine.getCurrentPlayer();
        if (current) {
          this.addSystemMessage(room, `⏱️ ${current.username}'s turn timed out! Auto-drawing card.`);
          room.engine.drawCard(current.id);
          room.engine.passTurn(current.id);
          this.broadcastState(room);
        }
      }
    }, 1000);
  }

  public sendChat(socketId: string, text: string): void {
    const session = this.getSessionBySocketId(socketId);
    if (!session) return;

    const room = this.rooms.get(session.roomId);
    if (!room) return;

    const cleanText = text.trim().slice(0, 300);
    if (!cleanText) return;

    // Rate limiting: max 5 messages in 3 seconds
    const now = Date.now();
    const timestamps = room.lastMessageTimes.get(session.playerId) || [];
    const recent = timestamps.filter((t) => now - t < 3000);
    if (recent.length >= 5) {
      this.io.to(socketId).emit('error_message', 'You are chatting too fast. Please slow down.');
      return;
    }
    recent.push(now);
    room.lastMessageTimes.set(session.playerId, recent);

    const message: ChatMessage = {
      id: randomBytes(6).toString('hex'),
      roomId: room.id,
      senderId: session.playerId,
      senderName: session.username,
      text: cleanText,
      timestamp: now,
      isSystem: false,
    };

    room.chatHistory.push(message);
    if (room.chatHistory.length > 100) room.chatHistory.shift();

    this.io.to(room.id).emit('chat_message', message);
  }

  public addSystemMessage(room: Room, text: string): void {
    const message: ChatMessage = {
      id: randomBytes(6).toString('hex'),
      roomId: room.id,
      senderId: 'system',
      senderName: 'UNO System',
      text,
      timestamp: Date.now(),
      isSystem: true,
    };

    room.chatHistory.push(message);
    if (room.chatHistory.length > 100) room.chatHistory.shift();

    this.io.to(room.id).emit('chat_message', message);
  }

  public broadcastState(room: Room): void {
    const publicState = room.engine.getPublicState();
    this.io.to(room.id).emit('game_state_update', publicState);

    // Send private state to each connected player individually
    for (const [playerId, session] of room.playerSessions.entries()) {
      if (session.socketId) {
        const privateState = room.engine.getPrivateState(playerId);
        this.io.to(session.socketId).emit('private_state_update', privateState);
      }
    }
  }

  public syncPlayer(
    room: Room,
    playerId: string,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ): void {
    socket.emit('game_state_update', room.engine.getPublicState());
    socket.emit('private_state_update', room.engine.getPrivateState(playerId));
    socket.emit('chat_history', room.chatHistory);
  }

  public getSessionBySocketId(socketId: string): PlayerSession | undefined {
    const token = this.socketToSessionToken.get(socketId);
    return token ? this.sessions.get(token) : undefined;
  }

  public getRoomByPlayerId(playerId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.playerSessions.has(playerId)) return room;
    }
    return undefined;
  }

  private destroyRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.turnTimerInterval) clearInterval(room.turnTimerInterval);
    if (room.cleanupTimeout) clearTimeout(room.cleanupTimeout);

    this.codeToRoomId.delete(room.code);
    for (const [playerId, session] of room.playerSessions.entries()) {
      this.sessions.delete(session.playerId);
    }
    this.rooms.delete(roomId);
  }
}
