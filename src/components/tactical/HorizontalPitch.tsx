import React from 'react';

// SVG viewBox: 1050 × 680 (105m × 68m real pitch, ×10 scale)
// All SVG measurements are in these units.

interface Props {
  children?: React.ReactNode;
}

const STROKE = 'rgba(255,255,255,0.42)';
const SW = 2; // stroke-width

export default function HorizontalPitch({ children }: Props) {
  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden shadow-2xl border border-white/10">
      {/* SVG pitch markings */}
      <svg
        viewBox="0 0 1050 680"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        style={{ display: 'block' }}
      >
        {/* Alternating pitch stripes */}
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <rect key={i} x={i * 150} y={0} width={150} height={680}
            fill={i % 2 === 0 ? '#0a4a2a' : '#0d5530'} />
        ))}

        {/* All white markings */}
        <g stroke={STROKE} strokeWidth={SW} fill="none">
          {/* Outer boundary */}
          <rect x={1} y={1} width={1048} height={678} />

          {/* Halfway line */}
          <line x1={525} y1={0} x2={525} y2={680} />

          {/* Center circle */}
          <circle cx={525} cy={340} r={91.5} />

          {/* Goal areas (6-yard boxes) */}
          <rect x={0}   y={248.4} width={55}  height={183.2} />
          <rect x={995} y={248.4} width={55}  height={183.2} />

          {/* Penalty areas */}
          <rect x={0}   y={138.4} width={165} height={403.2} />
          <rect x={885} y={138.4} width={165} height={403.2} />

          {/* Goals (outside boundary — visible via overflow:visible on parent group) */}
          <rect x={-14} y={303.4} width={14}  height={73.2} />
          <rect x={1050} y={303.4} width={14} height={73.2} />

          {/* D-arcs */}
          <path d="M 165,266.9 A 91.5,91.5 0 0 1 165,413.1" />
          <path d="M 885,413.1 A 91.5,91.5 0 0 1 885,266.9" />

          {/* Corner quarter-circles */}
          <path d="M 10,0   A 10,10 0 0 0 0,10"   />
          <path d="M 1040,0 A 10,10 0 0 1 1050,10" />
          <path d="M 0,670  A 10,10 0 0 1 10,680"  />
          <path d="M 1050,670 A 10,10 0 0 0 1040,680" />
        </g>

        {/* Spots (filled) */}
        <g fill={STROKE}>
          <circle cx={110} cy={340} r={5} />   {/* left penalty spot */}
          <circle cx={940} cy={340} r={5} />   {/* right penalty spot */}
          <circle cx={525} cy={340} r={5} />   {/* center spot */}
        </g>

        {/* Goal line highlights */}
        <g stroke="rgba(255,255,255,0.18)" strokeWidth={6} fill="none">
          <line x1={0}    y1={303.4} x2={0}    y2={376.6} />
          <line x1={1050} y1={303.4} x2={1050} y2={376.6} />
        </g>
      </svg>

      {/* Children (players, overlays, canvas) sit on top */}
      <div className="absolute inset-0">
        {children}
      </div>
    </div>
  );
}
