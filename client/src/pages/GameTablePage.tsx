import React, { useState } from 'react';
import { Card, CardColor, GameStatePublic, PrivatePlayerState } from '../types/game.js';
import { socketClient } from '../socket/socketClient.js';
import { soundManager } from '../utils/audio.js';
import { CardBack, CardView } from '../components/CardView.js';
import { ColorPickerModal } from '../components/ColorPickerModal.js';
import { ChallengeModal } from '../components/ChallengeModal.js';
import { TargetSelectionModal } from '../components/TargetSelectionModal.js';
import { WinnerModal } from '../components/WinnerModal.js';
import { OrientationPrompt } from '../components/OrientationPrompt.js';
import {
  RotateCw,
  RotateCcw,
  Volume2,
  VolumeX,
  MessageSquare,
  Shield,
  Flame,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GameTablePageProps {
  currentUserId: string;
  gameState: GameStatePublic;
  privateState: PrivatePlayerState;
  onOpenChat: () => void;
  unreadChatCount: number;
}

export const GameTablePage: React.FC<GameTablePageProps> = ({
  currentUserId,
  gameState,
  privateState,
  onOpenChat,
  unreadChatCount,
}) => {
  const [isMuted, setIsMuted] = useState(soundManager.isMuted);
  const [pendingWildCardId, setPendingWildCardId] = useState<string | null>(null);

  const isMyTurn = gameState.currentTurn === currentUserId;
  const opponents = gameState.players.filter((p) => p.id !== currentUserId);

  const handleToggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
    if (!muted) soundManager.playSound('click');
  };

  const handleCardClick = (card: Card) => {
    if (!isMyTurn) return;

    if (card.color === 'wild') {
      setPendingWildCardId(card.id);
      return;
    }

    soundManager.playSound('play');
    socketClient.socket.emit('play_card', { cardId: card.id }, (res) => {
      if (!res.success) {
        soundManager.playSound('error');
      }
    });
  };

  const handleSelectWildColor = (chosenColor: CardColor) => {
    if (!pendingWildCardId) return;
    const cardId = pendingWildCardId;
    setPendingWildCardId(null);

    soundManager.playSound('wild');
    socketClient.socket.emit('play_card', { cardId, chosenColor }, (res) => {
      if (!res.success) {
        soundManager.playSound('error');
      }
    });
  };

  const handleDrawCard = () => {
    if (!isMyTurn || !privateState.canDraw) return;
    soundManager.playSound('draw');
    socketClient.socket.emit('draw_card');
  };

  const handlePassTurn = () => {
    if (!isMyTurn || !privateState.canPass) return;
    soundManager.playSound('click');
    socketClient.socket.emit('pass_turn');
  };

  const handleCallUno = () => {
    soundManager.playSound('uno');
    socketClient.socket.emit('call_uno');
  };

  const handleCatchUno = (targetPlayerId: string) => {
    soundManager.playSound('penalty');
    socketClient.socket.emit('catch_uno', targetPlayerId);
  };

  const handleResolveWild4 = (accept: boolean) => {
    socketClient.socket.emit('challenge_wild4', accept);
  };

  const handleConfirmTarget = (targetPlayerId: string, giftCardIds?: string[]) => {
    if (!gameState.pendingTargetSelection) return;
    // We already played the card, target selection resolution event
    socketClient.socket.emit('play_card', {
      cardId: gameState.topCard?.id || '',
      targetPlayerId,
      giftCardIds,
    });
  };

  const getActiveColorGlow = (col: CardColor) => {
    switch (col) {
      case 'red':
        return 'border-red-500 shadow-red-500/50 bg-red-950/30';
      case 'blue':
        return 'border-blue-500 shadow-blue-500/50 bg-blue-950/30';
      case 'green':
        return 'border-emerald-500 shadow-emerald-500/50 bg-emerald-950/30';
      case 'yellow':
        return 'border-amber-400 shadow-amber-400/50 bg-amber-950/30';
      default:
        return 'border-[#00E5C7] shadow-cyan-500/50 bg-cyan-950/30';
    }
  };

  return (
    <div className="h-screen w-screen bg-[#07111F] text-white select-none overflow-hidden flex flex-col justify-between safe-area-container relative">
      {/* Landscape Orientation Prompt for Mobile Devices */}
      <OrientationPrompt isPlaying={gameState.status === 'playing'} />

      {/* Modals */}
      <ColorPickerModal
        isOpen={Boolean(pendingWildCardId)}
        onSelectColor={handleSelectWildColor}
      />

      <ChallengeModal
        challenge={gameState.pendingChallenge}
        currentUserId={currentUserId}
        targetUsername={
          gameState.players.find((p) => p.id === gameState.pendingChallenge?.targetId)?.username ||
          'Opponent'
        }
        onRespond={handleResolveWild4}
      />

      <TargetSelectionModal
        pendingTarget={gameState.pendingTargetSelection}
        currentUserId={currentUserId}
        players={gameState.players}
        playerHand={privateState.hand}
        onConfirm={handleConfirmTarget}
      />

      <WinnerModal
        gameState={gameState}
        currentUserId={currentUserId}
        onNextRound={() => socketClient.socket.emit('start_next_round')}
        onReturnToLobby={() => socketClient.socket.emit('leave_room')}
      />

      {/* TOP BAR: Room Code, Opponents Row, Controls */}
      <div className="h-20 sm:h-24 px-3 sm:px-6 flex items-center justify-between border-b border-white/10 bg-[#0B1830]/80 backdrop-blur-md z-20">
        {/* Left: Room Badge */}
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-[11px] font-mono text-cyan-300 font-bold">
            ROOM: {gameState.roomCode}
          </div>
          <span className="text-[10px] text-slate-400 font-bold hidden sm:inline">
            RND {gameState.roundNumber}
          </span>
        </div>

        {/* Center: Opponent Seats Dynamic Row */}
        <div className="flex-1 max-w-4xl mx-2 flex items-center justify-center gap-2 sm:gap-3 overflow-x-auto py-1 scrollbar-none">
          {opponents.map((p) => {
            const isTurn = gameState.currentTurn === p.id;
            const hasOneCard = p.cardCount === 1;

            return (
              <div
                key={p.id}
                className={`
                  relative flex flex-col items-center px-2 py-1 rounded-xl transition-all duration-200 flex-shrink-0
                  ${
                    isTurn
                      ? 'bg-cyan-950/70 border-2 border-[#00E5C7] shadow-lg shadow-[#00E5C7]/30 scale-105'
                      : 'bg-slate-900/40 border border-white/10'
                  }
                `}
              >
                {/* Active Turn Glow Marker */}
                {isTurn && (
                  <span className="absolute -top-2 px-1.5 py-0.2 rounded-full bg-[#00E5C7] text-slate-950 text-[8px] font-black uppercase tracking-wider animate-pulse">
                    TURN
                  </span>
                )}

                <div className="flex items-center gap-1.5">
                  {/* Card count mini back */}
                  <CardBack isSmall count={p.cardCount} className="w-7 h-10 sm:w-8 sm:h-11" />
                  <div className="text-left">
                    <span className="block text-[11px] sm:text-xs font-bold text-white max-w-[70px] sm:max-w-[85px] truncate">
                      {p.username}
                    </span>
                    <span className="text-[10px] text-cyan-300 font-bold">
                      {p.cardCount} cards
                    </span>
                  </div>
                </div>

                {/* Status Badges: Shield, UNO call */}
                <div className="flex items-center gap-1 mt-0.5">
                  {p.shieldActive && (
                    <span className="p-0.5 rounded bg-cyan-950 text-cyan-300" title="Shield Active">
                      <Shield className="w-2.5 h-2.5" />
                    </span>
                  )}
                  {hasOneCard && (
                    <span className="px-1 py-0.2 rounded bg-amber-500 text-slate-950 text-[8px] font-black animate-bounce">
                      UNO!
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Sound, Chat */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleToggleSound}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 transition cursor-pointer"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-[#00E5C7]" />}
          </button>

          <button
            onClick={onOpenChat}
            className="relative p-1.5 sm:p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 transition cursor-pointer"
            title="Open Chat"
          >
            <MessageSquare className="w-4 h-4 text-[#00E5C7]" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                {unreadChatCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* CENTER PLAY AREA: Direction, Draw Deck, Active Color, Discard Pile */}
      <div className="flex-1 flex flex-col items-center justify-center relative p-2 sm:p-4">
        {/* Play Direction Indicator */}
        <div className="absolute top-2 flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-xs font-bold text-slate-300">
          {gameState.direction === 1 ? (
            <>
              <RotateCw className="w-3.5 h-3.5 text-[#00E5C7] animate-spin" style={{ animationDuration: '6s' }} />
              <span className="text-[10px] uppercase tracking-wider">Clockwise</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="text-[10px] uppercase tracking-wider">Counter-Clockwise</span>
            </>
          )}
        </div>

        {/* Ticker / Last Action Summary */}
        {gameState.lastAction && (
          <div className="absolute top-9 px-4 py-1 rounded-full bg-slate-900/80 border border-cyan-500/30 text-xs text-cyan-200 font-semibold shadow-md max-w-md truncate text-center">
            {gameState.lastAction.action}
          </div>
        )}

        {/* Piles Container */}
        <div className="flex items-center justify-center gap-6 sm:gap-10 my-auto">
          {/* Draw Pile */}
          <div className="flex flex-col items-center">
            <div
              onClick={handleDrawCard}
              className={`
                relative cursor-pointer transition transform active:scale-95
                ${isMyTurn && privateState.canDraw ? 'hover:-translate-y-2 ring-2 ring-[#00E5C7] rounded-xl shadow-xl shadow-[#00E5C7]/20' : 'opacity-85'}
              `}
            >
              <CardBack isSmall={false} count={gameState.drawPileCount} />
              {isMyTurn && privateState.canDraw && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#00E5C7] text-slate-950 text-[10px] font-black uppercase tracking-wider shadow">
                  DRAW
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold text-slate-400 mt-2">
              DECK ({gameState.drawPileCount})
            </span>
          </div>

          {/* Active Color Emblem Ring */}
          <div
            className={`
              w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 flex flex-col items-center justify-center shadow-2xl transition-all duration-300
              ${getActiveColorGlow(gameState.activeColor)}
            `}
            title={`Active Color: ${gameState.activeColor.toUpperCase()}`}
          >
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white drop-shadow">
              {gameState.activeColor}
            </span>
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center">
            <div className="relative transform rotate-1 transition">
              {gameState.topCard ? (
                <CardView card={gameState.topCard} className="shadow-2xl" />
              ) : (
                <div className="w-20 h-28 sm:w-24 sm:h-36 rounded-xl border border-dashed border-white/20 flex items-center justify-center text-xs text-slate-500">
                  Empty
                </div>
              )}
            </div>
            <span className="text-[10px] font-bold text-slate-400 mt-2">
              DISCARD ({gameState.discardPileCount})
            </span>
          </div>
        </div>

        {/* Pending Draw Count Banner (Stacking) */}
        {gameState.pendingDrawCount > 0 && (
          <div className="absolute bottom-2 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-black uppercase tracking-wider animate-bounce shadow-lg shadow-rose-600/40">
            Pending Penalty: +{gameState.pendingDrawCount} Cards!
          </div>
        )}
      </div>

      {/* BOTTOM AREA: Player Hand + Turn Controls */}
      <div className="relative border-t border-white/10 bg-[#0B1830]/90 backdrop-blur-xl p-2 sm:p-3 z-30">
        {/* Action Controls Bar */}
        <div className="flex items-center justify-between mb-2 px-2">
          {/* Turn status indicator */}
          <div className="flex items-center gap-2">
            {isMyTurn ? (
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-teal-400 to-[#00E5C7] text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-[#00E5C7]/30 flex items-center gap-1.5 animate-pulse">
                <span>IT'S YOUR TURN!</span>
              </span>
            ) : (
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Waiting for current player...</span>
              </span>
            )}

            {/* Turn Deadline timer */}
            {gameState.turnDeadline && (
              <span className="text-xs font-mono font-bold text-cyan-300">
                {Math.max(0, Math.ceil((gameState.turnDeadline - Date.now()) / 1000))}s
              </span>
            )}
          </div>

          {/* Action Buttons: Pass, Call UNO, Catch Missed UNO */}
          <div className="flex items-center gap-2">
            {/* Catch Missed UNO Button (if any opponent forgot to call UNO) */}
            {privateState.canCatchUnoPlayerIds.length > 0 && (
              <button
                onClick={() => handleCatchUno(privateState.canCatchUnoPlayerIds[0])}
                className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/30 animate-bounce flex items-center gap-1 cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>CATCH UNO!</span>
              </button>
            )}

            {/* Pass Turn Button (after drawing) */}
            {isMyTurn && privateState.canPass && (
              <button
                onClick={handlePassTurn}
                className="py-1.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/20 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1 cursor-pointer"
              >
                <span>PASS TURN</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Call UNO Button */}
            {privateState.canCallUno && (
              <button
                onClick={handleCallUno}
                className="py-1.5 px-5 rounded-xl bg-gradient-to-r from-red-500 via-amber-500 to-yellow-400 hover:opacity-95 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-pulse flex items-center gap-1.5 cursor-pointer transform hover:scale-105 active:scale-95"
              >
                <Flame className="w-4 h-4 fill-current text-slate-950" />
                <span>CALL UNO!</span>
              </button>
            )}
          </div>
        </div>

        {/* Player's Cards Hand (Horizontal Scroll / Fan) */}
        <div className="flex items-end justify-start sm:justify-center overflow-x-auto py-1 px-4 scrollbar-thin">
          <div className="flex items-end -space-x-4 sm:-space-x-6 pb-2 pt-4 px-2">
            {privateState.hand.map((card) => {
              // Check if card is playable
              const isPlayable = isMyTurn; // UI allows clicking, engine validates
              return (
                <div
                  key={card.id}
                  onClick={() => handleCardClick(card)}
                  className="transform transition-transform duration-200 flex-shrink-0"
                >
                  <CardView card={card} isPlayable={isPlayable} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
