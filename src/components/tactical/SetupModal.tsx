import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronLeft, Search, X } from 'lucide-react';
import { GHANA_PLAYERS, FORMATIONS } from '../../constants';
import type { Formation, Player, Position } from '../../types';
import type { TacticalTeam, TacticalPlayer } from '../../tacticalTypes';
import { mapToHorizontal } from './TacticalBoardContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SetupPlayer {
  positionId: string;
  positionType: Position;
  positionLabel: string;
  name: string;
  number: number;
  ghanaPlayer?: Player;
}

interface SetupTeam {
  name: string;
  color: string;
  formation: Formation;
  useGhanaPool: boolean;
  players: SetupPlayer[];
}

function makeSetupPlayers(formation: Formation, existing: SetupPlayer[] = []): SetupPlayer[] {
  return formation.positions.map((pos, i) => {
    const prev = existing.find(p => p.positionId === pos.id)
      ?? existing.find(p => p.positionType === pos.type && !existing.some(e => e.positionId !== p.positionId && formation.positions.some(fp => fp.id === e.positionId && fp.type === pos.type)));
    return {
      positionId: pos.id,
      positionType: pos.type,
      positionLabel: pos.label,
      name: prev?.name ?? '',
      number: prev?.number ?? i + 1,
      ghanaPlayer: prev?.ghanaPlayer,
    };
  });
}

function buildTacticalTeam(setup: SetupTeam, teamId: 'A' | 'B'): TacticalTeam {
  const players: TacticalPlayer[] = setup.formation.positions.map((pos, i) => {
    const sp = setup.players.find(p => p.positionId === pos.id)!;
    const { x, y } = mapToHorizontal(pos, teamId);
    return {
      id: `${teamId}-${pos.id}`,
      teamId,
      name: sp.name.trim() || pos.label,
      number: sp.number || i + 1,
      positionLabel: pos.type,
      x, y,
      originX: x,
      originY: y,
    };
  });

  return {
    id: teamId,
    name: setup.name.trim() || (teamId === 'A' ? 'Team A' : 'Team B'),
    color: setup.color,
    formation: setup.formation,
    players,
  };
}

// ─── Ghana player picker ──────────────────────────────────────────────────────

