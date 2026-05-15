import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, ChevronRight, ChevronLeft, Users, Info, CheckCircle2,
  Flag, Settings2, Plus, User, Zap, Star, BrainCircuit, Loader2,
  Sparkles, Share2, Download, X, LayoutGrid, ChevronUp, Crosshair,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GHANA_PLAYERS, FORMATIONS } from './constants';
import { Player, Formation, Squad, FormationPosition, Position } from './types';
import Pitch from './components/Pitch';
import PlayerJersey from './components/PlayerJersey';
import { formatPlayerName } from './utils/player';

const TacticalBoard = lazy(() => import('./components/tactical/TacticalBoard'));

const MIDFIELD: Position[] = ['CDM', 'CM', 'CAM'];
const ATTACK: Position[]   = ['LW', 'RW', 'ST', 'CF'];
const DEFENSE: Position[]  = ['CB', 'LB', 'RB', 'LWB', 'RWB'];
const WIDE_MID: Position[] = ['LM', 'RM'];

function getPositionPriority(playerPos: Position, slotPos: Position): number {
  if (playerPos === slotPos) return 0;
  if (MIDFIELD.includes(slotPos)) {
    if (MIDFIELD.includes(playerPos)) return 1;
    return 2;
  }
  if (ATTACK.includes(slotPos)) {
    if (ATTACK.includes(playerPos) || playerPos === 'CAM') return 1;
    return 2;
  }
  if (WIDE_MID.includes(slotPos)) {
    if (WIDE_MID.includes(playerPos) || ATTACK.includes(playerPos) || MIDFIELD.includes(playerPos)) return 1;
    return 2;
  }
  if (DEFENSE.includes(slotPos)) {
    if (DEFENSE.includes(playerPos)) return 1;
    return 2;
  }
  return 2;
}

const POSITION_GROUPS: { label: string; positions: Position[] }[] = [
  { label: 'Goalkeeper', positions: ['GK'] },
  { label: 'Defender',   positions: ['CB', 'LB', 'RB'] },
  { label: 'Midfielder', positions: ['CM', 'CAM', 'CDM'] },
  { label: 'Attacker',   positions: ['ST', 'LW', 'RW', 'CF'] },
];

