import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Formation, Squad, Player, FormationPosition } from '../types';
import { User, Plus } from 'lucide-react';

import PlayerJersey from './PlayerJersey';

interface PitchProps {
  formation: Formation;
  squad: Squad;
  onPositionClick: (position: FormationPosition) => void;
  onPlayerClick: (player: Player) => void;
  selectedPlayerId?: string;
  compact?: boolean;
}

const Pitch: React.FC<PitchProps> = ({
  formation,
  squad,
  onPositionClick,
  onPlayerClick,
  selectedPlayerId,
  compact = false,
}) => {
  return (
    <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${compact ? '' : 'bg-zinc-950 p-8'}`}>
      {/* 3D Pitch Container */}
      <div
        className="relative w-full max-w-xl aspect-[2/3] bg-emerald-600 rounded-lg shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden border-4 border-emerald-500/30"
        style={compact ? undefined : {
          perspective: '1200px',
          transform: 'rotateX(20deg) scale(0.95)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Pitch Markings & Positions */}
        <div className="absolute inset-0 border-2 border-white/20 m-6">
          {/* Markings */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-white/20 rounded-full" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-32 border-2 border-t-0 border-white/20" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-32 border-2 border-b-0 border-white/20" />
          </div>

          {/* Positions */}
          {formation.positions.map((pos) => {
            const playersAtPos = squad[pos.id] || [];
            const mainPlayer = playersAtPos[0];

            return (
              <motion.div
                key={pos.id}
                layoutId={pos.id}
                className="absolute flex flex-col items-center justify-center group"
                style={{
                  left: `${pos.x}%`,
                  top: `${100 - pos.y}%`,
                }}
                initial={{ x: '-50%', y: '-50%', scale: 0, opacity: 0 }}
                animate={{ x: '-50%', y: '-50%', scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15, stiffness: 100 }}
              >
                {mainPlayer ? (
                  <div 
                    onClick={() => onPlayerClick(mainPlayer)}
                    className="cursor-pointer relative"
                  >
                    <PlayerJersey 
                      player={mainPlayer} 
                      size="lg"
                      className={selectedPlayerId === mainPlayer.id ? 'scale-125 z-10' : ''}
                    />
                    
                    {/* Hover "Add" overlay */}
                    <div 
                      className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPositionClick(pos);
                      }}
                    >
                      <Plus className="w-6 h-6 text-white bg-emerald-500 rounded-full p-1" />
                    </div>
                  </div>
                ) : (
                  <div 
                    className="w-12 h-12 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-all"
                    onClick={() => onPositionClick(pos)}
                  >
                    <Plus className="w-5 h-5 text-white/30" />
                  </div>
                )}
                
                {/* Simplified Label */}
                <div className="mt-1 flex flex-col items-center">
                  <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{pos.label}</span>
                  {mainPlayer && (
                    <span className="text-[10px] font-black text-white uppercase bg-zinc-900/80 px-2 py-0.5 rounded border border-white/5 shadow-lg truncate max-w-[80px]">
                      {mainPlayer.name.split(' ').pop()}
                    </span>
                  )}
                </div>

                {/* Stack dot */}
                {playersAtPos.length > 1 && (
                  <div className="absolute top-0 -right-2 w-4 h-4 bg-emerald-500 text-[8px] font-black text-white rounded-full flex items-center justify-center border border-zinc-950 shadow-lg">
                    {playersAtPos.length}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Pitch;
