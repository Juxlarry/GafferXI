import React, { createContext, useContext, useReducer } from 'react';
import type {
  TacticalBoardState, TacticalBoardAction, TacticalTeam, TacticalPlayer,
} from '../../tacticalTypes';
import type { Formation, FormationPosition, Position } from '../../types';

// ─── Position priority (mirrors App.tsx) ─────────────────────────────────────

const MIDFIELD: Position[] = ['CDM', 'CM', 'CAM'];
const ATTACK:   Position[] = ['LW', 'RW', 'ST', 'CF'];
const DEFENSE:  Position[] = ['CB', 'LB', 'RB', 'LWB', 'RWB'];
const WIDE_MID: Position[] = ['LM', 'RM'];

function positionPriority(playerPos: Position, slotPos: Position): number {
  if (playerPos === slotPos) return 0;
  if (MIDFIELD.includes(slotPos)) return MIDFIELD.includes(playerPos) ? 1 : 2;
  if (ATTACK.includes(slotPos))   return (ATTACK.includes(playerPos) || playerPos === 'CAM') ? 1 : 2;
  if (WIDE_MID.includes(slotPos)) return (WIDE_MID.includes(playerPos) || ATTACK.includes(playerPos) || MIDFIELD.includes(playerPos)) ? 1 : 2;
  if (DEFENSE.includes(slotPos))  return DEFENSE.includes(playerPos) ? 1 : 2;
  return 2;
}

// ─── Coordinate mapping ───────────────────────────────────────────────────────

export function mapToHorizontal(pos: FormationPosition, teamId: 'A' | 'B'): { x: number; y: number } {
  // Formation coords: x=0-100 (left-right), y=0-100 (bottom-to-top, GK at 10)
  // Horizontal pitch: Team A attacks right (GK on left), Team B attacks left (GK on right)
  if (teamId === 'A') {
    return { x: (pos.y / 100) * 47, y: pos.x };
  }
  return { x: 100 - (pos.y / 100) * 47, y: pos.x };
}

// ─── Formation change with intelligent position reassignment ─────────────────

