# UNO Online Multiplayer Game

A real-time, low-latency, database-free online multiplayer UNO game supporting up to 10 players per room with classic Mattel rules, optional house rules & custom action cards, landscape-first mobile gameplay, real-time chat, and synthesized Web Audio effects.

---

## 🎮 Key Features

- **Real-Time Multiplayer (Up to 10 Players)**:
  - WebSocket communication via Socket.IO with authoritative server game state.
  - Room code generation (e.g. `UNO7K2`), shareable links, and 1-tap clipboard copy.
  - Dynamic opponent seat positioning supporting 2 to 10 players simultaneously.
- **Classic Mattel Rules (Authoritative Game Engine)**:
  - 108-card official classic deck.
  - Official 2-player Reverse rule (acts as Skip, giving player another turn immediately).
  - Wild Draw 4 challenge mechanic (bluffing penalty vs innocent challenger penalty).
  - UNO shout button & "Catch UNO" 2-card penalty enforcement.
  - Empty draw deck reshuffling from discard pile.
- **Custom House Rules Mode**:
  - Optional Stacking (+2 on +2, +4 on +4, +5 on +5).
  - Jump-In rule (play identical card out of turn).
  - 7-0 Hand Swap (7 swaps with chosen player, 0 rotates hands in play direction).
  - Draw-to-play rule.
  - Custom action cards: **Draw Five**, **Swap Hands**, **Target Draw**, **Shield**, **Gift Two**, **Double Turn**.
- **Privacy & Security**:
  - Opponents' card hands are **never** transmitted to other clients over the network. Only public card counts and discard state are broadcast.
  - Server validates all card plays, draws, colors, and player turns.
  - Session tokens allow reconnecting seamlessly into the same seat after network blips or page reloads.
- **Landscape-First Mobile Design**:
  - Optimized horizontal card table layout with card fan, tappable card actions, and safe-area insets.
  - Smart orientation detector displaying a non-blocking "Rotate to Landscape" overlay with auto-fullscreen and portrait continuation option.
- **Zero-Asset Web Audio Synthesizer**:
  - Low-latency sound effects generated natively using the Web Audio API (crisp card snaps, draws, fanfare, win chords, and buzzers) with zero asset loading delays or broken 404s.
- **Real-Time Room Chat**:
  - In-game and in-lobby chat drawer with timestamps, system announcements, and rate limiting.

---

## 🏗️ Project Architecture

```
uno/
├── client/                     # Vite + React + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/         # CardView, ChatPanel, ColorPickerModal, ChallengeModal, TargetSelectionModal, WinnerModal, OrientationPrompt
│   │   ├── pages/              # NameEntryPage, LobbyPage, GameTablePage
│   │   ├── socket/             # socketClient.ts (Socket.IO client with auto-reconnection)
│   │   ├── utils/              # audio.ts (Native Web Audio API sound synthesizer)
│   │   ├── types/              # game.ts (Shared type contracts)
│   │   ├── App.tsx             # Main controller and socket state bridge
│   │   ├── index.css           # Modern gaming theme (Midnight Navy #07111F, Electric Teal #00E5C7)
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                     # Node.js + Express + TypeScript + Socket.IO Server
│   ├── src/
│   │   ├── game/               # Pure game engine (deck.ts, engine.ts)
│   │   ├── rooms/              # Room and Session Manager (roomManager.ts)
│   │   ├── types/              # game.ts (Shared type contracts)
│   │   ├── tests/              # engine.test.ts (Vitest automated test suite)
│   │   └── index.ts            # Express server and Socket.IO event router
│   ├── package.json
│   └── tsconfig.json
├── package.json                # Workspace root scripts
├── .env.example
└── README.md
```

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js >= 18.x (tested on v22.23.1)
- npm >= 9.x

### 1. Install Dependencies
Run in the project root:
```bash
npm --prefix server install
npm --prefix client install
```

### 2. Run Automated Game Engine Tests
To verify all rules (dealing, card matching, 10-player limits, challenges, custom cards):
```bash
npm run test
```
*Result: 10/10 Vitest tests pass with 100% assertions.*

### 3. Start Development Servers
In two separate terminals:
```bash
# Terminal 1: Start Backend (Port 3001)
npm run dev:server

# Terminal 2: Start Frontend (Port 5173)
npm run dev:client
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🌐 Production Deployment

### 1. Backend Deployment (Render, Railway, or Fly.io)
Deploy the `server` directory as a persistent Node.js service that supports WebSockets:

1. **Build Command**: `npm install && npm run build`
2. **Start Command**: `node dist/index.js`
3. **Environment Variables**:
   - `PORT`: `3001` (or provided by host)
   - `CLIENT_URL`: `https://your-frontend.vercel.app` (your frontend domain)

### 2. Frontend Deployment (Vercel or Netlify)
Deploy the `client` directory:

1. **Framework Preset**: Vite
2. **Root Directory**: `client`
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. **Environment Variables**:
   - `VITE_BACKEND_URL`: `https://your-backend.onrender.com` (your deployed backend URL)

---

## 🛡️ Rules Documentation

### Classic Mode
- Standard 108 cards dealt 7 per player.
- Turn order: Clockwise initially.
- Number cards must match current active color or face number.
- Draw Two causes next player to draw 2 and skip turn (no stacking in classic).
- Reverse in 2-player acts as a Skip (Mattel official classic rule).
- Wild Draw 4 challenge: victim can challenge if player had matching active color cards. Innocent victim draws 6; caught bluffer draws 4.
- UNO button appears when player has 1 or 2 cards. Failure to call before next play allows opponents to press "CATCH UNO" for a 2-card penalty.

### Custom Mode
- Host can toggle custom action cards:
  - **Draw Five**: Forces next player to draw 5 cards.
  - **Swap Hands**: Swap your entire hand with any opponent of choice.
  - **Target Draw**: Force any chosen player to draw 3 cards.
  - **Shield**: Activates a protective shield that nullifies the next incoming draw penalty.
  - **Gift Two**: Send 2 cards from your hand to an opponent.
  - **Double Turn**: Take another turn immediately.
- Stacking: Chain +2 on +2 or +4 on +4.
- Jump-In: Play an exact copy of the top card out of turn.
