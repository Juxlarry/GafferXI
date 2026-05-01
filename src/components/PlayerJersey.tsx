
import React from 'react';
import { Player } from '../types';
import { formatPlayerName, getJerseyName } from '../utils/player';

interface PlayerJerseyProps {
  player: Player;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showName?: boolean;
}

const PlayerJersey: React.FC<PlayerJerseyProps> = ({ 
  player, 
  size = 'md', 
  className = '',
  showName = false
}) => {
  const formattedName = formatPlayerName(player.name);
  const jerseyName = getJerseyName(player.name);
  
  // Font size multiplier based on name length to ensure it fits
  const getFontSizeMultiplier = (name: string) => {
    if (name.length > 10) return 0.7;
    if (name.length > 8) return 0.85;
    return 1;
  };

  const multiplier = getFontSizeMultiplier(jerseyName);

  const sizeClasses = {
    sm: { base: 'w-8 h-8', font: 'text-[5px]' },
    md: { base: 'w-12 h-12', font: 'text-[6.5px]' },
    lg: { base: 'w-16 h-16', font: 'text-[8.5px]' },
    xl: { base: 'w-32 h-32', font: 'text-[12px]' }
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`relative flex flex-col items-center group ${className}`}>
      <div className={`relative ${currentSize.base} transition-transform duration-300 group-hover:scale-110`}>
        {/* Simple Jersey Shape using CSS/SVG */}
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}>
          {/* Main Body */}
          <path 
            d="M20,20 L80,20 L85,45 L75,45 L75,90 L25,90 L25,45 L15,45 Z" 
            fill="#FCD116" 
            stroke="#111" 
            strokeWidth="1"
          />
          {/* Collar/Neck */}
          <path 
            d="M40,20 Q50,30 60,20" 
            fill="none" 
            stroke="#D40000" 
            strokeWidth="4"
          />
          {/* Sleeves detail */}
          <path d="M15,45 L25,45" stroke="#00843D" strokeWidth="3" />
          <path d="M85,45 L75,45" stroke="#00843D" strokeWidth="3" />
          
          {/* Black Star in center */}
          <path 
            d="M50,35 L53,44 L62,44 L55,50 L58,59 L50,53 L42,59 L45,50 L38,44 L47,44 Z" 
            fill="black" 
          />
          
          {/* Jersey Pattern (Subtle) */}
          <path d="M30,90 L30,40 M40,90 L40,40 M60,90 L60,40 M70,90 L70,40" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
        </svg>

        {/* Name on Jersey - positioned within the bottom half of the torso */}
        <div 
          className="absolute top-[68%] left-1/2 -translate-x-1/2 w-full text-center px-2"
          style={{ transform: `translateX(-50%) scale(${multiplier})` }}
        >
          <p className={`font-black text-zinc-900 uppercase tracking-tighter leading-none ${currentSize.font}`}>
            {jerseyName}
          </p>
        </div>
      </div>
      {showName && (
        <span className="mt-1 text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm whitespace-nowrap">
          {formattedName}
        </span>
      )}
    </div>
  );
};

export default PlayerJersey;
