import React from 'react';
import type { PlayerTrace } from '../../tacticalTypes';

interface Props {
  traces: PlayerTrace[];
}

export default function TraceLayer({ traces }: Props) {
  if (!traces.length) return null;

  const uniqueColors = Array.from(new Set(traces.map(t => t.color)));

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ zIndex: 20 }}
    >
      <defs>
        {uniqueColors.map(color => {
          const id = `arr-${color.replace('#', '')}`;
          return (
            <marker
              key={id}
              id={id}
              markerWidth={8}
              markerHeight={8}
              refX={6}
              refY={3}
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill={color} opacity={0.9} />
            </marker>
          );
        })}
      </defs>

      {traces.map(trace => {
        if (trace.waypoints.length < 2) return null;
        const markerId = `arr-${trace.color.replace('#', '')}`;
        const segCount = trace.waypoints.length - 1;

        return (
          <g key={trace.playerId}>
            {/* Origin dot */}
            <circle
              cx={trace.waypoints[0].x}
              cy={trace.waypoints[0].y}
              r={0.7}
              fill={trace.color}
              opacity={0.85}
            />

            {/* Lock dots at intermediate waypoints (not origin, not current end) */}
            {trace.waypoints.slice(1, -1).map((wp, i) => (
              <g key={`lock-${i}`}>
                <circle cx={wp.x} cy={wp.y} r={1.1} fill={trace.color} opacity={0.9} />
                <circle cx={wp.x} cy={wp.y} r={1.1} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={0.3} />
              </g>
            ))}

            {/* One line segment per consecutive waypoint pair */}
            {trace.waypoints.slice(0, -1).map((wp, i) => {
              const next = trace.waypoints[i + 1];
              const isLast = i === segCount - 1;
              const dx = next.x - wp.x;
              const dy = next.y - wp.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len < 0.1) return null;
              const shortenBy = Math.min(2, len * 0.15);
              const x2 = next.x - (dx / len) * shortenBy;
              const y2 = next.y - (dy / len) * shortenBy;
              const opacity = isLast ? 0.9 : 0.55;

              return (
                <g key={`seg-${i}`}>
                  <line
                    x1={wp.x} y1={wp.y} x2={x2} y2={y2}
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth={0.7}
                    strokeDasharray="2 1.5"
                  />
                  <line
                    x1={wp.x} y1={wp.y} x2={x2} y2={y2}
                    stroke={trace.color}
                    strokeWidth={0.5}
                    strokeDasharray="2 1.5"
                    opacity={opacity}
                    markerEnd={`url(#${markerId})`}
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
