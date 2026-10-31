import React from 'react';
import { PendingChallenge } from '../types/game.js';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle, HelpCircle } from 'lucide-react';

interface ChallengeModalProps {
  challenge: PendingChallenge | null;
  currentUserId: string;
  targetUsername: string;
  onRespond: (accept: boolean) => void;
}

export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  challenge,
  currentUserId,
  targetUsername,
  onRespond,
}) => {
  if (!challenge || challenge.challengerId !== currentUserId) {
    return null;
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          className="glass-panel-glow p-6 rounded-2xl max-w-md w-full text-center border-2 border-amber-400 shadow-2xl"
        >
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-300">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-black text-amber-300 mb-1 tracking-wide">
            WILD DRAW FOUR INCOMING!
          </h3>
          <p className="text-sm text-slate-300 mb-4 font-medium">
            <span className="text-white font-bold">{targetUsername}</span> played a Wild Draw 4 on you!
          </p>

          <div className="bg-black/50 rounded-xl p-3 mb-5 border border-white/10 text-left text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300">
              <HelpCircle className="w-4 h-4" />
              <span>Classic Challenge Rules:</span>
            </div>
            <p>
              • If you <strong>CHALLENGE</strong> and they were bluffing (held matching{' '}
              <span className="uppercase text-amber-300 font-bold">{challenge.activeColorBefore}</span>):{' '}
              <strong>THEY draw 4 cards!</strong>
            </p>
            <p>
              • If you <strong>CHALLENGE</strong> and they were innocent:{' '}
              <strong>YOU draw 6 cards (4 + 2 penalty)</strong> and lose your turn!
            </p>
            <p>
              • If you <strong>ACCEPT</strong>: You draw 4 cards peacefully.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onRespond(false)}
              className="py-3 px-4 rounded-xl font-black bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              ACCEPT (+4)
            </button>

            <button
              onClick={() => onRespond(true)}
              className="py-3 px-4 rounded-xl font-black bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              CHALLENGE!
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
