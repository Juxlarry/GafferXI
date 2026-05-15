import React, { useState, useEffect } from 'react';
import {
  MousePointer2, ArrowUpRight, Circle, Square, RectangleHorizontal, Triangle,
  Undo2, Trash2, Footprints, Minus, Target, AlignJustify, GitBranch,
  RotateCcw, Tag, Star, Diamond, Plus, ChevronDown,
} from 'lucide-react';
import type { DrawingTool } from '../../tacticalTypes';
import { useTacticalBoard } from './TacticalBoardContext';
import { FORMATIONS } from '../../constants';

// ─── Custom dashed-line icon ──────────────────────────────────────────────────

const DashedLineIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="12" x2="7" y2="12" />
    <line x1="10" y1="12" x2="14" y2="12" />
    <line x1="17" y1="12" x2="21" y2="12" />
  </svg>
);

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: { tool: DrawingTool; Icon: React.FC<{ className?: string }>; label: string }[] = [
  { tool: 'select',    Icon: MousePointer2,       label: 'Select' },
  { tool: 'arrow',     Icon: ArrowUpRight,         label: 'Arrow' },
  { tool: 'line',      Icon: Minus,                label: 'Line' },
  { tool: 'circle',    Icon: Circle,               label: 'Circle' },
  { tool: 'square',    Icon: Square,               label: 'Square' },
  { tool: 'rectangle', Icon: RectangleHorizontal,  label: 'Rect' },
  { tool: 'triangle',  Icon: Triangle,             label: 'Triangle' },
];

const MORE_TOOLS: { tool: DrawingTool; Icon: React.FC<{ className?: string }>; label: string }[] = [
  { tool: 'dashed-line', Icon: DashedLineIcon, label: 'Dashed' },
  { tool: 'star',        Icon: Star,           label: 'Star' },
  { tool: 'diamond',     Icon: Diamond,        label: 'Diamond' },
  { tool: 'cross',       Icon: Plus,           label: 'Cross' },
];

