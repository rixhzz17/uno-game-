import React, { useState, useEffect } from 'react';
import { socketClient } from './socket/socketClient.js';
import { ChatMessage, GameStatePublic, PrivatePlayerState } from './types/game.js';
import { NameEntryPage } from './pages/NameEntryPage.js';
import { LobbyPage } from './pages/LobbyPage.js';
import { GameTablePage } from './pages/GameTablePage.js';
import { ChatPanel } from './components/ChatPanel.js';
import { WifiOff, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('uno_username') || '';
  });
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [gameState, setGameState] = useState<GameStatePublic | null>(null);
  const [privateState, setPrivateState] = useState<PrivatePlayerState>({
    hand: [],
    canDraw: false,
    canPass: false,
    canCallUno: false,
    canCatchUnoPlayerIds: [],
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [toastError, setToastError] = useState<string | null>(null);

  // Auto-clear toast after 4s
  useEffect(() => {
    if (toastError) {
      const timer = setTimeout(() => setToastError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastError]);

  useEffect(() => {
    const unsubConnection = socketClient.onConnectionChange((connected) => {
      setIsConnected(connected);
    });

    const unsubGameState = socketClient.onGameState((state) => {
      setGameState(state);
      // Find our user ID by matching username if not yet recorded
      if (username) {
        const found = state.players.find((p) => p.username === username);
        if (found) {
          setCurrentUserId(found.id);
        }
      }
    });

    const unsubPrivateState = socketClient.onPrivateState((state) => {
      setPrivateState(state);
    });

    const unsubChatMessage = socketClient.onChatMessage((msg) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!isChatOpen) {
        setUnreadChatCount((prev) => prev + 1);
      }
    });

    const unsubChatHistory = socketClient.onChatHistory((history) => {
      setChatMessages(history);
    });

    const unsubError = socketClient.onError((err) => {
      setToastError(err);
    });

    return () => {
      unsubConnection();
      unsubGameState();
      unsubPrivateState();
      unsubChatMessage();
      unsubChatHistory();
      unsubError();
    };
  }, [username, isChatOpen]);

  const handleNameSubmitted = (chosenName: string) => {
    setUsername(chosenName);
    localStorage.setItem('uno_username', chosenName);
  };

  const handleLeaveRoom = () => {
    socketClient.socket.emit('leave_room');
    socketClient.clearSession();
    setGameState(null);
    setPrivateState({
      hand: [],
      canDraw: false,
      canPass: false,
      canCallUno: false,
      canCatchUnoPlayerIds: [],
    });
    setChatMessages([]);
  };

  const handleOpenChat = () => {
    setIsChatOpen(true);
    setUnreadChatCount(0);
  };

  return (
    <div className="min-h-screen w-full bg-[#07111F] text-white overflow-hidden relative">
      {/* Network Reconnection Banner */}
      {!isConnected && (
        <div className="fixed top-0 inset-x-0 z-50 bg-rose-600/95 text-white py-1.5 px-4 text-xs font-bold flex items-center justify-center gap-2 shadow-lg backdrop-blur-sm animate-pulse">
          <WifiOff className="w-4 h-4" />
          <span>Reconnecting to UNO Game Server...</span>
        </div>
      )}

      {/* Floating Error Toast */}
      {toastError && (
        <div className="fixed top-4 right-4 z-50 bg-rose-950/90 border border-rose-500/50 text-rose-200 py-2.5 px-4 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 backdrop-blur-md">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{toastError}</span>
        </div>
      )}

      {/* Primary Flow Screens */}
      {!username ? (
        <NameEntryPage onNameSubmitted={handleNameSubmitted} />
      ) : !gameState || gameState.status === 'lobby' ? (
        <LobbyPage
          username={username}
          currentUserId={currentUserId}
          gameState={gameState}
          onLeaveRoom={handleLeaveRoom}
          onOpenChat={handleOpenChat}
          unreadChatCount={unreadChatCount}
        />
      ) : (
        <GameTablePage
          currentUserId={currentUserId}
          gameState={gameState}
          privateState={privateState}
          onOpenChat={handleOpenChat}
          unreadChatCount={unreadChatCount}
        />
      )}

      {/* Global Real-Time Room Chat Drawer */}
      <ChatPanel
        messages={chatMessages}
        currentUserId={currentUserId}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
};

export default App;
