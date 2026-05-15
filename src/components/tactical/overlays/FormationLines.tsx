import React from 'react';
import type { TacticalTeam, TacticalPlayer } from '../../../tacticalTypes';
import type { Position } from '../../../types';

interface Props {
  teamA: TacticalTeam | null;
  teamB: TacticalTeam | null;
}

const GK_POS:  Position[] = ['GK'];
const DEF_POS: Position[] = ['CB', 'LB', 'RB', 'LWB', 'RWB'];
const MID_POS: Position[] = ['CM', 'CAM', 'CDM', 'LM', 'RM'];
const FWD_POS: Position[] = ['LW', 'RW', 'ST', 'CF'];

const LINE_GROUPS = [DEF_POS, MID_POS, FWD_POS];

function groupPlayers(players: TacticalPlayer[]) {
  return LINE_GROUPS.map(group =>
    players
      .filter(p => group.includes(p.positionLabel))
      .sort((a, b) => a.y - b.y) // top-to-bottom order
  ).filter(g => g.length > 0);
}

function TeamLines({ team, opacity = 0.55 }: { team: TacticalTeam; opacity?: number }) {
  const groups = groupPlayers(team.players);

  return (
    <g stroke={team.color} strokeWidth={0.8} fill="none" opacity={opacity}>
      {/* Horizontal lines within each positional group */}
      {groups.map((group, gi) => {
        if (group.length < 2) return null;
        return (
          <polyline
            key={`h-${gi}`}
            points={group.map(p => `${p.x},${p.y}`).join(' ')}
            strokeDasharray="1.5 1"
          />
        );
      })}

      {/* Vertical connections between adjacent groups (through the central player) */}
      {groups.slice(0, -1).map((group, gi) => {
        const nextGroup = groups[gi + 1];
        // Connect center player of each group to center of next group
        const a = group[Math.floor(group.length / 2)];
        const b = nextGroup[Math.floor(nextGroup.length / 2)];
        return <line key={`v-${gi}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeDasharray="1.5 1" />;
      })}
    </g>
  );
}

export default function FormationLines({ teamA, teamB }: Props) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ zIndex: 5 }}
    >
      {teamA && <TeamLines team={teamA} />}
      {teamB && <TeamLines team={teamB} />}
    </svg>
  );
}
