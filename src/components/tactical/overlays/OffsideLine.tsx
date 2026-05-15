import React, { useState } from 'react';
import { useTacticalBoard } from '../TacticalBoardContext';

// On a horizontal pitch, the offside line is VERTICAL (runs top-to-bottom)
// at a given x-percentage. User drags it left/right.

export default function OffsideLine() {
  const { state, dispatch, pitchRef } = useTacticalBoard();
  const { offsideLineX } = state;
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<SVGLineElement>) => {
    e.stopPropagation();
    (e.target as SVGLineElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGLineElement>) => {
    if (!dragging) return;
    const pitch = pitchRef.current;
    if (!pitch) return;
    const rect = pitch.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    dispatch({ type: 'SET_OFFSIDE_LINE', x });
  };

  const handlePointerUp = (e: React.PointerEvent<SVGLineElement>) => {
    (e.target as SVGLineElement).releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  const lineColor = dragging ? '#facc15' : '#f87171';

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ zIndex: 15, pointerEvents: 'none' }}
    >
      {/* Wide invisible hit-target for easy dragging */}
      <line
        x1={offsideLineX} y1={0} x2={offsideLineX} y2={100}
        stroke="transparent"
        strokeWidth={6}
        style={{ pointerEvents: 'stroke', cursor: 'ew-resize' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {/* Visible dashed line */}
      <line
        x1={offsideLineX} y1={0} x2={offsideLineX} y2={100}
        stroke={lineColor}
        strokeWidth={0.5}
        strokeDasharray="3 1.5"
        style={{ pointerEvents: 'none' }}
      />
      {/* Label at top */}
      <text
        x={offsideLineX + 0.8}
        y={4}
        fill={lineColor}
        fontSize={2.2}
        fontWeight="bold"
        fontFamily="sans-serif"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        OFFSIDE
      </text>
      {/* Drag handle pill in the middle */}
      <rect
        x={offsideLineX - 1.2} y={48}
        width={2.4} height={4}
        rx={0.5}
        fill={lineColor}
        opacity={0.7}
        style={{ pointerEvents: 'none' }}
      />
    </svg>
  );
}
