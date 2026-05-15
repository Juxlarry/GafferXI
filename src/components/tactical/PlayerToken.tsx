import React, { useState } from 'react';
import type { TacticalPlayer } from '../../tacticalTypes';
import { useTacticalBoard } from './TacticalBoardContext';

interface Props {
  player: TacticalPlayer;
  teamColor: string;
  teamId: 'A' | 'B';
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function PlayerToken({ player, teamColor, teamId }: Props) {
  const { state, dispatch, pitchRef } = useTacticalBoard();
  const { activeTool, overlays, traceModeActive } = state;

  const [localPos, setLocalPos] = useState<{ x: number; y: number } | null>(null);
  const isDragging = localPos !== null;

  const displayX = localPos?.x ?? player.x;
  const displayY = localPos?.y ?? player.y;

  const isGK = player.positionLabel === 'GK';
  // GK gets slightly darker token
  const bgColor = isGK ? darken(teamColor) : teamColor;

  function darken(hex: string) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setLocalPos({ x: player.x, y: player.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const pitch = pitchRef.current;
    if (!pitch) return;
    const rect = pitch.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setLocalPos({ x, y });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dispatch({ type: 'MOVE_PLAYER', playerId: player.id, x: localPos!.x, y: localPos!.y });
    setLocalPos(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!traceModeActive) return;
    e.stopPropagation();
    dispatch({ type: 'LOCK_TRACE', playerId: player.id });
  };

  const labelName = player.name.split(' ').pop() ?? player.name;

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: `${displayX}%`,
        top: `${displayY}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isDragging ? 50 : (activeTool === 'select' ? 40 : 10),
        cursor: activeTool === 'select' ? (isDragging ? 'grabbing' : 'grab') : 'default',
        pointerEvents: activeTool === 'select' ? 'auto' : 'none',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Circle token */}
      <div
        className="relative flex items-center justify-center rounded-full border-2 border-white/80 shadow-lg select-none"
        style={{
          width: 36,
          height: 36,
          backgroundColor: bgColor,
          boxShadow: isDragging
            ? `0 8px 24px ${hexToRgba(bgColor, 0.6)}, 0 0 0 3px rgba(255,255,255,0.4)`
            : `0 2px 8px ${hexToRgba(bgColor, 0.5)}`,
        }}
      >
        <span className="text-white font-black text-[11px] leading-none drop-shadow-sm select-none">
          {player.number}
        </span>
        {/* Position badge */}
        <div
          className="absolute -top-1.5 -right-1.5 rounded-full border border-white/60 flex items-center justify-center"
          style={{ width: 14, height: 14, backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <span className="text-white text-[6px] font-black leading-none">{player.positionLabel}</span>
        </div>
      </div>

      {/* Name label */}
      {overlays.showPlayerLabels && (
        <div
          className="mt-0.5 px-1.5 py-px rounded text-center max-w-[60px] truncate leading-tight select-none"
          style={{
            backgroundColor: 'rgba(0,0,0,0.75)',
            border: '1px solid rgba(255,255,255,0.15)',
            fontSize: 9,
            fontWeight: 700,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}
        >
          {labelName}
        </div>
      )}
    </div>
  );
}