const QUICK_COLORS = ['#facc15', '#f87171', '#60a5fa', '#34d399', '#f97316', '#ffffff', '#e879f9'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidHex(v: string) {
  return /^#?[0-9a-fA-F]{6}$/.test(v.trim());
}
function toFullHex(v: string) {
  return `#${v.trim().replace(/^#/, '').toLowerCase()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 border-b border-zinc-800">
      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">{title}</p>
      {children}
    </div>
  );
}

function ToggleRow({ label, value, onToggle, Icon }: {
  label: string; value: boolean;
  onToggle: () => void;
  Icon: React.FC<{ className?: string }>;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors text-xs font-semibold
        ${value ? 'bg-emerald-500/15 text-emerald-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      <div className={`w-7 h-3.5 rounded-full relative transition-colors flex-shrink-0 ${value ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
        <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${value ? 'left-3.5' : 'left-0.5'}`} />
      </div>
    </button>
  );
}

function ToolButton({ tool, Icon, label, active, onClick }: {
  tool: DrawingTool; Icon: React.FC<{ className?: string }>; label: string;
  active: boolean; onClick: () => void;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-[9px] font-bold
        ${active
          ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
    >
      <Icon className="w-4 h-4" />
      <span className="leading-tight text-center">{label}</span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Toolbar() {
  const { state, dispatch } = useTacticalBoard();
  const { activeTool, activeColor, traceModeActive, traces, shapes, overlays, past, future, teamA, teamB } = state;

  const [showMore, setShowMore] = useState(false);
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [hexInput, setHexInput] = useState(activeColor);

  // Keep hex input in sync when color changes externally (e.g. swatch clicks)
  useEffect(() => { setHexInput(activeColor); }, [activeColor]);

  const handleHexChange = (v: string) => {
    setHexInput(v);
    if (isValidHex(v)) dispatch({ type: 'SET_COLOR', color: toFullHex(v) });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-zinc-900" style={{ scrollbarWidth: 'thin' }}>

      {/* ── Drawing tools ── */}
      <Section title="Tools">
        <div className="grid grid-cols-3 gap-1">
          {TOOLS.map(({ tool, Icon, label }) => (
            <ToolButton key={tool} tool={tool} Icon={Icon} label={label}
              active={activeTool === tool}
              onClick={() => dispatch({ type: 'SET_TOOL', tool })} />
          ))}
        </div>

        {/* More shapes toggle */}
        <button
          onClick={() => setShowMore(v => !v)}
          className="mt-2 w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] font-bold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <span>More shapes</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${showMore ? 'rotate-180' : ''}`} />
        </button>

        {showMore && (
          <div className="mt-1 grid grid-cols-4 gap-1">
            {MORE_TOOLS.map(({ tool, Icon, label }) => (
              <ToolButton key={tool} tool={tool} Icon={Icon} label={label}
                active={activeTool === tool}
                onClick={() => dispatch({ type: 'SET_TOOL', tool })} />
            ))}
          </div>
        )}
      </Section>

      {/* ── Color picker ── */}
      <Section title="Shape Color">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="relative cursor-pointer flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg border-2 border-zinc-600 shadow-md cursor-pointer hover:border-zinc-400 transition-colors"
              style={{ backgroundColor: activeColor }}
            />
            <input
              type="color"
              value={activeColor}
              onChange={e => dispatch({ type: 'SET_COLOR', color: e.target.value })}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </label>

          {/* Quick-pick swatches */}
          <div className="flex flex-wrap gap-1">
            {QUICK_COLORS.map(c => (
              <button
                key={c}
                title={c}
                onClick={() => dispatch({ type: 'SET_COLOR', color: c })}
                className={`w-5 h-5 rounded border transition-all hover:scale-110
                  ${activeColor === c ? 'border-white scale-110' : 'border-zinc-600'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Custom colour toggle */}
        <button
          onClick={() => setShowCustomColor(v => !v)}
          className="mt-2 w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] font-bold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <span>Custom colour</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${showCustomColor ? 'rotate-180' : ''}`} />
        </button>

        {showCustomColor && (
          <div className="mt-1 p-2 border border-zinc-700 rounded-xl space-y-2">
            {/* Large color swatch */}
            <label className="relative block cursor-pointer">
              <div
                className="w-full h-8 rounded-lg border border-zinc-600 cursor-pointer"
                style={{ backgroundColor: activeColor }}
              />
              <input
                type="color"
                value={activeColor}
                onChange={e => dispatch({ type: 'SET_COLOR', color: e.target.value })}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
            </label>

            {/* Hex text input */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-500 font-bold flex-shrink-0">Hex</span>
              <input
                type="text"
                value={hexInput}
                onChange={e => handleHexChange(e.target.value)}
                placeholder="#facc15"
                maxLength={7}
                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] font-mono rounded-lg px-2 py-1 focus:outline-none focus:border-zinc-500"
              />
              <div
                className="w-5 h-5 rounded border border-zinc-600 flex-shrink-0"
                style={{ backgroundColor: isValidHex(hexInput) ? toFullHex(hexInput) : activeColor }}
              />
            </div>
          </div>
        )}
      </Section>

      {/* ── Trace mode ── */}
      <Section title="Movement Trace">
        <button
          onClick={() => dispatch({ type: 'TOGGLE_TRACE_MODE' })}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all
            ${traceModeActive
              ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
        >
          <Footprints className="w-4 h-4 flex-shrink-0" />
          <span>{traceModeActive ? 'Tracing Active' : 'Activate Trace'}</span>
          {traceModeActive && (
            <span className="ml-auto flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
        </button>
        {traces.length > 0 && (
          <button
            onClick={() => dispatch({ type: 'CLEAR_TRACES' })}
            className="mt-1 w-full text-xs text-zinc-500 hover:text-red-400 transition-colors py-1 text-left px-1"
          >
            Clear {traces.length} trace{traces.length > 1 ? 's' : ''}
          </button>
        )}
      </Section>

      {/* ── Drawing actions ── */}
      <Section title="Drawings">
        <div className="flex gap-1">
          <button
            disabled={!past.length}
            onClick={() => dispatch({ type: 'UNDO' })}
            title="Undo"
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all
              disabled:opacity-30 disabled:cursor-not-allowed bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:hover:bg-zinc-800 disabled:hover:text-zinc-300"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
          <button
            disabled={!future.length}
            onClick={() => dispatch({ type: 'REDO' })}
            title="Redo"
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all
              disabled:opacity-30 disabled:cursor-not-allowed bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:hover:bg-zinc-800 disabled:hover:text-zinc-300"
          >
            <Undo2 className="w-3.5 h-3.5 scale-x-[-1]" />
            <span>Redo</span>
          </button>
        </div>
        {shapes.length > 0 && (
          <button
            onClick={() => dispatch({ type: 'CLEAR_DRAWINGS' })}
            className="mt-1 w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:bg-red-500/15 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear {shapes.length} shape{shapes.length > 1 ? 's' : ''}</span>
          </button>
        )}
      </Section>

      {/* ── Overlays ── */}
      <Section title="Overlays">
        <div className="space-y-0.5">
          <ToggleRow label="Formation Lines" value={overlays.showFormationLines} Icon={GitBranch}
            onToggle={() => dispatch({ type: 'TOGGLE_OVERLAY', overlay: 'showFormationLines' })} />
          <ToggleRow label="Offside Line" value={overlays.showOffsideLine} Icon={Minus}
            onToggle={() => dispatch({ type: 'TOGGLE_OVERLAY', overlay: 'showOffsideLine' })} />
          <ToggleRow label="Pitch Thirds" value={overlays.showPitchThirds} Icon={AlignJustify}
            onToggle={() => dispatch({ type: 'TOGGLE_OVERLAY', overlay: 'showPitchThirds' })} />
          <ToggleRow label="Player Labels" value={overlays.showPlayerLabels} Icon={Tag}
            onToggle={() => dispatch({ type: 'TOGGLE_OVERLAY', overlay: 'showPlayerLabels' })} />
          <div>
            <ToggleRow label="Pressing Zones" value={overlays.showPressingZones} Icon={Target}
              onToggle={() => dispatch({ type: 'TOGGLE_OVERLAY', overlay: 'showPressingZones' })} />
            {overlays.showPressingZones && (
              <button
                onClick={() => dispatch({ type: 'ADD_PRESSING_ZONE' })}
                className="mt-0.5 w-full text-xs text-zinc-500 hover:text-yellow-400 transition-colors py-1 text-left px-1"
              >
                + Add pressing zone
              </button>
            )}
          </div>
        </div>
      </Section>

      {/* ── Formation selectors ── */}
      {(teamA || teamB) && (
        <Section title="Change Formation">
          <div className="space-y-2">
            {teamA && (
              <div>
                <p className="text-[9px] font-bold mb-1 truncate" style={{ color: teamA.color }}>
                  {teamA.name}
                </p>
                <select
                  value={teamA.formation.name}
                  onChange={e => {
                    const f = FORMATIONS.find(f => f.name === e.target.value);
                    if (f) dispatch({ type: 'CHANGE_FORMATION', teamId: 'A', formation: f });
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-zinc-500"
                >
                  {FORMATIONS.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                </select>
              </div>
            )}
            {teamB && (
              <div>
                <p className="text-[9px] font-bold mb-1 truncate" style={{ color: teamB.color }}>
                  {teamB.name}
                </p>
                <select
                  value={teamB.formation.name}
                  onChange={e => {
                    const f = FORMATIONS.find(f => f.name === e.target.value);
                    if (f) dispatch({ type: 'CHANGE_FORMATION', teamId: 'B', formation: f });
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-zinc-500"
                >
                  {FORMATIONS.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Reset ── */}
      <div className="px-3 py-3 mt-auto">
        <button
          onClick={() => dispatch({ type: 'RESET_POSITIONS' })}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Positions
        </button>
      </div>
    </div>
  );
}
