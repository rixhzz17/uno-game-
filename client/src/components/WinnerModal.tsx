import React, { useEffect } from 'react';
import { GameStatePublic } from '../types/game.js';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy, RotateCw, LogOut, Award, Flame } from 'lucide-react';
import { soundManager } from '../utils/audio.js';

interface WinnerModalProps {
  gameState: GameStatePublic;
  currentUserId: string;
  onNextRound: () => void;
  onReturnToLobby: () => void;
}

export const WinnerModal: React.FC<WinnerModalProps> = ({
  gameState,
  currentUserId,
  onNextRound,
  onReturnToLobby,
}) => {
  const isGameOver = gameState.status === 'game_over' || gameState.status === 'round_over';
  const winner = gameState.players.find(
    (p) => p.id === (gameState.winnerId || gameState.roundWinnerId)
  );
  const isHost = gameState.hostId === currentUserId;

  useEffect(() => {
    if (isGameOver) {
      soundManager.playSound('win');
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00E5C7', '#59F3E8', '#EF4444', '#F59E0B', '#3B82F6'],
        });
      } catch (e) {
        // Confetti fallback
      }
    }
  }, [isGameOver]);

  if (!isGameOver || !winner) return null;

  const isMeWinner = winner.id === currentUserId;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="glass-panel-glow p-6 sm:p-8 rounded-3xl max-w-md w-full text-center border-2 border-[#00E5C7]/60 shadow-2xl relative overflow-hidden"
        >
          {/* Ambient celebration glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#00E5C7]/20 rounded-full blur-2xl pointer-events-none" />

          {/* Trophy Icon */}
          <motion.div
            animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-amber-500/30 to-yellow-300/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 shadow-xl shadow-amber-500/20"
          >
            <Trophy className="w-10 h-10" />
          </motion.div>

          {/* Winner Title */}
          <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-[#00E5C7] mb-1">
            {isMeWinner ? 'YOU WON THE ROUND!' : `${winner.username.toUpperCase()} WON!`}
          </h2>

          <p className="text-xs text-slate-300 mb-6 font-medium">
            {gameState.status === 'game_over'
              ? 'Game complete! Final leaderboard:'
              : `Round ${gameState.roundNumber} is complete.`}
          </p>

          {/* Leaderboard / Scores */}
          <div className="bg-black/50 rounded-2xl p-3.5 mb-6 border border-white/10 max-h-48 overflow-y-auto space-y-2">
            {gameState.players
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs ${
                    p.id === winner.id
                      ? 'bg-amber-500/20 border border-amber-400/40 text-amber-200 font-black'
                      : 'bg-slate-900/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-center font-bold text-slate-500">#{idx + 1}</span>
                    <span className="truncate">{p.username}</span>
                    {p.id === winner.id && <Award className="w-3.5 h-3.5 text-amber-300" />}
                  </div>
                  <span className="font-mono font-bold text-cyan-300">{p.score} pts</span>
                </div>
              ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {isHost ? (
              <button
                onClick={onNextRound}
                className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-[#00E5C7] to-cyan-500 text-slate-950 shadow-lg shadow-cyan-400/30 hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                START NEXT ROUND
              </button>
            ) : (
              <div className="text-xs text-slate-400 font-medium py-2">
                Waiting for host to start next round...
              </div>
            )}

            <button
              onClick={onReturnToLobby}
              className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              RETURN TO LOBBY
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
