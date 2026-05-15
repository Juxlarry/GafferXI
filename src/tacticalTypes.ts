import type { Formation, Position } from './types';

export interface TacticalPlayer {
  id: string;
  teamId: 'A' | 'B';
  name: string;
  number: number;
  positionLabel: Position;
  x: number;      // 0-100, left-to-right % of pitch
  y: number;      // 0-100, top-to-bottom % of pitch
  originX: number;
  originY: number;
}

export interface TacticalTeam {
  id: 'A' | 'B';
  name: string;
  color: string;
  formation: Formation;
  players: TacticalPlayer[];
}

export type DrawingTool = 'select' | 'arrow' | 'circle' | 'square' | 'rectangle' | 'triangle'
                        | 'line' | 'dashed-line' | 'star' | 'diamond' | 'cross';
// Note: 'dashed-line' is a tool mode only; it produces a LineShape with dashed:true
export type ShapeType = 'arrow' | 'circle' | 'square' | 'rectangle' | 'triangle'
                      | 'line' | 'star' | 'diamond' | 'cross';

interface BaseShape { id: string; color: string; rotation?: number; }

// All shape coordinates in pixels relative to the canvas at draw time
export interface ArrowShape   extends BaseShape { type: 'arrow';     x1: number; y1: number; x2: number; y2: number; }
export interface CircleShape  extends BaseShape { type: 'circle';    cx: number; cy: number; r: number; }
export interface SquareShape  extends BaseShape { type: 'square';    x: number; y: number; side: number; }
export interface RectShape    extends BaseShape { type: 'rectangle'; x: number; y: number; w: number; h: number; }
export interface TriShape     extends BaseShape { type: 'triangle';  cx: number; cy: number; r: number; }
export interface LineShape    extends BaseShape { type: 'line';      x1: number; y1: number; x2: number; y2: number; dashed?: boolean; }
export interface StarShape    extends BaseShape { type: 'star';      cx: number; cy: number; r: number; }
export interface DiamondShape extends BaseShape { type: 'diamond';   cx: number; cy: number; r: number; }
export interface CrossShape   extends BaseShape { type: 'cross';     cx: number; cy: number; r: number; }
export type DrawingShape = ArrowShape | CircleShape | SquareShape | RectShape | TriShape
                         | LineShape | StarShape | DiamondShape | CrossShape;

export interface PlayerTrace {
  playerId: string;
  waypoints: Array<{ x: number; y: number }>; // [origin, ...locked, current]
  color: string;
}

export interface OverlaySettings {
  showFormationLines: boolean;
  showOffsideLine: boolean;
  showPitchThirds: boolean;
  showPressingZones: boolean;
  showPlayerLabels: boolean;
}

export interface PressingZone {
  id: string;
  x: number; y: number; // % of pitch
}

export interface TacticalBoardState {
  isSetupComplete: boolean;
  teamA: TacticalTeam | null;
  teamB: TacticalTeam | null;
  activeTool: DrawingTool;
  activeColor: string;
  traceModeActive: boolean;
  traces: PlayerTrace[];
  shapes: DrawingShape[];
  offsideLineX: number; // 0-100 % from left (vertical line on horizontal pitch)
  pressingZones: PressingZone[];
  overlays: OverlaySettings;
  past: DrawingShape[][];
  future: DrawingShape[][];
}

export type TacticalBoardAction =
  | { type: 'COMPLETE_SETUP'; teamA: TacticalTeam; teamB: TacticalTeam }
  | { type: 'MOVE_PLAYER'; playerId: string; x: number; y: number }
  | { type: 'CHANGE_FORMATION'; teamId: 'A' | 'B'; formation: Formation }
  | { type: 'SET_TOOL'; tool: DrawingTool }
  | { type: 'SET_COLOR'; color: string }
  | { type: 'TOGGLE_TRACE_MODE' }
  | { type: 'ADD_SHAPE'; shape: DrawingShape }
  | { type: 'UPDATE_SHAPE'; shape: DrawingShape }
  | { type: 'DELETE_SHAPE'; id: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR_DRAWINGS' }
  | { type: 'CLEAR_TRACES' }
  | { type: 'SET_OFFSIDE_LINE'; x: number }
  | { type: 'ADD_PRESSING_ZONE' }
  | { type: 'MOVE_PRESSING_ZONE'; id: string; x: number; y: number }
  | { type: 'REMOVE_PRESSING_ZONE'; id: string }
  | { type: 'TOGGLE_OVERLAY'; overlay: keyof OverlaySettings }
  | { type: 'RESET_POSITIONS' }
  | { type: 'RESET_BOARD' }
  | { type: 'RESET_ANALYSIS' }
  | { type: 'LOCK_TRACE'; playerId: string };
