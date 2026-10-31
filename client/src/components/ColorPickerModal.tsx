import React from 'react';
import { CardColor } from '../types/game.js';
import { motion, AnimatePresence } from 'framer-motion';

interface ColorPickerModalProps {
  isOpen: boolean;
  onSelectColor: (color: CardColor) => void;
}

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({ isOpen, onSelectColor }) => {
  if (!isOpen) return null;

  const colors: { name: string; value: CardColor; bg: string; border: string; glow: string }[] = [
    { name: 'RED', value: 'red', bg: 'bg-gradient-to-br from-red-500 to-rose-700', border: 'border-red-400', glow: 'shadow-red-500/50' },
    { name: 'BLUE', value: 'blue', bg: 'bg-gradient-to-br from-blue-500 to-indigo-700', border: 'border-blue-400', glow: 'shadow-blue-500/50' },
    { name: 'GREEN', value: 'green', bg: 'bg-gradient-to-br from-emerald-400 to-green-700', border: 'border-emerald-400', glow: 'shadow-emerald-500/50' },
    { name: 'YELLOW', value: 'yellow', bg: 'bg-gradient-to-br from-amber-300 to-yellow-600 text-slate-900', border: 'border-amber-300', glow: 'shadow-yellow-500/50' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="glass-panel p-6 rounded-2xl max-w-sm w-full text-center border-2 border-[#00E5C7]/50 shadow-2xl"
        >
          <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-[#00E5C7] mb-2 tracking-wide">
            CHOOSE NEXT COLOR
          </h3>
          <p className="text-xs text-slate-400 mb-6 font-medium">
            Select the active color for upcoming turns
          </p>

          <div className="grid grid-cols-2 gap-4">
            {colors.map((c) => (
              <button
                key={c.value}
                onClick={() => onSelectColor(c.value)}
                className={`
                  ${c.bg} ${c.border} ${c.glow}
                  h-20 rounded-xl font-black tracking-wider text-lg shadow-lg border-2
                  transition-all duration-150 transform hover:scale-105 active:scale-95 flex items-center justify-center
                  cursor-pointer
                `}
              >
                {c.name}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
