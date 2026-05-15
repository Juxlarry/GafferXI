import React from 'react';

// For a horizontal pitch, "thirds" are vertical bands:
// Left third (0-33%): Team A defensive / Team B attacking
// Middle third (33-66%)
// Right third (66-100%): Team A attacking / Team B defensive

export default function PitchThirds() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ zIndex: 3 }}
    >
      {/* Left third */}
      <rect x={0} y={0} width={33.33} height={100} fill="rgba(239,68,68,0.08)" />
      {/* Right third */}
      <rect x={66.66} y={0} width={33.34} height={100} fill="rgba(59,130,246,0.08)" />

      {/* Dividing lines */}
      <line x1={33.33} y1={0} x2={33.33} y2={100} stroke="rgba(255,255,255,0.15)" strokeWidth={0.4} strokeDasharray="2 2" />
      <line x1={66.66} y1={0} x2={66.66} y2={100} stroke="rgba(255,255,255,0.15)" strokeWidth={0.4} strokeDasharray="2 2" />

      {/* Labels */}
      <text x={16.5}  y={5} textAnchor="middle" fill="rgba(239,68,68,0.6)"   fontSize={2} fontWeight="bold" fontFamily="sans-serif">DEF THIRD</text>
      <text x={50}    y={5} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={2} fontWeight="bold" fontFamily="sans-serif">MID THIRD</text>
      <text x={83.33} y={5} textAnchor="middle" fill="rgba(59,130,246,0.6)"  fontSize={2} fontWeight="bold" fontFamily="sans-serif">ATT THIRD</text>
    </svg>
  );
}
