import React, { useState } from 'react';
import { Card, PendingTargetSelection, PlayerPublic } from '../types/game.js';
import { motion, AnimatePresence } from 'framer-motion';
import { CardView } from './CardView.js';
import { Users, Send } from 'lucide-react';

interface TargetSelectionModalProps {
  pendingTarget: PendingTargetSelection | null;
  currentUserId: string;
  players: PlayerPublic[];
  playerHand: Card[];
  onConfirm: (targetPlayerId: string, giftCardIds?: string[]) => void;
}

export const TargetSelectionModal: React.FC<TargetSelectionModalProps> = ({
  pendingTarget,
  currentUserId,
  players,
  playerHand,
  onConfirm,
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedGiftCardIds, setSelectedGiftCardIds] = useState<string[]>([]);

  if (!pendingTarget || pendingTarget.playerId !== currentUserId) {
    return null;
  }

  const eligiblePlayers = players.filter((p) => pendingTarget.eligibleTargetIds.includes(p.id));

  const toggleGiftCard = (cid: string) => {
    if (selectedGiftCardIds.includes(cid)) {
      setSelectedGiftCardIds(selectedGiftCardIds.filter((id) => id !== cid));
    } else {
      if (selectedGiftCardIds.length < 2) {
        setSelectedGiftCardIds([...selectedGiftCardIds, cid]);
      }
    }
  };

  const handleConfirm = () => {
    if (!selectedTargetId) return;
    if (pendingTarget.actionType === 'gift2' && selectedGiftCardIds.length !== 2) return;
    onConfirm(selectedTargetId, selectedGiftCardIds);
    setSelectedTargetId('');
    setSelectedGiftCardIds([]);
  };

  const getTitle = () => {
    switch (pendingTarget.actionType) {
      case 'swap':
        return 'SWAP HANDS: CHOOSE OPPONENT';
      case 'target_draw':
        return 'TARGET DRAW: CHOOSE OPPONENT (+3 CARDS)';
      case 'gift2':
        return 'GIFT TWO: SELECT OPPONENT & 2 CARDS';
      default:
        return 'CHOOSE TARGET PLAYER';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass-panel-glow p-6 rounded-2xl max-w-lg w-full text-center border-2 border-[#00E5C7]/50 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300">
            <Users className="w-6 h-6" />
          </div>

          <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-[#00E5C7] mb-2 tracking-wide">
            {getTitle()}
          </h3>

          {/* Opponents Selection */}
          <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider text-left">
            1. Select Opponent:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
            {eligiblePlayers.map((player) => (
              <button
                key={player.id}
                onClick={() => setSelectedTargetId(player.id)}
                className={`
                  p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between
                  ${
                    selectedTargetId === player.id
                      ? 'bg-cyan-900/60 border-[#00E5C7] shadow-lg shadow-cyan-500/20 ring-1 ring-[#00E5C7]'
                      : 'bg-slate-900/50 border-white/10 hover:bg-slate-800'
                  }
                `}
              >
                <span className="font-black text-sm text-white truncate">{player.username}</span>
                <span className="text-[11px] text-cyan-300 font-semibold mt-1">
                  {player.cardCount} cards in hand
                </span>
              </button>
            ))}
          </div>

          {/* Gift 2 Cards Selection (If gift2 action) */}
          {pendingTarget.actionType === 'gift2' && (
            <div className="mb-5 text-left">
              <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex justify-between">
                <span>2. Select 2 cards to give ({selectedGiftCardIds.length}/2):</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {playerHand.map((card) => {
                  const isSelected = selectedGiftCardIds.includes(card.id);
                  return (
                    <div
                      key={card.id}
                      onClick={() => toggleGiftCard(card.id)}
                      className={`cursor-pointer transform transition ${isSelected ? 'scale-105 ring-2 ring-cyan-400 rounded-xl' : 'opacity-75 hover:opacity-100'}`}
                    >
                      <CardView card={card} isSmall isSelected={isSelected} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            disabled={
              !selectedTargetId ||
              (pendingTarget.actionType === 'gift2' && selectedGiftCardIds.length !== 2)
            }
            className={`
              w-full py-3 rounded-xl font-black text-sm tracking-wider uppercase transition flex items-center justify-center gap-2
              ${
                selectedTargetId &&
                (pendingTarget.actionType !== 'gift2' || selectedGiftCardIds.length === 2)
                  ? 'bg-gradient-to-r from-teal-400 to-[#00E5C7] text-slate-950 shadow-lg shadow-cyan-400/20 hover:opacity-95 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }
            `}
          >
            <Send className="w-4 h-4" />
            CONFIRM ACTION
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
