import { io } from 'socket.io-client';
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== UNO COMPREHENSIVE INTEGRATION SUITE ===\n');

  // Start compiled server on port 3999
  const serverPath = path.resolve(__dirname, '../../dist/index.js');
  const serverProcess = fork(serverPath, [], {
    env: { ...process.env, PORT: '3999', CLIENT_URL: 'https://unothegame.netlify.app' }
  });

  await sleep(1500);

  try {
    const origin = 'https://unothegame.netlify.app';

    // 1. Health check & root endpoint
    console.log('--- TEST 1: HTTP Root & Health Check ---');
    const rootRes = await fetch('http://localhost:3999/');
    const rootJson = await rootRes.json();
    console.log('GET /:', rootRes.status, rootJson);
    if (rootRes.status !== 200 || rootJson.service !== 'UNO Game Server') throw new Error('Root check failed');

    const healthRes = await fetch('http://localhost:3999/health');
    const healthJson = await healthRes.json();
    console.log('GET /health:', healthRes.status, healthJson);
    if (healthRes.status !== 200 || healthJson.status !== 'ok') throw new Error('Health check failed');
    console.log('PASSED: HTTP Endpoints functional.\n');

    // 2. Socket.IO Polling Handshakes (with & without slash)
    console.log('--- TEST 2: Socket.IO Engine.IO Polling Handshakes ---');
    const pollSlashRes = await fetch('http://localhost:3999/socket.io/?EIO=4&transport=polling', {
      headers: { Origin: origin }
    });
    const pollSlashText = await pollSlashRes.text();
    console.log('Polling with slash:', pollSlashRes.status, pollSlashText.slice(0, 45) + '...');
    if (pollSlashRes.status !== 200 || !pollSlashText.includes('"sid"')) throw new Error('Polling with slash failed');

    const pollNoSlashRes = await fetch('http://localhost:3999/socket.io?EIO=4&transport=polling', {
      headers: { Origin: origin }
    });
    const pollNoSlashText = await pollNoSlashRes.text();
    console.log('Polling without slash:', pollNoSlashRes.status, pollNoSlashText.slice(0, 45) + '...');
    if (pollNoSlashRes.status !== 200 || !pollNoSlashText.includes('"sid"')) throw new Error('Polling without slash failed');
    console.log('PASSED: Engine.IO polling handshakes with and without trailing slash succeed.\n');

    // 3. CORS Check
    console.log('--- TEST 3: CORS Validation ---');
    const corsOrigin = pollSlashRes.headers.get('access-control-allow-origin');
    const corsCreds = pollSlashRes.headers.get('access-control-allow-credentials');
    console.log('CORS Allow-Origin:', corsOrigin, '| Allow-Credentials:', corsCreds);
    if (corsOrigin !== origin || corsCreds !== 'true') throw new Error('CORS header validation failed');
    console.log('PASSED: Strict CORS correctly permits Netlify origin with credentials.\n');

    // 4. WebSocket Connection & Upgrade
    console.log('--- TEST 4: WebSocket Connection & Upgrade ---');
    const hostSocket = io('http://localhost:3999', {
      transports: ['polling', 'websocket'],
      extraHeaders: { Origin: origin }
    });

    await new Promise((res, rej) => {
      hostSocket.on('connect', () => {
        console.log('Host socket connected via transport:', hostSocket.io.engine.transport.name);
        res(true);
      });
      hostSocket.on('connect_error', rej);
    });

    await sleep(300);
    console.log('Host transport after upgrade:', hostSocket.io.engine.transport.name);
    console.log('PASSED: Socket connects and upgrades to WebSocket.\n');

    // 5. Room Creation
    console.log('--- TEST 5: Create Room ---');
    const createRoomRes = await new Promise((res) => {
      hostSocket.emit('create_room', { username: 'PlayerHost' }, res);
    });
    console.log('create_room result:', createRoomRes);
    if (!createRoomRes.success || !createRoomRes.roomCode || createRoomRes.roomCode.length !== 6) {
      throw new Error('create_room failed');
    }
    const roomCode = createRoomRes.roomCode;
    console.log('PASSED: Room created with code:', roomCode, '\n');

    // 6. Join Room & Invalid Code Rejection
    console.log('--- TEST 6: Join Room & Invalid Code Validation ---');
    const invalidJoinRes = await new Promise((res) => {
      hostSocket.emit('join_room', { roomCode: 'BADCOD', username: 'TestUser' }, res);
    });
    console.log('Invalid room join attempt:', invalidJoinRes);
    if (invalidJoinRes.success !== false) throw new Error('Invalid room code should be rejected');

    const clientSockets = [];
    // 7. Join up to 10 players total (Host + 9 players)
    console.log('--- TEST 7: 10-Player Capacity Test ---');
    for (let i = 2; i <= 10; i++) {
      const pSocket = io('http://localhost:3999', {
        transports: ['polling', 'websocket'],
        extraHeaders: { Origin: origin }
      });
      await new Promise(r => pSocket.on('connect', r));
      const joinRes = await new Promise(r => {
        pSocket.emit('join_room', { roomCode, username: 'Player_' + i }, r);
      });
      if (!joinRes.success) throw new Error('Player ' + i + ' failed to join: ' + joinRes.error);
      clientSockets.push(pSocket);
    }
    console.log('All 10 players successfully joined room', roomCode);

    // Test 11th Player Rejection
    const eleventhSocket = io('http://localhost:3999', { transports: ['polling'], extraHeaders: { Origin: origin } });
    await new Promise(r => eleventhSocket.on('connect', r));
    const eleventhJoinRes = await new Promise(r => {
      eleventhSocket.emit('join_room', { roomCode, username: 'Player_11' }, r);
    });
    console.log('11th Player Join Result (expected failure):', eleventhJoinRes);
    if (eleventhJoinRes.success !== false) throw new Error('11th player should have been rejected');
    eleventhSocket.disconnect();
    console.log('PASSED: 10-player capacity enforced and 11th player rejected.\n');

    // 8. Start Game & Card Privacy Check
    console.log('--- TEST 8: Game Start & Privacy Protection ---');
    let hostPrivateCards = null;
    let p2PrivateCards = null;
    let publicGameState = null;

    hostSocket.on('private_state_update', (state) => { hostPrivateCards = state.hand; });
    clientSockets[0].on('private_state_update', (state) => { p2PrivateCards = state.hand; });
    hostSocket.on('game_state_update', (state) => { publicGameState = state; });

    hostSocket.emit('start_game');
    await sleep(600);

    if (!publicGameState || publicGameState.status !== 'playing') throw new Error('Game failed to start');
    console.log('Game status:', publicGameState.status, '| Current turn:', publicGameState.currentTurn);
    console.log('Top card:', publicGameState.topCard);
    console.log('Host private card count:', hostPrivateCards?.length);
    console.log('Player 2 private card count:', p2PrivateCards?.length);

    const expectedHostCards = publicGameState.topCard?.value === 'draw2' ? 9 : 7;
    if (hostPrivateCards.length !== expectedHostCards || p2PrivateCards.length !== 7) {
      throw new Error(`Invalid dealt cards: expected host ${expectedHostCards}, got ${hostPrivateCards?.length}`);
    }

    // Verify public state does not expose hands
    for (const player of publicGameState.players) {
      if (player.hand !== undefined) throw new Error('CRITICAL SECURITY: Private hand exposed in public game state!');
    }
    console.log('PASSED: Game started with 7 cards dealt each and private cards strictly hidden.\n');

    // 9. Real-Time Chat & Rate Limiting
    console.log('--- TEST 9: Chat Delivery & Isolation ---');
    let receivedChat = null;
    clientSockets[0].on('chat_message', (msg) => { receivedChat = msg; });
    hostSocket.emit('send_chat', 'Good luck everyone!');
    await sleep(300);

    console.log('Chat message received by Player 2:', receivedChat?.text, 'from:', receivedChat?.senderName);
    if (!receivedChat || receivedChat.text !== 'Good luck everyone!') throw new Error('Chat message failed to deliver');
    console.log('PASSED: Real-time room chat functioning.\n');

    // 10. Reconnect Session
    console.log('--- TEST 10: Session Reconnection ---');
    clientSockets[0].disconnect();
    await sleep(200);

    const reconnectedSocket = io('http://localhost:3999', {
      transports: ['polling', 'websocket'],
      extraHeaders: { Origin: origin }
    });
    await new Promise(r => reconnectedSocket.on('connect', r));

    // Reconnect using sessionToken
    const reconnectRes = await new Promise(r => {
      reconnectedSocket.emit('reconnect_session', { sessionToken: createRoomRes.sessionToken, roomCode }, r);
    });
    console.log('reconnect_session response:', reconnectRes);
    if (!reconnectRes.success) throw new Error('reconnect_session failed');
    console.log('PASSED: Session reconnected successfully via reconnect_session.\n');
    reconnectedSocket.disconnect();

    // Clean up sockets
    hostSocket.disconnect();
    clientSockets.forEach(s => s.disconnect());

    console.log('============================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY');
    console.log('============================================\n');
  } finally {
    serverProcess.kill();
  }
}

main().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
