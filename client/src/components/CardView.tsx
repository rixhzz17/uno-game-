import React from 'react';
import { Card, CardColor } from '../types/game.js';
import {
  Ban,
  RotateCcw,
  Plus,
  Zap,
  ArrowLeftRight,
  Crosshair,
  Shield as ShieldIcon,
  Gift,
  Flame,
} from 'lucide-react';

interface CardViewProps {
  card: Card;
  isPlayable?: boolean;
  isSelected?: boolean;
  isSmall?: boolean;
  onClick?: () => void;
  className?: string;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  isPlayable = false,
  isSelected = false,
  isSmall = false,
  onClick,
  className = '',
}) => {
  const getColorGradient = (color: CardColor) => {
    switch (color) {
      case 'red':
        return 'from-rose-500 via-red-600 to-red-800 text-white';
      case 'blue':
        return 'from-sky-400 via-blue-600 to-indigo-800 text-white';
      case 'green':
        return 'from-emerald-400 via-green-600 to-emerald-800 text-white';
      case 'yellow':
        return 'from-amber-300 via-yellow-500 to-amber-700 text-slate-900';
      case 'wild':
      default:
        return 'from-purple-900 via-slate-900 to-cyan-900 text-white';
    }
  };

  const renderIconOrValue = (val: string, sizeClass: string) => {
    switch (val) {
      case 'skip':
        return <Ban className={sizeClass} />;
      case 'reverse':
        return <RotateCcw className={sizeClass} />;
      case 'draw2':
        return <span className="font-black tracking-tighter flex items-center"><Plus className="w-4 h-4 stroke-[3]" />2</span>;
      case 'wild4':
        return <span className="font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-300 via-green-300 to-blue-400 flex items-center"><Plus className="w-4 h-4 text-white stroke-[3]" />4</span>;
      case 'wild':
        return (
          <div className="grid grid-cols-2 gap-1 w-6 h-6 rounded-full overflow-hidden border border-white/50 p-0.5 bg-black/40">
            <div className="bg-red-500 rounded-tl-full" />
            <div className="bg-blue-500 rounded-tr-full" />
            <div className="bg-yellow-400 rounded-bl-full" />
            <div className="bg-green-500 rounded-br-full" />
          </div>
        );
      case 'draw5':
        return <span className="font-black text-rose-300 flex items-center"><Plus className="w-4 h-4 stroke-[3]" />5</span>;
      case 'swap':
        return <ArrowLeftRight className={sizeClass} />;
      case 'target_draw':
        return <Crosshair className={sizeClass} />;
      case 'shield':
        return <ShieldIcon className={sizeClass} />;
      case 'gift2':
        return <Gift className={sizeClass} />;
      case 'double_turn':
        return <Zap className={sizeClass} />;
      default:
        return <span className="font-black tracking-tight">{val}</span>;
    }
  };

  const getSubLabel = (val: string) => {
    switch (val) {
      case 'draw5': return 'DRAW 5';
      case 'swap': return 'SWAP';
      case 'target_draw': return 'TARGET';
      case 'shield': return 'SHIELD';
      case 'gift2': return 'GIFT 2';
      case 'double_turn': return 'DOUBLE';
      default: return null;
    }
  };

  const subLabel = getSubLabel(card.value);

  // Sizing definitions
  const dimensions = isSmall
    ? 'w-14 h-20 text-sm'
    : 'w-20 h-28 sm:w-24 sm:h-36 md:w-26 md:h-38 text-base';

  return (
    <div
      onClick={isPlayable || onClick ? onClick : undefined}
      className={`
        relative select-none rounded-xl font-bold transition-all duration-200 shadow-lg cursor-pointer
        flex flex-col justify-between p-1.5 border border-white/20
        ${dimensions}
        bg-gradient-to-br ${getColorGradient(card.color)}
        ${isPlayable ? 'ring-2 ring-[#00E5C7] ring-offset-2 ring-offset-[#07111F] hover:-translate-y-3 shadow-[#00E5C7]/30 shadow-xl' : 'opacity-90'}
        ${isSelected ? '-translate-y-4 ring-4 ring-cyan-300 shadow-2xl' : ''}
        ${!isPlayable && onClick ? 'hover:-translate-y-1' : ''}
        ${className}
      `}
      style={{
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Top Left Corner */}
      <div className="flex items-center gap-0.5 text-xs font-black self-start">
        {renderIconOrValue(card.value, 'w-3.5 h-3.5')}
      </div>

      {/* Center Centerpiece */}
      <div className="absolute inset-0 m-auto w-10 h-14 sm:w-13 sm:h-18 rounded-full bg-white/10 backdrop-blur-xs flex flex-col items-center justify-center border border-white/20 shadow-inner">
        <div className="text-xl sm:text-2xl md:text-3xl font-black drop-shadow-md">
          {renderIconOrValue(card.value, 'w-6 h-6 sm:w-7 sm:h-7')}
        </div>
        {subLabel && (
          <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-widest text-cyan-200 mt-0.5">
            {subLabel}
          </span>
        )}
      </div>

      {/* Bottom Right Inverted Corner */}
      <div className="flex items-center gap-0.5 text-xs font-black self-end rotate-180">
        {renderIconOrValue(card.value, 'w-3.5 h-3.5')}
      </div>

      {/* Custom Card Indicator Star */}
      {card.custom && (
        <div className="absolute top-1 right-1">
          <Flame className="w-3 h-3 text-amber-300 drop-shadow" />
        </div>
      )}
    </div>
  );
};

export const CardBack: React.FC<{ isSmall?: boolean; className?: string; count?: number }> = ({
  isSmall = false,
  className = '',
  count,
}) => {
  const dimensions = isSmall ? 'w-12 h-18 text-xs' : 'w-20 h-28 sm:w-24 sm:h-36';

  return (
    <div
      className={`
        relative rounded-xl border-2 border-[#00E5C7]/40 bg-gradient-to-br from-[#0B1830] via-[#07111F] to-[#040913]
        shadow-xl flex items-center justify-center overflow-hidden p-2 select-none
        ${dimensions} ${className}
      `}
    >
      {/* Diagonal red/teal banner */}
      <div className="absolute -inset-4 bg-gradient-to-r from-red-600/20 via-cyan-500/30 to-blue-600/20 rotate-45 transform pointer-events-none" />

      {/* UNO glowing emblem */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="px-2 py-0.5 rounded-full border border-[#00E5C7]/60 bg-black/50 shadow-inner text-center">
          <span className="text-xs sm:text-sm font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-amber-300 to-[#00E5C7]">
            UNO
          </span>
        </div>
        {count !== undefined && (
          <span className="text-[10px] font-bold text-cyan-300 mt-1">
            {count} {count === 1 ? 'card' : 'cards'}
          </span>
        )}
      </div>
    </div>
  );
};