function GhanaPlayerPicker({
  posType, selected, onSelect,
}: { posType: Position; selected?: Player; onSelect: (p: Player | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [btnRect, setBtnRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const pos = posType;
    const GK = pos === 'GK';
    const DEF: Position[] = ['CB', 'LB', 'RB', 'LWB', 'RWB'];
    const MID: Position[] = ['CM', 'CAM', 'CDM', 'LM', 'RM'];
    const FWD: Position[] = ['LW', 'RW', 'ST', 'CF'];
    return GHANA_PLAYERS.filter(p => {
      const matchPos = GK ? p.position === 'GK'
        : DEF.includes(pos) ? DEF.includes(p.position)
        : MID.includes(pos) ? MID.includes(p.position)
        : FWD.includes(pos) ? FWD.includes(p.position)
        : true;
      return matchPos && p.name.toLowerCase().includes(search.toLowerCase());
    });
  }, [posType, search]);

  const openDropdown = () => {
    if (btnRef.current) setBtnRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  };

  const close = () => { setOpen(false); setSearch(''); };

  // Close on outside mousedown
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on scroll anywhere (captures modal body scroll)
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open]);

  const dropdown = open && btnRect ? createPortal(
    <div
      ref={dropRef}
      className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
      style={{ position: 'fixed', top: btnRect.bottom + 4, left: btnRect.left, width: btnRect.width, zIndex: 9999 }}
    >
      <div className="p-2 border-b border-zinc-800">
        <input
          autoFocus
          type="text"
          placeholder="Search player…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-600"
        />
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
        {filtered.map(p => (
          <button
            key={p.id}
            type="button"
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 text-zinc-200 transition-colors flex items-center gap-2"
            onClick={() => { onSelect(p); close(); }}
          >
            <span className="text-zinc-400 text-[9px] uppercase font-bold w-7 flex-shrink-0">{p.position}</span>
            <span className="flex-1 truncate">{p.name}</span>
            <span className="text-zinc-500 text-[9px] truncate max-w-[80px]">{p.club}</span>
          </button>
        ))}
        {!filtered.length && <p className="px-3 py-2 text-xs text-zinc-500">No players found</p>}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative flex-1">
      <button
        ref={btnRef}
        type="button"
        onClick={() => open ? close() : openDropdown()}
        className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg text-xs border transition-colors
          ${selected ? 'border-emerald-600/50 bg-emerald-950/40 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500'}`}
      >
        <span className="truncate">{selected?.name ?? 'Select player…'}</span>
        {selected
          ? <X className="w-3 h-3 flex-shrink-0 text-zinc-500 hover:text-red-400" onClick={e => { e.stopPropagation(); onSelect(undefined); }} />
          : <Search className="w-3 h-3 flex-shrink-0" />
        }
      </button>
      {dropdown}
    </div>
  );
}

// ─── Player row ───────────────────────────────────────────────────────────────

function PlayerRow({
  sp, useGhanaPool, onChange,
}: {
  sp: SetupPlayer;
  useGhanaPool: boolean;
  onChange: (updated: Partial<SetupPlayer>) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-zinc-800/60 last:border-0">
      <div className="w-8 text-center text-[9px] font-black uppercase tracking-widest text-zinc-400 flex-shrink-0">
        {sp.positionLabel}
      </div>

      {useGhanaPool ? (
        <GhanaPlayerPicker
          posType={sp.positionType}
          selected={sp.ghanaPlayer}
          onSelect={p => onChange({ ghanaPlayer: p, name: p?.name ?? '' })}
        />
      ) : (
        <input
          type="text"
          placeholder={`${sp.positionLabel} name`}
          value={sp.name}
          onChange={e => onChange({ name: e.target.value })}
          className="flex-1 bg-zinc-800 border border-zinc-700 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
        />
      )}

      <input
        type="number"
        min={1}
        max={99}
        value={sp.number}
        onChange={e => onChange({ number: parseInt(e.target.value) || 1 })}
        className="w-12 bg-zinc-800 border border-zinc-700 text-xs text-white text-center rounded-lg py-1.5 focus:outline-none focus:border-zinc-500"
      />
    </div>
  );
}

// ─── Team setup step ──────────────────────────────────────────────────────────

function TeamStep({
  setup, onChange, isTeamA,
}: {
  setup: SetupTeam;
  onChange: (t: SetupTeam) => void;
  isTeamA: boolean;
}) {
  const handleFormationChange = (formationName: string) => {
    const f = FORMATIONS.find(f => f.name === formationName);
    if (!f) return;
    onChange({ ...setup, formation: f, players: makeSetupPlayers(f, setup.players) });
  };

  const handlePlayerChange = (posId: string, partial: Partial<SetupPlayer>) => {
    onChange({
      ...setup,
      players: setup.players.map(p => p.positionId === posId ? { ...p, ...partial } : p),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Team name + color */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">
            {isTeamA ? 'Team A Name' : 'Team B Name'}
          </label>
          <input
            type="text"
            placeholder={isTeamA ? 'e.g. Ghana' : 'e.g. Opponent'}
            value={setup.name}
            onChange={e => onChange({ ...setup, name: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Kit</label>
          <label className="relative cursor-pointer block">
            <div
              className="w-10 h-10 rounded-xl border-2 border-zinc-600 shadow"
              style={{ backgroundColor: setup.color }}
            />
            <input
              type="color"
              value={setup.color}
              onChange={e => onChange({ ...setup, color: e.target.value })}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Formation + Ghana pool toggle (Team A only) */}
      <div className={`flex gap-3 ${isTeamA ? 'items-end' : ''}`}>
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Formation</label>
          <select
            value={setup.formation.name}
            onChange={e => handleFormationChange(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-zinc-500"
          >
            {FORMATIONS.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
        </div>
        {isTeamA && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">Player Source</label>
            <div className="flex gap-1">
              {(['Ghana Pool', 'Manual'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange({ ...setup, useGhanaPool: mode === 'Ghana Pool' })}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors
                    ${(mode === 'Ghana Pool') === setup.useGhanaPool
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Player rows */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex-1">Position</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 w-8 text-center">#</span>
        </div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden px-2">
          {setup.players.map(sp => (
            <PlayerRow
              key={sp.positionId}
              sp={sp}
              useGhanaPool={isTeamA && setup.useGhanaPool}
              onChange={partial => handlePlayerChange(sp.positionId, partial)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  onComplete: (teamA: TacticalTeam, teamB: TacticalTeam) => void;
}

export default function SetupModal({ onComplete }: Props) {
  const defaultFormation = FORMATIONS[0];

  const [step, setStep] = useState<1 | 2>(1);

  const [teamA, setTeamA] = useState<SetupTeam>({
    name: 'Ghana',
    color: '#3b82f6',
    formation: defaultFormation,
    useGhanaPool: true,
    players: makeSetupPlayers(defaultFormation),
  });

  const [teamB, setTeamB] = useState<SetupTeam>({
    name: '',
    color: '#ef4444',
    formation: defaultFormation,
    useGhanaPool: false,
    players: makeSetupPlayers(defaultFormation),
  });

  const handleConfirm = () => {
    const a = buildTacticalTeam(teamA, 'A');
    const b = buildTacticalTeam(teamB, 'B');
    onComplete(a, b);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Step indicators */}
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black
                  ${step === s ? 'bg-emerald-500 text-white' : step > s ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-800 text-zinc-500'}`}>
                  {s}
                </div>
                <span className={`text-xs font-bold ${step === s ? 'text-white' : 'text-zinc-600'}`}>
                  {s === 1 ? 'Team A' : 'Team B'}
                </span>
                {s < 2 && <ChevronRight className="w-3 h-3 text-zinc-700" />}
              </div>
            ))}
          </div>
          <h2 className="mt-3 text-xl font-black uppercase tracking-tighter">
            {step === 1 ? 'Set Up Team A' : 'Set Up Team B'}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {step === 1
              ? 'Choose your formation and select or enter players.'
              : 'Enter the opposing team\'s formation and players.'}
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: 'thin' }}>
          {step === 1
            ? <TeamStep setup={teamA} onChange={setTeamA} isTeamA />
            : <TeamStep setup={teamB} onChange={setTeamB} isTeamA={false} />
          }
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex justify-between flex-shrink-0">
          {step === 2 ? (
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />Back
            </button>
          ) : <div />}

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-all shadow-lg shadow-emerald-500/20"
            >
              Next: Team B <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-all shadow-lg shadow-emerald-500/20"
            >
              Start Analysis →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
