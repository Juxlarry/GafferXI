import React, { useRef } from 'react';
import { ArrowLeft, Download, RotateCcw } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { TacticalTeam } from '../../tacticalTypes';
import { TacticalBoardProvider, useTacticalBoard } from './TacticalBoardContext';
import SetupModal from './SetupModal';
import HorizontalPitch from './HorizontalPitch';
import PlayerToken from './PlayerToken';
import TraceLayer from './TraceLayer';
import DrawingCanvas from './DrawingCanvas';
import Toolbar from './Toolbar';
import FormationLines from './overlays/FormationLines';
import OffsideLine from './overlays/OffsideLine';
import PitchThirds from './overlays/PitchThirds';
import PressingZones from './overlays/PressingZones';

// ─── Inner board (has access to context) ─────────────────────────────────────

function BoardInner({ onBack }: { onBack: () => void }) {
  const { state, dispatch, pitchRef } = useTacticalBoard();
  const { isSetupComplete, teamA, teamB, traces, overlays } = state;

  const handleSetupComplete = (a: TacticalTeam, b: TacticalTeam) => {
    dispatch({ type: 'COMPLETE_SETUP', teamA: a, teamB: b });
  };

  const handleExport = async () => {
    const el = pitchRef.current;
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = 'tactical-board.png';
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden">

      {/* ── Header ── */}
      <header className="h-12 flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800 flex-shrink-0 gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <img src="/logo-mark.svg" alt="GafferXI" className="h-6 w-auto" />
          <span>Squad Builder</span>
        </button>

        {/* Team display */}
        {isSetupComplete && teamA && teamB && (
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-tight min-w-0">
            <span className="truncate" style={{ color: teamA.color }}>{teamA.name}</span>
            <span className="text-[10px] text-zinc-600 font-bold flex-shrink-0">{teamA.formation.name}</span>
            <span className="text-zinc-600 mx-0.5 flex-shrink-0">vs</span>
            <span className="text-[10px] text-zinc-600 font-bold flex-shrink-0">{teamB.formation.name}</span>
            <span className="truncate" style={{ color: teamB.color }}>{teamB.name}</span>
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {isSetupComplete && (
            <>
              <button
                onClick={() => dispatch({ type: 'RESET_ANALYSIS' })}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg transition-colors border border-zinc-800 hover:border-amber-500/30"
                title="Reset positions, shapes and traces — keeps team setup"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              <button
                onClick={() => dispatch({ type: 'RESET_BOARD' })}
                className="text-xs font-bold text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                New Setup
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Toolbar (only shown after setup) */}
        {isSetupComplete && (
          <aside className="w-56 flex-shrink-0 border-r border-zinc-800 overflow-hidden flex flex-col">
            <Toolbar />
          </aside>
        )}

        {/* Pitch area */}
        <main className="flex-1 flex items-center justify-center p-4 overflow-hidden bg-zinc-950">
          {isSetupComplete ? (
            /* pitchRef is attached here — child components use it for coordinate conversion */
            <div
              ref={pitchRef}
              className="relative rounded-xl overflow-hidden"
              style={{
                width: '100%',
                aspectRatio: '105 / 68',
                maxWidth: `calc((100vh - 96px) * (105 / 68))`,
              }}
            >
              <HorizontalPitch>
                {/* Pitch overlay layers (bottom → top) */}
                {overlays.showPitchThirds && <PitchThirds />}
                {overlays.showFormationLines && <FormationLines teamA={teamA} teamB={teamB} />}
                {overlays.showOffsideLine && <OffsideLine />}

                {/* Movement traces */}
                <TraceLayer traces={traces} />

                {/* Pressing zones (draggable) */}
                {overlays.showPressingZones && <PressingZones />}

                {/* Team A player tokens */}
                {teamA?.players.map(player => (
                  <PlayerToken
                    key={player.id}
                    player={player}
                    teamColor={teamA.color}
                    teamId="A"
                  />
                ))}

                {/* Team B player tokens */}
                {teamB?.players.map(player => (
                  <PlayerToken
                    key={player.id}
                    player={player}
                    teamColor={teamB.color}
                    teamId="B"
                  />
                ))}

                {/* Drawing canvas (topmost interactive layer) */}
                <DrawingCanvas />
              </HorizontalPitch>
            </div>
          ) : (
            /* Pre-setup placeholder */
            <div className="text-center select-none">
              <div className="w-24 h-24 rounded-full bg-zinc-900 border-2 border-zinc-800 mx-auto mb-4 flex items-center justify-center text-5xl">
                ⚽
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-1">Tactical Board</h2>
              <p className="text-zinc-500 text-sm">Setting up teams…</p>
            </div>
          )}
        </main>
      </div>

      {/* Setup modal (blocks interaction until complete) */}
      {!isSetupComplete && (
        <SetupModal onComplete={handleSetupComplete} />
      )}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function TacticalBoard({ onBack }: Props) {
  const pitchRef = useRef<HTMLDivElement>(null);

  return (
    <TacticalBoardProvider pitchRef={pitchRef}>
      <BoardInner onBack={onBack} />
    </TacticalBoardProvider>
  );
}
