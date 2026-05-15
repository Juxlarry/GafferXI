import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { PressingZone } from '../../../tacticalTypes';
import { useTacticalBoard } from '../TacticalBoardContext';

interface ZoneProps {
  zone: PressingZone;
}

function Zone({ zone }: ZoneProps) {
  const { dispatch, pitchRef, state } = useTacticalBoard();
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (state.activeTool !== 'select') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const pitch = pitchRef.current;
    if (!pitch) return;
    const rect = pitch.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    dispatch({ type: 'MOVE_PRESSING_ZONE', id: zone.id, x, y });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  // Render as a percentage-positioned div over the pitch
  return (
    <div
      className="absolute"
      style={{
        left: `${zone.x}%`,
        top: `${zone.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 25,
        pointerEvents: state.activeTool === 'select' ? 'auto' : 'none',
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Circle */}
      <div
        className="relative rounded-full"
        style={{
          width: 80,
          height: 80,
          border: '2px dashed rgba(251,191,36,0.75)',
          backgroundColor: 'rgba(251,191,36,0.08)',
          boxShadow: dragging ? '0 0 0 2px rgba(251,191,36,0.4)' : undefined,
        }}
      >
        {/* Remove button */}
        <button
          className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-zinc-800 border border-zinc-600 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
          style={{ pointerEvents: 'auto' }}
          onClick={e => { e.stopPropagation(); dispatch({ type: 'REMOVE_PRESSING_ZONE', id: zone.id }); }}
        >
          <X className="w-3 h-3 text-white" />
        </button>
        {/* Label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8px] font-black text-yellow-400/60 uppercase tracking-widest">PRESS</span>
        </div>
      </div>
    </div>
  );
}

export default function PressingZones() {
  const { state } = useTacticalBoard();
  const { pressingZones } = state;

  if (!pressingZones.length) return null;

  return (
    <>
      {pressingZones.map(zone => (
        <Zone key={zone.id} zone={zone} />
      ))}
    </>
  );
}
