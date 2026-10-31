import React, { useState, useEffect } from 'react';
import { Smartphone, RotateCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const OrientationPrompt: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => {
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      // If mobile width and height indicates portrait
      const isMobile = window.innerWidth <= 1024;
      const portrait = isMobile && window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
      if (!portrait) {
        setIsDismissed(false); // Reset dismissal when rotated to landscape
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const handleRequestLandscape = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (screen.orientation && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock('landscape');
      }
    } catch (e) {
      // Screen orientation lock not permitted by browser; user can rotate manually
    }
  };

  // Only display during active gameplay in portrait mode and not manually dismissed
  if (!isPlaying || !isPortrait || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#07111F]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center text-white"
      >
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 transition cursor-pointer"
          title="Play in portrait anyway"
        >
          <X className="w-5 h-5" />
        </button>

        <motion.div
          animate={{ rotate: [0, -90, -90, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          className="w-20 h-20 mb-6 rounded-2xl border-2 border-[#00E5C7] flex items-center justify-center bg-cyan-950/40 shadow-lg shadow-[#00E5C7]/20"
        >
          <Smartphone className="w-10 h-10 text-[#00E5C7]" />
        </motion.div>

        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-[#00E5C7] mb-2">
          ROTATE TO LANDSCAPE
        </h2>
        <p className="text-sm text-slate-300 max-w-xs mb-8">
          UNO Online is designed for landscape mobile play for the best card table experience.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={handleRequestLandscape}
            className="w-full py-3.5 px-6 rounded-xl font-black bg-gradient-to-r from-[#00E5C7] to-cyan-500 text-slate-950 shadow-lg shadow-cyan-400/25 flex items-center justify-center gap-2 cursor-pointer transition hover:scale-102 active:scale-98"
          >
            <RotateCw className="w-4 h-4" />
            AUTO ROTATE / FULLSCREEN
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
          >
            Continue in portrait mode
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
