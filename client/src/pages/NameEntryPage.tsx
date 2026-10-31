import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, ShieldCheck, Gamepad2 } from 'lucide-react';
import { soundManager } from '../utils/audio.js';

interface NameEntryPageProps {
  onNameSubmitted: (username: string) => void;
  initialUsername?: string;
}

export const NameEntryPage: React.FC<NameEntryPageProps> = ({
  onNameSubmitted,
  initialUsername = '',
}) => {
  const [username, setUsername] = useState(initialUsername);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim();

    if (!clean) {
      setError('Please enter a username to continue.');
      soundManager.playSound('error');
      return;
    }

    if (clean.length > 16) {
      setError('Username must be 16 characters or less.');
      soundManager.playSound('error');
      return;
    }

    // Basic sanitization
    const sanitized = clean.replace(/[<>]/g, '');
    if (!sanitized) {
      setError('Please use valid characters.');
      soundManager.playSound('error');
      return;
    }

    setError('');
    soundManager.playSound('click');
    onNameSubmitted(sanitized);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-radial from-[#0B1830] via-[#07111F] to-[#040810] relative overflow-hidden select-none">
      {/* Ambient background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#00E5C7]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="glass-panel p-8 sm:p-10 rounded-3xl max-w-md w-full relative z-10 border border-[#00E5C7]/20 shadow-2xl text-center"
      >
        {/* Brand Icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-[#00E5C7]/30 to-blue-500/20 border border-[#00E5C7]/40 flex items-center justify-center shadow-lg shadow-[#00E5C7]/20">
          <Gamepad2 className="w-8 h-8 text-[#00E5C7]" />
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-[#59F3E8] mb-2 drop-shadow-sm">
          READY TO PLAY?
        </h1>
        <p className="text-slate-400 text-sm mb-8 font-medium">
          Choose your identity and join the game.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-left">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Player Identity
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError('');
              }}
              placeholder="Enter your username..."
              maxLength={16}
              autoFocus
              className="w-full bg-[#07111F]/90 border border-white/20 focus:border-[#00E5C7] rounded-xl px-4 py-3.5 text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5C7]/30 transition shadow-inner"
            />
            {error && (
              <p className="text-xs text-rose-400 font-semibold mt-1.5 flex items-center gap-1">
                <span>⚠️</span> {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-4 px-6 rounded-xl font-black text-sm tracking-wider uppercase bg-gradient-to-r from-[#00E5C7] via-teal-400 to-cyan-400 hover:from-[#59F3E8] hover:to-teal-300 text-slate-950 shadow-lg shadow-[#00E5C7]/30 transition-all duration-200 transform hover:scale-102 active:scale-98 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <span>CONTINUE</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Feature badges */}
        <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-center gap-6 text-[11px] text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#00E5C7]" />
            <span>No Account Required</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#59F3E8]" />
            <span>Up to 10 Players</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
