import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RoomManager } from './rooms/roomManager.js';
import { ClientToServerEvents, ServerToClientEvents } from './types/game.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '0.0.0.0';

// Configured allowed origins for CORS (Netlify production, localhost, and custom CLIENT_URL)
const allowedOrigins = [
  'https://unothegame.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((u) => u.trim().replace(/\/$/, ''))
    : []),
];

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true; // Allow non-browser tools, health checks, curl
  const clean = origin.trim().replace(/\/$/, '');
  if (allowedOrigins.includes('*') || allowedOrigins.includes(clean)) return true;
  if (/^https:\/\/.*\.netlify\.app$/.test(clean)) return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return false;
};

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

app.use(express.json());

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000,
});

const roomManager = new RoomManager(io);

// Root service info
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'UNO Game Server',
    version: '1.0.0',
    uptime: process.uptime(),
  });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

io.on('connection', (socket) => {
  // 1. Create Room
  socket.on('create_room', ({ username, sessionToken }, callback) => {
    try {
      if (!username || username.trim().length === 0) {
        callback({ success: false, error: 'Username is required.' });
        return;
      }
      const { room, sessionToken: token } = roomManager.createRoom(username, sessionToken, socket.id);
      socket.join(room.id);
      callback({ success: true, roomCode: room.code, sessionToken: token });
      roomManager.syncPlayer(room, room.engine.hostId, socket);
    } catch (err: any) {
      callback({ success: false, error: err.message || 'Failed to create room' });
    }
  });

  // 2. Join Room
  socket.on('join_room', ({ roomCode, username, sessionToken }, callback) => {
    try {
      const result = roomManager.joinRoom(roomCode, username, sessionToken, socket.id);
      if (!result.success || !result.room || !result.playerId) {
        callback({ success: false, error: result.error || 'Failed to join room' });
        return;
      }
      socket.join(result.room.id);
      callback({ success: true, sessionToken: result.sessionToken });
      roomManager.syncPlayer(result.room, result.playerId, socket);
    } catch (err: any) {
      callback({ success: false, error: err.message || 'Failed to join room' });
    }
  });

  // 3. Reconnect Session
  socket.on('reconnect_session', ({ sessionToken, roomCode }, callback) => {
    try {
      const result = roomManager.reconnect(sessionToken, roomCode, socket);
      if (!result.success) {
        callback({ success: false, error: result.error });
        return;
      }
      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message || 'Failed to reconnect' });
    }
  });

  // 4. Leave Room
  socket.on('leave_room', () => {
    roomManager.leaveRoom(socket.id);
  });

  // 5. Toggle Ready
  socket.on('toggle_ready', () => {
    roomManager.toggleReady(socket.id);
  });

  // 6. Update Settings
  socket.on('update_settings', (settings) => {
    roomManager.updateSettings(socket.id, settings);
  });

  // 7. Start Game
  socket.on('start_game', () => {
    roomManager.startGame(socket.id);
  });

  // 8. Start Next Round
  socket.on('start_next_round', () => {
    roomManager.startNextRound(socket.id);
  });

  // 9. Play Card
  socket.on('play_card', ({ cardId, chosenColor, targetPlayerId, giftCardIds }, callback) => {
    try {
      const session = roomManager.getSessionBySocketId(socket.id);
      if (!session) {
        if (callback) callback({ success: false, error: 'Unauthorized session' });
        return;
      }

      const room = roomManager.getRoomByPlayerId(session.playerId);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }

      const res = room.engine.playCard(session.playerId, cardId, chosenColor, targetPlayerId, giftCardIds);
      if (!res.success) {
        if (callback) callback({ success: false, error: res.error });
        return;
      }

      if (callback) callback({ success: true });
      if (res.sound) {
        io.to(room.id).emit('sound_effect', res.sound);
      }
      roomManager.broadcastState(room);
    } catch (err: any) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // 10. Draw Card
  socket.on('draw_card', (callback) => {
    try {
      const session = roomManager.getSessionBySocketId(socket.id);
      if (!session) {
        if (callback) callback({ success: false, error: 'Unauthorized session' });
        return;
      }

      const room = roomManager.getRoomByPlayerId(session.playerId);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }

      const res = room.engine.drawCard(session.playerId);
      if (!res.success) {
        if (callback) callback({ success: false, error: res.error });
        return;
      }

      if (callback) callback({ success: true });
      io.to(room.id).emit('sound_effect', 'draw');
      roomManager.broadcastState(room);
    } catch (err: any) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // 11. Pass Turn
  socket.on('pass_turn', (callback) => {
    try {
      const session = roomManager.getSessionBySocketId(socket.id);
      if (!session) {
        if (callback) callback({ success: false, error: 'Unauthorized session' });
        return;
      }

      const room = roomManager.getRoomByPlayerId(session.playerId);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }

      const res = room.engine.passTurn(session.playerId);
      if (!res.success) {
        if (callback) callback({ success: false, error: res.error });
        return;
      }

      if (callback) callback({ success: true });
      roomManager.broadcastState(room);
    } catch (err: any) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // 12. Call UNO
  socket.on('call_uno', (callback) => {
    try {
      const session = roomManager.getSessionBySocketId(socket.id);
      if (!session) {
        if (callback) callback({ success: false, error: 'Unauthorized session' });
        return;
      }

      const room = roomManager.getRoomByPlayerId(session.playerId);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }

      const res = room.engine.callUno(session.playerId);
      if (!res.success) {
        if (callback) callback({ success: false, error: res.error });
        return;
      }

      if (callback) callback({ success: true });
      io.to(room.id).emit('sound_effect', 'uno');
      roomManager.broadcastState(room);
    } catch (err: any) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // 13. Catch UNO
  socket.on('catch_uno', (targetPlayerId, callback) => {
    try {
      const session = roomManager.getSessionBySocketId(socket.id);
      if (!session) {
        if (callback) callback({ success: false, error: 'Unauthorized session' });
        return;
      }

      const room = roomManager.getRoomByPlayerId(session.playerId);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }

      const res = room.engine.catchUno(session.playerId, targetPlayerId);
      if (!res.success) {
        if (callback) callback({ success: false, error: res.error });
        return;
      }

      if (callback) callback({ success: true });
      io.to(room.id).emit('sound_effect', 'penalty');
      roomManager.broadcastState(room);
    } catch (err: any) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // 14. Wild Draw 4 Challenge
  socket.on('challenge_wild4', (acceptChallenge, callback) => {
    try {
      const session = roomManager.getSessionBySocketId(socket.id);
      if (!session) {
        if (callback) callback({ success: false, error: 'Unauthorized session' });
        return;
      }

      const room = roomManager.getRoomByPlayerId(session.playerId);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }

      const res = room.engine.resolveWild4Challenge(acceptChallenge);
      if (!res.success) {
        if (callback) callback({ success: false, error: res.message });
        return;
      }

      if (callback) callback({ success: true });
      io.to(room.id).emit('sound_effect', 'penalty');
      roomManager.broadcastState(room);
    } catch (err: any) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // 15. Real-Time Chat
  socket.on('send_chat', (text) => {
    roomManager.sendChat(socket.id, text);
  });

  // 16. Disconnect
  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket.id);
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`🚀 UNO Game Server running on port ${PORT} (${HOST})`);
});