export function applyFormationChange(team: TacticalTeam, newFormation: Formation): TacticalTeam {
  const players = [...team.players];
  const placed = new Set<string>();

  type Assignment = { pos: FormationPosition; player: TacticalPlayer | null };
  const assignments: Assignment[] = [];

  // Pass 1: exact position-type match
  newFormation.positions.forEach(pos => {
    const match = players.find(p => p.positionLabel === pos.type && !placed.has(p.id));
    if (match) { placed.add(match.id); assignments.push({ pos, player: match }); }
    else assignments.push({ pos, player: null });
  });

  // Pass 2: fill empty slots with closest positional fit
  assignments.forEach(a => {
    if (a.player !== null) return;
    const unplaced = players.filter(p => !placed.has(p.id));
    if (!unplaced.length) return;
    const best = [...unplaced].sort(
      (a2, b) => positionPriority(a2.positionLabel, a.pos.type) - positionPriority(b.positionLabel, a.pos.type)
    )[0];
    a.player = best;
    placed.add(best.id);
  });

  const newPlayers = assignments
    .filter(a => a.player !== null)
    .map(({ pos, player }) => {
      const { x, y } = mapToHorizontal(pos, team.id);
      return { ...player!, x, y, originX: x, originY: y };
    });

  return { ...team, formation: newFormation, players: newPlayers };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

const initialState: TacticalBoardState = {
  isSetupComplete: false,
  teamA: null, teamB: null,
  activeTool: 'select',
  activeColor: '#facc15',
  traceModeActive: false,
  traces: [], shapes: [],
  offsideLineX: 50,
  pressingZones: [],
  overlays: {
    showFormationLines: false,
    showOffsideLine: false,
    showPitchThirds: false,
    showPressingZones: false,
    showPlayerLabels: true,
  },
  past: [], future: [],
};

function boardReducer(state: TacticalBoardState, action: TacticalBoardAction): TacticalBoardState {
  switch (action.type) {

    case 'COMPLETE_SETUP':
      return { ...initialState, isSetupComplete: true, teamA: action.teamA, teamB: action.teamB };

    case 'MOVE_PLAYER': {
      // Capture current position before update (for trace)
      let sourceTeam: TacticalTeam | null = null;
      let sourcePlayer: TacticalPlayer | null = null;
      for (const team of [state.teamA, state.teamB]) {
        if (!team) continue;
        const p = team.players.find(p => p.id === action.playerId);
        if (p) { sourceTeam = team; sourcePlayer = p; break; }
      }

      const updateTeam = (team: TacticalTeam | null) =>
        team ? {
          ...team,
          players: team.players.map(p =>
            p.id === action.playerId ? { ...p, x: action.x, y: action.y } : p
          ),
        } : null;

      let newTraces = state.traces;
      if (state.traceModeActive && sourceTeam && sourcePlayer) {
        const existingIdx = newTraces.findIndex(t => t.playerId === action.playerId);
        if (existingIdx >= 0) {
          // Update the last waypoint (live position); locked waypoints stay frozen
          newTraces = newTraces.map((t, i) =>
            i === existingIdx
              ? { ...t, waypoints: [...t.waypoints.slice(0, -1), { x: action.x, y: action.y }] }
              : t
          );
        } else {
          newTraces = [...newTraces, {
            playerId: action.playerId,
            waypoints: [
              { x: sourcePlayer.x, y: sourcePlayer.y },
              { x: action.x, y: action.y },
            ],
            color: sourceTeam.color,
          }];
        }
      }

      return {
        ...state,
        teamA: updateTeam(state.teamA),
        teamB: updateTeam(state.teamB),
        traces: newTraces,
      };
    }

    case 'CHANGE_FORMATION': {
      if (action.teamId === 'A' && state.teamA)
        return { ...state, teamA: applyFormationChange(state.teamA, action.formation) };
      if (action.teamId === 'B' && state.teamB)
        return { ...state, teamB: applyFormationChange(state.teamB, action.formation) };
      return state;
    }

    case 'SET_TOOL':  return { ...state, activeTool: action.tool };
    case 'SET_COLOR': return { ...state, activeColor: action.color };
    case 'TOGGLE_TRACE_MODE': return { ...state, traceModeActive: !state.traceModeActive };

    case 'ADD_SHAPE': {
      const newPast = [...state.past, state.shapes].slice(-MAX_HISTORY);
      return { ...state, shapes: [...state.shapes, action.shape], past: newPast, future: [] };
    }

    case 'UPDATE_SHAPE': {
      const newPast = [...state.past, state.shapes].slice(-MAX_HISTORY);
      return { ...state, shapes: state.shapes.map(s => s.id === action.shape.id ? action.shape : s), past: newPast, future: [] };
    }

    case 'DELETE_SHAPE': {
      const newPast = [...state.past, state.shapes].slice(-MAX_HISTORY);
      return { ...state, shapes: state.shapes.filter(s => s.id !== action.id), past: newPast, future: [] };
    }

    case 'UNDO': {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return { ...state, shapes: prev, past: state.past.slice(0, -1), future: [...state.future, state.shapes] };
    }

    case 'REDO': {
      if (!state.future.length) return state;
      const next = state.future[state.future.length - 1];
      return { ...state, shapes: next, past: [...state.past, state.shapes], future: state.future.slice(0, -1) };
    }

    case 'CLEAR_DRAWINGS': return { ...state, shapes: [], past: [], future: [] };
    case 'CLEAR_TRACES':   return { ...state, traces: [] };

    case 'SET_OFFSIDE_LINE': return { ...state, offsideLineX: action.x };

    case 'ADD_PRESSING_ZONE':
      return { ...state, pressingZones: [...state.pressingZones, { id: crypto.randomUUID(), x: 50, y: 50 }] };

    case 'MOVE_PRESSING_ZONE':
      return {
        ...state,
        pressingZones: state.pressingZones.map(z =>
          z.id === action.id ? { ...z, x: action.x, y: action.y } : z
        ),
      };

    case 'REMOVE_PRESSING_ZONE':
      return { ...state, pressingZones: state.pressingZones.filter(z => z.id !== action.id) };

    case 'TOGGLE_OVERLAY':
      return { ...state, overlays: { ...state.overlays, [action.overlay]: !state.overlays[action.overlay] } };

    case 'RESET_POSITIONS': {
      const resetTeam = (team: TacticalTeam | null) =>
        team ? { ...team, players: team.players.map(p => ({ ...p, x: p.originX, y: p.originY })) } : null;
      return { ...state, teamA: resetTeam(state.teamA), teamB: resetTeam(state.teamB), traces: [] };
    }

    case 'RESET_ANALYSIS': {
      const resetTeam = (team: TacticalTeam | null) =>
        team ? { ...team, players: team.players.map(p => ({ ...p, x: p.originX, y: p.originY })) } : null;
      return {
        ...state,
        teamA: resetTeam(state.teamA),
        teamB: resetTeam(state.teamB),
        traces: [],
        shapes: [],
        past: [],
        future: [],
        traceModeActive: false,
        pressingZones: [],
      };
    }

    case 'LOCK_TRACE': {
      return {
        ...state,
        traces: state.traces.map(t =>
          t.playerId === action.playerId && t.waypoints.length >= 2
            ? { ...t, waypoints: [...t.waypoints, { ...t.waypoints[t.waypoints.length - 1] }] }
            : t
        ),
      };
    }

    case 'RESET_BOARD': return initialState;

    default: return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ContextValue {
  state: TacticalBoardState;
  dispatch: React.Dispatch<TacticalBoardAction>;
  pitchRef: React.RefObject<HTMLDivElement | null>;
}

const TacticalBoardContext = createContext<ContextValue | null>(null);

export function TacticalBoardProvider({
  children,
  pitchRef,
}: {
  children: React.ReactNode;
  pitchRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [state, dispatch] = useReducer(boardReducer, initialState);
  return (
    <TacticalBoardContext.Provider value={{ state, dispatch, pitchRef }}>
      {children}
    </TacticalBoardContext.Provider>
  );
}

export function useTacticalBoard() {
  const ctx = useContext(TacticalBoardContext);
  if (!ctx) throw new Error('useTacticalBoard must be used inside TacticalBoardProvider');
  return ctx;
}