export default function App() {
  const [selectedCountry] = useState('Ghana');
  const [selectedFormation, setSelectedFormation] = useState<Formation>(FORMATIONS[0]);
  const [squad, setSquad] = useState<Squad>({});
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [activePosition, setActivePosition] = useState<FormationPosition | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scoutReport, setScoutReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showAllFormations, setShowAllFormations] = useState(false);
  const [customPlayers, setCustomPlayers] = useState<Player[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlayerPos, setNewPlayerPos] = useState<Position | ''>('');
  const [newPlayerClub, setNewPlayerClub] = useState('');
  const [activeTab, setActiveTab] = useState<'pitch' | 'build' | 'squad' | 'tactical'>('pitch');
  const [sharingCardId, setSharingCardId] = useState<string | null>(null);

  const squadSize = useMemo(() => Object.values(squad).flat().length, [squad]);
  const gkCount = useMemo(
    () => (Object.values(squad).flat() as Player[]).filter(p => p.position === 'GK').length,
    [squad]
  );

  const isValidSquad = useMemo(() => {
    const hasMinGk = gkCount >= 2;
    const hasMaxGk = gkCount <= 3;
    const hasMaxSquad = squadSize <= 26;
    const allPositionsFilled = selectedFormation.positions.every(pos => (squad[pos.id]?.length || 0) >= 1);
    return hasMinGk && hasMaxGk && hasMaxSquad && allPositionsFilled;
  }, [squad, gkCount, squadSize, selectedFormation]);

  const teamStats = useMemo(() => {
    const startingXI: Player[] = [];
    selectedFormation.positions.forEach(pos => {
      if (squad[pos.id]?.[0]) startingXI.push(squad[pos.id][0]);
    });
    if (startingXI.length === 0) return { rating: 0, chemistry: 0 };

    const totalRating = startingXI.reduce((acc, p) => {
      const pAvg = Object.values(p.stats).reduce((a, b) => a + b, 0) / 6;
      return acc + pAvg;
    }, 0);
    const rating = Math.round(totalRating / startingXI.length);

    let chemistryPoints = 0;
    startingXI.forEach(p => {
      const pos = selectedFormation.positions.find(fp => squad[fp.id]?.[0]?.id === p.id);
      if (pos && p.position === pos.type) chemistryPoints += 5;
      if (startingXI.some(other => other.id !== p.id && other.club === p.club)) chemistryPoints += 2;
      if (startingXI.some(other => other.id !== p.id && other.league === p.league)) chemistryPoints += 2;
    });
    const chemistry = Math.min(100, Math.round((chemistryPoints / (startingXI.length * 9)) * 100));
    return { rating, chemistry };
  }, [squad, selectedFormation]);

  const generateScoutReport = async () => {
    setIsAnalyzing(true);
    try {
      const startingXI: Player[] = [];
      selectedFormation.positions.forEach(pos => {
        if (squad[pos.id]?.[0]) startingXI.push(squad[pos.id][0]);
      });
      const squadData = startingXI.map(p => `${p.name} (${p.position}, Club: ${p.club})`).join(', ');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadData, formationName: selectedFormation.name, rating: teamStats.rating, chemistry: teamStats.chemistry }),
      });
      const data = await response.json();
      if (!response.ok) {
        const msg = data?.error ?? `HTTP ${response.status}`;
        setScoutReport(`**Error:** ${msg}`);
        return;
      }
      setScoutReport(data.text || 'Unable to generate report.');
    } catch (error: any) {
      console.error('Scout Report Error:', error);
      setScoutReport(`**Network error:** ${error?.message ?? 'Could not reach server. Check your connection.'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFormationChange = (newFormation: Formation) => {
    setSquad(prevSquad => {
      const allPlrs = Object.values(prevSquad).flat();
      const newSquad: Squad = {};
      const placed = new Set<string>();

      // Pass 1: exact position-type match
      newFormation.positions.forEach(pos => {
        const match = allPlrs.find(p => p.position === pos.type && !placed.has(p.id));
        if (match) { newSquad[pos.id] = [match]; placed.add(match.id); }
        else newSquad[pos.id] = [];
      });

      // Pass 2: fill still-empty slots with closest positional fit from unplaced players
      newFormation.positions.forEach(pos => {
        if (newSquad[pos.id].length > 0) return;
        const unplaced = allPlrs.filter(p => !placed.has(p.id));
        if (unplaced.length === 0) return;
        const best = [...unplaced].sort((a, b) =>
          getPositionPriority(a.position, pos.type) - getPositionPriority(b.position, pos.type)
        )[0];
        newSquad[pos.id] = [best];
        placed.add(best.id);
      });

      // Pass 3: remaining unplaced players go as squad backups
      allPlrs.filter(p => !placed.has(p.id)).forEach(p => {
        const matchPos = newFormation.positions.find(pos => pos.type === p.position)
          ?? [...newFormation.positions].sort((a, b) =>
              getPositionPriority(p.position, a.type) - getPositionPriority(p.position, b.type)
            )[0];
        if (matchPos) newSquad[matchPos.id].push(p);
      });

      return newSquad;
    });
    setSelectedFormation(newFormation);
  };

  const allPlayers = useMemo(() => [...GHANA_PLAYERS, ...customPlayers], [customPlayers]);

  const filteredPlayers = useMemo(() => {
    if (!activePosition) return [];
    return allPlayers.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const isAlreadyInSquad = (Object.values(squad).flat() as Player[]).some(sp => sp.id === p.id);
      return matchesSearch && !isAlreadyInSquad;
    }).sort((a, b) =>
      getPositionPriority(a.position, activePosition.type) - getPositionPriority(b.position, activePosition.type)
    );
  }, [activePosition, searchQuery, squad, allPlayers]);

  const noMatchFound = useMemo(() => {
    if (!searchQuery) return false;
    if (activePosition) return filteredPlayers.length === 0;
    return allPlayers.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0;
  }, [searchQuery, activePosition, filteredPlayers, allPlayers]);

  const handleAddPlayer = (player: Player) => {
    if (!activePosition) return;
    if (squadSize >= 26) { alert('Maximum squad size of 26 reached!'); return; }
    if (player.position === 'GK' && gkCount >= 3) { alert('Maximum of 3 Goalkeepers allowed!'); return; }
    setSquad(prev => ({ ...prev, [activePosition.id]: [...(prev[activePosition.id] || []), player] }));
    setActivePosition(null);
    setSearchQuery('');
  };

  const handleRemovePlayer = (positionId: string, playerId: string) => {
    setSquad(prev => ({ ...prev, [positionId]: prev[positionId].filter(p => p.id !== playerId) }));
    if (selectedPlayer?.id === playerId) setSelectedPlayer(null);
  };

  const handlePromotePlayer = (positionId: string, playerId: string) => {
    setSquad(prev => {
      const players = [...(prev[positionId] || [])];
      const idx = players.findIndex(p => p.id === playerId);
      if (idx <= 0) return prev;
      const [player] = players.splice(idx, 1);
      players.unshift(player);
      return { ...prev, [positionId]: players };
    });
  };

  const handleAddCustomPlayer = () => {
    if (!newPlayerPos || !searchQuery.trim()) return;
    const newPlayer: Player = {
      id: `custom-${Date.now()}`,
      name: searchQuery.trim(),
      position: newPlayerPos,
      club: newPlayerClub.trim() || 'Unknown Club',
      league: 'Custom',
      age: 25,
      image: `https://ui-avatars.com/api/?name=${encodeURIComponent(searchQuery.trim())}&background=10b981&color=fff`,
      stats: { pace: 60, shooting: 60, passing: 60, dribbling: 60, defending: 60, physical: 60 },
    };
    setCustomPlayers(prev => [...prev, newPlayer]);
    if (activePosition) {
      setSquad(prev => ({ ...prev, [activePosition.id]: [...(prev[activePosition.id] || []), newPlayer] }));
      setActivePosition(null);
    } else {
      const matchingPos = selectedFormation.positions.find(pos => pos.type === newPlayerPos);
      if (matchingPos && squadSize < 26 && !(newPlayerPos === 'GK' && gkCount >= 3)) {
        setSquad(prev => ({ ...prev, [matchingPos.id]: [...(prev[matchingPos.id] || []), newPlayer] }));
      }
    }
    setShowAddForm(false);
    setNewPlayerPos('');
    setNewPlayerClub('');
    setSearchQuery('');
  };

  useEffect(() => {
    if (!searchQuery) { setShowAddForm(false); setNewPlayerPos(''); setNewPlayerClub(''); }
  }, [searchQuery]);

  const downloadCard = async (id: string, filename: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(element, { cacheBust: true, pixelRatio: 2, backgroundColor: '#18181b' });
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const shareCard = async (id: string, text: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    setSharingCardId(id);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(element, { cacheBust: true, pixelRatio: 2, backgroundColor: '#18181b' });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'gafferxi-squad.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, title: 'GafferXI — Own The Pitch' });
      } else {
        const link = document.createElement('a');
        link.download = 'gafferxi-squad.png';
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Share failed', err);
      }
    } finally {
      setSharingCardId(null);
    }
  };

  // ─── Reusable: player search list ──────────────────────────────────────────
  const PlayerSearchList = () => (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="relative flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search players..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
        />
      </div>

      {noMatchFound && !showAddForm && (
        <button
          onClick={() => { setShowAddForm(true); if (activePosition) setNewPlayerPos(activePosition.type); }}
          className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-dashed border-emerald-500/50 hover:bg-emerald-500/20 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-emerald-400">Add "{searchQuery}"</p>
            <p className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">Not in pool — add player</p>
          </div>
          <Plus className="w-5 h-5 text-emerald-500" />
        </button>
      )}

      {showAddForm && searchQuery && (
        <div className="p-4 rounded-xl bg-zinc-800/60 border border-zinc-700 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Adding "{searchQuery}"</p>
            <button onClick={() => { setShowAddForm(false); setNewPlayerPos(''); setNewPlayerClub(''); }} className="text-zinc-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {POSITION_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1">
                  {group.positions.map(pos => (
                    <button
                      key={pos}
                      onClick={() => setNewPlayerPos(pos)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all
                        ${newPlayerPos === pos ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-zinc-700 border-zinc-600 text-zinc-400 hover:border-zinc-500'}`}
                    >{pos}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <input
            type="text"
            placeholder="Club name..."
            value={newPlayerClub}
            onChange={e => setNewPlayerClub(e.target.value)}
            className="w-full bg-zinc-700 border border-zinc-600 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          <button
            onClick={handleAddCustomPlayer}
            disabled={!newPlayerPos}
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-black uppercase tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-400 transition-all"
          >
            Add to Pool
          </button>
        </div>
      )}

      <div className="overflow-y-auto space-y-2 custom-scrollbar">
        {(activePosition ? filteredPlayers : allPlayers.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))).map(p => {
          const isNatural = !!(activePosition && p.position === activePosition.type);
          const isAlreadyInSquad = (Object.values(squad).flat() as Player[]).some(sp => sp.id === p.id);
          return (
            <button
              key={p.id}
              disabled={isAlreadyInSquad}
              onClick={() => { if (activePosition) handleAddPlayer(p); else setSelectedPlayer(p); }}
              className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all group relative
                ${isAlreadyInSquad ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800 hover:border-zinc-600 cursor-pointer'}
                ${isNatural ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-zinc-800/30 border border-zinc-700/50'}`}
            >
              <div className="w-10 h-10 flex-shrink-0"><PlayerJersey player={p} size="md" /></div>
              <div className="flex-1 text-left min-w-0">
                <p className={`text-sm font-bold truncate transition-colors ${isNatural ? 'text-emerald-400' : 'group-hover:text-emerald-400'}`}>
                  {formatPlayerName(p.name)}
                </p>
                <p className="text-[10px] text-zinc-500 font-medium truncate">{p.position} • {p.club}</p>
              </div>
              {isNatural && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" />}
              {activePosition && !isAlreadyInSquad && <Plus className="w-4 h-4 text-zinc-600 group-hover:text-emerald-500 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ─── Reusable: squad list ───────────────────────────────────────────────────
  const SquadList = ({ onPlayerClick, isMobile = false }: { onPlayerClick: (p: Player) => void; isMobile?: boolean }) => (
    <div className="space-y-6">
      {selectedFormation.positions.map(pos => {
        const players = squad[pos.id] || [];
        return (
          <div key={pos.id} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{pos.label}</p>
              <button
                onClick={() => { setActivePosition(pos); if (isMobile) setActiveTab('pitch'); }}
                className="text-[10px] text-emerald-500 hover:text-emerald-400 font-bold uppercase flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-1">
              {players.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => onPlayerClick(p)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/30 border border-zinc-700/50 group cursor-pointer hover:bg-zinc-800 hover:border-zinc-600 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 flex-shrink-0"><PlayerJersey player={p} size="sm" /></div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold block truncate">{formatPlayerName(p.name)}</span>
                      {idx === 0 && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Starter</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {idx > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); handlePromotePlayer(pos.id, p.id); }}
                        title="Set as starter"
                        className="text-zinc-500 hover:text-emerald-400 active:text-emerald-400 transition-all p-1"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); handleRemovePlayer(pos.id, p.id); }}
                      className="text-zinc-500 hover:text-red-400 active:text-red-400 lg:opacity-0 lg:group-hover:opacity-100 transition-all p-1 -mr-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {players.length === 0 && (
                <div className="p-3 rounded-xl border border-dashed border-zinc-800 text-center">
                  <span className="text-[10px] text-zinc-600 font-medium italic">No player assigned</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ─── Reusable: player detail ────────────────────────────────────────────────
  const PlayerDetail = ({ player, onBack }: { player: Player; onBack: () => void }) => (
    <div className="flex flex-col h-full">
      <div className="relative h-56 bg-zinc-950 flex items-center justify-center border-b border-zinc-800 overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.1),transparent)]" />
        <PlayerJersey player={player} size="xl" className="mt-4" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-6 right-6">
          <h2 className="text-xl font-black uppercase italic tracking-tighter leading-none">{formatPlayerName(player.name)}</h2>
          <p className="text-emerald-400 font-bold text-sm mt-1">{player.position} • {player.club}</p>
        </div>
        <button onClick={onBack} className="absolute top-4 right-4 w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-black/60 transition-all">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Player Attributes</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(player.stats).map(([key, val]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  <span>{key}</span><span className="text-zinc-100">{val}</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          {[['Age', `${player.age} Years`], ['Nationality', 'Ghanaian'], ['Preferred Foot', 'Right']].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center py-3 border-b border-zinc-800">
              <span className="text-xs font-bold text-zinc-500 uppercase">{label}</span>
              <span className="text-sm font-bold">{value}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );

  // ─── Reusable: formation section ───────────────────────────────────────────
  const FormationSection = () => (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="w-4 h-4 text-emerald-500" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Formation</h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(showAllFormations ? FORMATIONS : FORMATIONS.slice(0, 4)).map(f => (
          <button
            key={f.name}
            onClick={() => handleFormationChange(f)}
            className={`px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 border
              ${selectedFormation.name === f.name
                ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-600'}`}
          >{f.name}</button>
        ))}
      </div>
      {FORMATIONS.length > 4 && (
        <button
          onClick={() => setShowAllFormations(!showAllFormations)}
          className="w-full mt-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-emerald-400 transition-colors flex items-center justify-center gap-1 group"
        >
          {showAllFormations
            ? <><span>Show Less</span><ChevronLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" /></>
            : <><span>Show More</span><ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" /></>}
        </button>
      )}
    </section>
  );

  // ─── Reusable: analyze button ───────────────────────────────────────────────
  const AnalyzeButton = () => (
    <section>
      <button
        onClick={generateScoutReport}
        disabled={isAnalyzing || squadSize < 11}
        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-tighter text-lg transition-all
          ${squadSize < 11
            ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
            : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95'}`}
      >
        {isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <><BrainCircuit className="w-6 h-6" />Analyze Squad</>}
      </button>
      {squadSize < 11 && (
        <p className="text-[10px] text-zinc-500 mt-2 text-center font-bold uppercase tracking-widest">Fill starting XI to unlock analysis</p>
      )}
    </section>
  );

  // ─── Reusable: squad status footer ─────────────────────────────────────────
  const SquadStatus = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
        <span>Squad Status</span>
        {isValidSquad
          ? <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Valid</span>
          : <span className="text-zinc-500">Incomplete</span>}
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${isValidSquad ? 'bg-emerald-500' : 'bg-zinc-600'}`}
          initial={{ width: 0 }}
          animate={{ width: `${(squadSize / 26) * 100}%` }}
        />
      </div>
      {!isValidSquad && (
        <ul className="text-[10px] text-zinc-500 space-y-1 list-disc pl-3">
          {gkCount < 2 && <li>At least 2 Goalkeepers required</li>}
          {squadSize > 26 && <li>Max 26 players allowed</li>}
          {!selectedFormation.positions.every(pos => (squad[pos.id]?.length || 0) >= 1) && <li>All positions must have at least 1 player</li>}
        </ul>
      )}
    </div>
  );

  // ─── Share card content pieces ──────────────────────────────────────────────
  const GhanaFlag = () => (
    <div className="w-5 h-3 relative flex-shrink-0">
      <div className="absolute inset-0 flex flex-col">
        <div className="h-1/3 bg-red-600" />
        <div className="h-1/3 bg-yellow-400 flex items-center justify-center"><div className="w-1 h-1 bg-black rounded-full" /></div>
        <div className="h-1/3 bg-green-600" />
      </div>
    </div>
  );

  const allSquadPlayers = Object.values(squad).flat() as Player[];
  const gkPlayers   = allSquadPlayers.filter(p => p.position === 'GK');
  const defPlayers  = allSquadPlayers.filter(p => ['LB', 'CB', 'RB', 'LWB', 'RWB'].includes(p.position));
  const midPlayers  = allSquadPlayers.filter(p => ['CM', 'CAM', 'CDM', 'LM', 'RM'].includes(p.position));
  const fwdPlayers  = allSquadPlayers.filter(p => ['ST', 'LW', 'RW', 'CF'].includes(p.position));

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  // Full-screen tactical board bypasses the main layout entirely
  if (activeTab === 'tactical') {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <img src="/logo.svg" alt="GafferXI" className="w-56 opacity-80 animate-pulse" />
        </div>
      }>
        <TacticalBoard onBack={() => setActiveTab('pitch')} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">

      {/* ── Header ── */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 lg:px-6 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <img src="/logo-mark.svg" alt="GafferXI" className="h-9 w-auto flex-shrink-0" />
          <div>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight">Gaffer XI</h1>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">World Cup 2026</p>
          </div>
        </div>

        {/* Desktop stats + controls */}
        <div className="hidden lg:flex items-center gap-6">
          <button
            onClick={() => setIsSharing(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20 font-bold text-sm"
          >
            <Share2 className="w-4 h-4" />Share Squad
          </button>
          <button
            onClick={() => setActiveTab('tactical')}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white px-4 py-2 rounded-xl transition-all font-bold text-sm border border-zinc-700"
          >
            <Crosshair className="w-4 h-4" />Tactical Board
          </button>
          <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-full border border-zinc-700">
            <Flag className="w-4 h-4 text-zinc-400" /><span className="text-sm font-semibold">{selectedCountry}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 pr-6 border-r border-zinc-800">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-emerald-400">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="text-lg font-black italic tracking-tighter leading-none">{teamStats.rating}</span>
                </div>
                <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">Rating</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-yellow-400">
                  <Zap className="w-3 h-3 fill-current" />
                  <span className="text-lg font-black italic tracking-tighter leading-none">{teamStats.chemistry}</span>
                </div>
                <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">Chemistry</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Squad Size</span>
              <span className={`text-sm font-mono font-bold ${squadSize > 26 ? 'text-red-400' : 'text-emerald-400'}`}>{squadSize}/26</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">GK</span>
              <span className={`text-sm font-mono font-bold ${gkCount > 3 ? 'text-red-400' : 'text-emerald-400'}`}>{gkCount}/3</span>
            </div>
          </div>
        </div>

        {/* Mobile controls */}
        <div className="lg:hidden flex items-center gap-3">
          <button
            onClick={() => setIsSharing(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20 font-bold text-sm"
          >
            <Share2 className="w-4 h-4" /><span className="hidden sm:inline">Share</span>
          </button>
          <div className="flex items-center gap-1.5 bg-zinc-800/50 px-2.5 py-1.5 rounded-full border border-zinc-700">
            <Flag className="w-3.5 h-3.5 text-zinc-400" /><span className="text-xs font-semibold">{selectedCountry}</span>
          </div>
        </div>
      </header>

      {/* ── Mobile stats strip ── */}
      <div className="lg:hidden border-b border-zinc-800 bg-zinc-900/50 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-emerald-400">
          <Star className="w-3 h-3 fill-current" />
          <span className="text-sm font-black italic leading-none">{teamStats.rating}</span>
          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest ml-0.5">RTG</span>
        </div>
        <div className="flex items-center gap-1 text-yellow-400">
          <Zap className="w-3 h-3 fill-current" />
          <span className="text-sm font-black italic leading-none">{teamStats.chemistry}</span>
          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest ml-0.5">CHM</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-sm font-mono font-bold ${squadSize > 26 ? 'text-red-400' : 'text-emerald-400'}`}>{squadSize}/26</span>
          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">SQD</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-sm font-mono font-bold ${gkCount > 3 ? 'text-red-400' : 'text-emerald-400'}`}>{gkCount}/3</span>
          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">GK</span>
        </div>
      </div>

      {/* ── Desktop main layout (unchanged) ── */}
      <main className="hidden lg:flex h-[calc(100vh-64px)] overflow-hidden">
        {/* Left panel */}
        <aside className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-900/30">
          <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
            <FormationSection />
            <AnalyzeButton />
            <section className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                    {activePosition ? `Select ${activePosition.label}` : 'Player Pool'}
                  </h2>
                </div>
                {activePosition && (
                  <button onClick={() => setActivePosition(null)} className="text-[10px] text-zinc-500 hover:text-white uppercase font-bold">Close</button>
                )}
              </div>
              <PlayerSearchList />
            </section>
          </div>
          <div className="p-6 border-t border-zinc-800 bg-zinc-900/80">
            <SquadStatus />
          </div>
        </aside>

        {/* Center: Pitch */}
        <section className="flex-1 relative bg-zinc-950">
          <Pitch
            formation={selectedFormation}
            squad={squad}
            onPositionClick={setActivePosition}
            onPlayerClick={setSelectedPlayer}
            selectedPlayerId={selectedPlayer?.id}
          />
        </section>

        {/* Right panel */}
        <aside className="w-80 border-l border-zinc-800 bg-zinc-900/30 flex flex-col">
          <AnimatePresence mode="wait">
            {selectedPlayer ? (
              <motion.div key="details" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 50, opacity: 0 }} className="flex-1 flex flex-col overflow-hidden">
                <PlayerDetail player={selectedPlayer} onBack={() => setSelectedPlayer(null)} />
              </motion.div>
            ) : (
              <motion.div key="squad-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col p-6 overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Full Squad List</h2>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  <SquadList onPlayerClick={setSelectedPlayer} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </main>

      {/* ── Mobile main layout ── */}
      <div className="lg:hidden flex flex-col pb-16" style={{ minHeight: 'calc(100svh - 104px)' }}>
        {/* Tab content — pb-16 reserves space for the fixed bottom nav */}
        <div className="flex-1 overflow-hidden" style={{ height: 'calc(100svh - 104px - 64px)' }}>
          {activeTab === 'pitch' && (
            <div className="h-full w-full">
              <Pitch
                formation={selectedFormation}
                squad={squad}
                onPositionClick={pos => { setActivePosition(pos); }}
                onPlayerClick={p => { setSelectedPlayer(p); setActiveTab('squad'); }}
                selectedPlayerId={selectedPlayer?.id}
              />
            </div>
          )}

          {activeTab === 'build' && (
            <div className="h-full overflow-y-auto custom-scrollbar">
              <div className="p-4 space-y-6 pb-6">
                <FormationSection />
                <AnalyzeButton />
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-emerald-500" />
                      <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                        {activePosition ? `Select ${activePosition.label}` : 'Player Pool'}
                      </h2>
                    </div>
                    {activePosition && (
                      <button onClick={() => setActivePosition(null)} className="text-[10px] text-zinc-500 hover:text-white uppercase font-bold">Clear</button>
                    )}
                  </div>
                  <PlayerSearchList />
                </section>
                <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                  <SquadStatus />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'squad' && (
            <div className="h-full overflow-hidden">
              <AnimatePresence mode="wait">
                {selectedPlayer ? (
                  <motion.div key="detail" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} className="h-full overflow-hidden flex flex-col">
                    <PlayerDetail player={selectedPlayer} onBack={() => setSelectedPlayer(null)} />
                  </motion.div>
                ) : (
                  <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto custom-scrollbar">
                    <div className="p-4 pb-6">
                      <div className="flex items-center gap-2 mb-5">
                        <Users className="w-4 h-4 text-emerald-500" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Full Squad List</h2>
                      </div>
                      <SquadList onPlayerClick={setSelectedPlayer} isMobile />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Mobile player bottom sheet */}
        <AnimatePresence>
          {activePosition && activeTab === 'pitch' && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActivePosition(null)}
                className="fixed inset-0 bg-black/50 z-[45]"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="fixed inset-x-0 bottom-16 bg-zinc-900 border-t border-zinc-800 rounded-t-3xl z-[46] flex flex-col"
                style={{ maxHeight: '72vh' }}
              >
                <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                  <div className="w-10 h-1 bg-zinc-700 rounded-full" />
                </div>
                <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-zinc-800">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider">Select {activePosition.label}</p>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Tap a player to add</p>
                  </div>
                  <button onClick={() => setActivePosition(null)} className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
                  <PlayerSearchList />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 z-40 flex">
        {([
          { tab: 'build' as const, icon: Settings2, label: 'Build' },
          { tab: 'pitch' as const, icon: LayoutGrid, label: 'Pitch' },
          { tab: 'squad' as const, icon: Users, label: 'Squad' },
          { tab: 'tactical' as const, icon: Crosshair, label: 'Tactical' },
        ]).map(({ tab, icon: Icon, label }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-1 transition-all
              ${activeTab === tab ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
            {activeTab === tab && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-500 rounded-full" />}
          </button>
        ))}
      </nav>

      {/* ── Scout Report Modal ── */}
      <AnimatePresence>
        {scoutReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setScoutReport(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl mx-2"
            >
              <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="p-6 lg:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                      <Sparkles className="w-5 h-5 lg:w-6 lg:h-6 text-emerald-500" />
                    </div>
                    <div>
                      <h2 className="text-xl lg:text-2xl font-black uppercase italic tracking-tighter">Scout Report</h2>
                      <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Gaffer XI Tactical Analysis</p>
                    </div>
                  </div>
                  <button onClick={() => setScoutReport(null)} className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700 transition-all">
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>
                <div className="prose prose-invert prose-emerald max-w-none max-h-[55vh] overflow-y-auto pr-4 custom-scrollbar">
                  <div className="markdown-body"><ReactMarkdown>{scoutReport}</ReactMarkdown></div>
                </div>
                <div className="mt-6 pt-5 border-t border-zinc-800 flex justify-end">
                  <button onClick={() => setScoutReport(null)} className="px-8 py-3 bg-emerald-500 text-white font-black uppercase tracking-tighter rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20">
                    Dismiss Report
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Share / Download Overlay ── */}
      <AnimatePresence>
        {isSharing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex flex-col"
          >
            {/* Overlay header — not captured */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 py-4 border-b border-zinc-800 bg-zinc-900/80">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">Share Your Squad</h2>
                <p className="text-[11px] text-zinc-500 uppercase font-bold tracking-widest">Download Pitch Card or Full Squad Sheet</p>
              </div>
              <button onClick={() => setIsSharing(false)} className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cards area */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col lg:flex-row gap-6 p-4 lg:p-8 max-w-5xl mx-auto items-start">

                {/* ── Pitch Card ── */}
                <div className="flex-1 w-full flex flex-col gap-3">
                  <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest text-center">Pitch Card</p>
                  <div
                    id="pitch-card"
                    className="w-full bg-[#001f3f] rounded-3xl overflow-hidden"
                    style={{ fontFamily: 'system-ui, sans-serif' }}
                  >
                    <div className="p-6 flex flex-col gap-0" style={{ background: 'linear-gradient(160deg,#001f3f 0%,#00162d 100%)' }}>
                      {/* Card header */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <img src="/logo-mark.svg" alt="GafferXI" className="h-10 w-auto flex-shrink-0" />
                          <div>
                            <h2 className="text-xl font-black text-white italic tracking-tighter leading-none">BUILD THE STARS</h2>
                            <div className="flex items-center gap-2 mt-1">
                              <GhanaFlag />
                              <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">GHANA</span>
                              <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">· FIFA WC 2026</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-0.5">Formation</span>
                          <span className="text-lg font-black text-white italic">{selectedFormation.name}</span>
                        </div>
                      </div>

                      {/* Pitch */}
                      <div style={{ aspectRatio: '2/3' }} className="w-full">
                        <Pitch
                          compact
                          formation={selectedFormation}
                          squad={squad}
                          onPositionClick={() => {}}
                          onPlayerClick={() => {}}
                        />
                      </div>

                      {/* Footer stats */}
                      <div className="mt-4 flex justify-between items-center">
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1.5 bg-zinc-800/60 rounded-lg px-3 py-1.5 border border-zinc-700/50">
                            <Star className="w-3 h-3 text-emerald-400 fill-current" />
                            <span className="text-[11px] font-black text-white">RTG {teamStats.rating}</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-zinc-800/60 rounded-lg px-3 py-1.5 border border-zinc-700/50">
                            <Zap className="w-3 h-3 text-yellow-400 fill-current" />
                            <span className="text-[11px] font-black text-white">CHM {teamStats.chemistry}</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-black text-zinc-600 tracking-[0.25em] uppercase">GAFFERXI</span>
                      </div>
                    </div>
                  </div>
                  {/* Action buttons — outside card div, not captured */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => shareCard('pitch-card', '⚽ Check out my GafferXI squad! Build yours at gafferxi.vercel.app #GafferXI #FootballManager')}
                      disabled={sharingCardId === 'pitch-card'}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white py-3 rounded-2xl font-black uppercase tracking-tighter text-sm shadow-lg shadow-emerald-500/20 transition-all"
                    >
                      {sharingCardId === 'pitch-card' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                      Share
                    </button>
                    <button
                      onClick={() => downloadCard('pitch-card', 'gafferxi-pitch-card.png')}
                      className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-3 rounded-2xl font-black uppercase tracking-tighter text-sm transition-all"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* ── Squad Sheet ── */}
                <div className="flex-1 w-full flex flex-col gap-3">
                  <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest text-center">Squad Sheet</p>
                  <div
                    id="squad-sheet"
                    className="w-full bg-[#00162d] rounded-3xl overflow-hidden"
                    style={{ fontFamily: 'system-ui, sans-serif' }}
                  >
                    <div className="p-6" style={{ background: 'linear-gradient(160deg,#00162d 0%,#000e1f 100%)' }}>
                      {/* Sheet header */}
                      <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/10">
                        <div className="flex items-center gap-3">
                          <img src="/logo-mark.svg" alt="GafferXI" className="h-9 w-auto flex-shrink-0" />
                          <div>
                            <h2 className="text-base font-black text-white uppercase italic tracking-tighter leading-none">Ghana 2026</h2>
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Full Squad · {allSquadPlayers.length} Players</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <GhanaFlag />
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">FIFA WC 2026</span>
                        </div>
                      </div>

                      {/* Position groups */}
                      {[
                        { label: 'Goalkeepers', players: gkPlayers },
                        { label: 'Defenders', players: defPlayers },
                        { label: 'Midfielders', players: midPlayers },
                        { label: 'Forwards', players: fwdPlayers },
                      ].map(({ label, players }) => players.length > 0 && (
                        <div key={label} className="mb-4">
                          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{label}</p>
                            <p className="text-[9px] font-black text-zinc-600 uppercase">{players.length}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {players.map(p => (
                              <div key={p.id} className="flex items-center gap-2">
                                <div className="w-7 h-7 flex-shrink-0"><PlayerJersey player={p} size="sm" /></div>
                                <div className="min-w-0">
                                  <p className="text-[11px] font-black text-white italic uppercase truncate leading-tight">{formatPlayerName(p.name)}</p>
                                  <p className="text-[9px] text-zinc-500 font-medium truncate">{p.club}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {allSquadPlayers.length === 0 && (
                        <div className="py-8 text-center">
                          <p className="text-zinc-600 text-sm font-bold italic">No players selected yet</p>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="mt-2 pt-3 border-t border-white/10 flex justify-between items-center">
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1 bg-zinc-800/60 rounded px-2 py-1">
                            <Star className="w-2.5 h-2.5 text-emerald-400 fill-current" />
                            <span className="text-[9px] font-black text-white">{teamStats.rating}</span>
                          </div>
                          <div className="flex items-center gap-1 bg-zinc-800/60 rounded px-2 py-1">
                            <Zap className="w-2.5 h-2.5 text-yellow-400 fill-current" />
                            <span className="text-[9px] font-black text-white">{teamStats.chemistry}</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-black text-zinc-600 tracking-[0.25em] uppercase">GAFFERXI SQUAD BUILDER</span>
                      </div>
                    </div>
                  </div>
                  {/* Action buttons — outside card div, not captured */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => shareCard('squad-sheet', '⚽ Check out my GafferXI squad! Build yours at gafferxi.vercel.app #GafferXI #FootballManager')}
                      disabled={sharingCardId === 'squad-sheet'}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white py-3 rounded-2xl font-black uppercase tracking-tighter text-sm shadow-lg shadow-emerald-500/20 transition-all"
                    >
                      {sharingCardId === 'squad-sheet' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                      Share
                    </button>
                    <button
                      onClick={() => downloadCard('squad-sheet', 'gafferxi-squad-sheet.png')}
                      className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-3 rounded-2xl font-black uppercase tracking-tighter text-sm transition-all"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>

              {/* Back button */}
              <div className="flex justify-center pb-8">
                <button onClick={() => setIsSharing(false)} className="flex items-center gap-2 text-zinc-500 hover:text-white font-bold text-sm uppercase tracking-wider transition-colors">
                  <ChevronLeft className="w-4 h-4" />Back to Editor
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
      `}</style>
    </div>
  );
}
