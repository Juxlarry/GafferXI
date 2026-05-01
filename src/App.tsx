import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ChevronRight, 
  ChevronLeft, 
  Users, 
  Info, 
  CheckCircle2, 
  AlertCircle,
  Trophy,
  Flag,
  Settings2,
  Plus,
  User,
  Zap,
  Star,
  BrainCircuit,
  Loader2,
  Sparkles,
  Share2,
  Download,
  X
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { GHANA_PLAYERS, FORMATIONS } from './constants';
import { Player, Formation, Squad, FormationPosition } from './types';
import Pitch from './components/Pitch';
import PlayerJersey from './components/PlayerJersey';
import { formatPlayerName } from './utils/player';

export default function App() {
  const [selectedCountry, setSelectedCountry] = useState('Ghana');
  const [selectedFormation, setSelectedFormation] = useState<Formation>(FORMATIONS[0]);
  const [squad, setSquad] = useState<Squad>({});
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [activePosition, setActivePosition] = useState<FormationPosition | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scoutReport, setScoutReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showAllFormations, setShowAllFormations] = useState(false);

  // Stats calculation
  const squadSize = useMemo(() => Object.values(squad).flat().length, [squad]);
  const gkCount = useMemo(() => {
    return (Object.values(squad).flat() as Player[]).filter(p => p.position === 'GK').length;
  }, [squad]);

  const isValidSquad = useMemo(() => {
    const hasMinGk = gkCount >= 2;
    const hasMaxGk = gkCount <= 3;
    const hasMaxSquad = squadSize <= 26;
    const allPositionsFilled = selectedFormation.positions.every(pos => (squad[pos.id]?.length || 0) >= 1);
    
    return hasMinGk && hasMaxGk && hasMaxSquad && allPositionsFilled;
  }, [squad, gkCount, squadSize, selectedFormation]);

  // Team Rating & Chemistry
  const teamStats = useMemo(() => {
    const startingXI: Player[] = [];
    selectedFormation.positions.forEach(pos => {
      if (squad[pos.id]?.[0]) {
        startingXI.push(squad[pos.id][0]);
      }
    });

    if (startingXI.length === 0) return { rating: 0, chemistry: 0 };

    // Rating: Average of all stats for starting XI
    const totalRating = startingXI.reduce((acc, p) => {
      const pAvg = Object.values(p.stats).reduce((a, b) => a + b, 0) / 6;
      return acc + pAvg;
    }, 0);
    const rating = Math.round(totalRating / startingXI.length);

    // Chemistry: Position (5), Club (2), League (2) per player
    let chemistryPoints = 0;
    startingXI.forEach(p => {
      // Position check
      const pos = selectedFormation.positions.find(fp => squad[fp.id]?.[0]?.id === p.id);
      if (pos && p.position === pos.type) chemistryPoints += 5;

      // Club link
      const hasClubLink = startingXI.some(other => other.id !== p.id && other.club === p.club);
      if (hasClubLink) chemistryPoints += 2;

      // League link
      const hasLeagueLink = startingXI.some(other => other.id !== p.id && other.league === p.league);
      if (hasLeagueLink) chemistryPoints += 2;
    });

    // Max points = 11 * 9 = 99. Normalize to 100.
    const chemistry = Math.min(100, Math.round((chemistryPoints / (startingXI.length * 9)) * 100));

    return { rating, chemistry };
  }, [squad, selectedFormation]);

  const generateScoutReport = async () => {
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const startingXI: Player[] = [];
      selectedFormation.positions.forEach(pos => {
        if (squad[pos.id]?.[0]) {
          startingXI.push(squad[pos.id][0]);
        }
      });

      const squadData = startingXI.map(p => `${p.name} (${p.position}, Club: ${p.club})`).join(', ');
      const prompt = `Analyze this football squad for the 2026 World Cup.
      Formation: ${selectedFormation.name}
      Starting XI: ${squadData}
      Team Rating: ${teamStats.rating}
      Team Chemistry: ${teamStats.chemistry}
      
      Provide a concise 'Scout Report' in Markdown format with:
      1. Tactical Overview (1-2 sentences)
      2. Key Strength
      3. Main Weakness
      4. Recommendation
      
      Keep it professional and encouraging.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setScoutReport(response.text || "Unable to generate report.");
    } catch (error) {
      console.error("Scout Report Error:", error);
      setScoutReport("Error generating report. Please check your connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFormationChange = (newFormation: Formation) => {
    setSquad(prevSquad => {
      const allPlayers = Object.values(prevSquad).flat();
      const newSquad: Squad = {};
      const placedPlayerIds = new Set<string>();

      // 1. Fill Starting XI slots in the new formation
      newFormation.positions.forEach(pos => {
        // Try to find a player who matches this position type and isn't placed yet
        const matchingPlayer = allPlayers.find(p => 
          p.position === pos.type && !placedPlayerIds.has(p.id)
        );

        if (matchingPlayer) {
          newSquad[pos.id] = [matchingPlayer];
          placedPlayerIds.add(matchingPlayer.id);
        } else {
          newSquad[pos.id] = [];
        }
      });

      // 2. Distribute remaining players as backups
      const remainingPlayers = allPlayers.filter(p => !placedPlayerIds.has(p.id));
      remainingPlayers.forEach(p => {
        // Find the first position that matches their type in the new formation
        const matchingPos = newFormation.positions.find(pos => pos.type === p.position);
        if (matchingPos) {
          newSquad[matchingPos.id].push(p);
        } else {
          // Fallback: put in the first position
          const firstPos = newFormation.positions[0];
          newSquad[firstPos.id].push(p);
        }
      });

      return newSquad;
    });
    setSelectedFormation(newFormation);
  };

  // Filtered players for selection
  const filteredPlayers = useMemo(() => {
    if (!activePosition) return [];
    return GHANA_PLAYERS.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const isAlreadyInSquad = (Object.values(squad).flat() as Player[]).some(sp => sp.id === p.id);
      return matchesSearch && !isAlreadyInSquad;
    }).sort((a, b) => {
      // Sort natural positions to the top
      const aIsNatural = a.position === activePosition.type;
      const bIsNatural = b.position === activePosition.type;
      if (aIsNatural && !bIsNatural) return -1;
      if (!aIsNatural && bIsNatural) return 1;
      return 0;
    });
  }, [activePosition, searchQuery, squad]);

  const handleAddPlayer = (player: Player) => {
    if (!activePosition) return;
    if (squadSize >= 26) {
      alert("Maximum squad size of 26 reached!");
      return;
    }
    if (player.position === 'GK' && gkCount >= 3) {
      alert("Maximum of 3 Goalkeepers allowed!");
      return;
    }

    setSquad(prev => ({
      ...prev,
      [activePosition.id]: [...(prev[activePosition.id] || []), player]
    }));
    setActivePosition(null);
    setSearchQuery('');
  };

  const handleRemovePlayer = (positionId: string, playerId: string) => {
    setSquad(prev => ({
      ...prev,
      [positionId]: prev[positionId].filter(p => p.id !== playerId)
    }));
    if (selectedPlayer?.id === playerId) setSelectedPlayer(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Trophy className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">StaffCall</h1>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">World Cup 2026</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={() => setIsSharing(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20 font-bold text-sm"
          >
            <Share2 className="w-4 h-4" />
            Share Squad
          </button>

          <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-full border border-zinc-700">
            <Flag className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-semibold">{selectedCountry}</span>
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
              <span className={`text-sm font-mono font-bold ${squadSize > 26 ? 'text-red-400' : 'text-emerald-400'}`}>
                {squadSize}/26
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">GK</span>
              <span className={`text-sm font-mono font-bold ${gkCount > 3 ? 'text-red-400' : 'text-emerald-400'}`}>
                {gkCount}/3
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* Left Panel: Team Details Box */}
        <aside className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-900/30">
          <div className="p-6 space-y-8 overflow-y-auto flex-1">
            {/* Formation Selection */}
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
                    className={`
                      px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 border
                      ${selectedFormation.name === f.name 
                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20' 
                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-600'}
                    `}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              {FORMATIONS.length > 4 && (
                <button
                  onClick={() => setShowAllFormations(!showAllFormations)}
                  className="w-full mt-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-emerald-400 transition-colors flex items-center justify-center gap-1 group"
                >
                  {showAllFormations ? (
                    <>
                      Show Less <ChevronLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                    </>
                  ) : (
                    <>
                      Show More <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              )}
            </section>

            {/* Scout Report Button */}
            <section>
              <button
                onClick={generateScoutReport}
                disabled={isAnalyzing || squadSize < 11}
                className={`
                  w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-tighter text-lg transition-all
                  ${squadSize < 11 
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' 
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95'}
                `}
              >
                {isAnalyzing ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <BrainCircuit className="w-6 h-6" />
                    Analyze Squad
                  </>
                )}
              </button>
              {squadSize < 11 && (
                <p className="text-[10px] text-zinc-500 mt-2 text-center font-bold uppercase tracking-widest">
                  Fill starting XI to unlock analysis
                </p>
              )}
            </section>

            {/* Team Pool / Search */}
            <section className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                    {activePosition ? `Select ${activePosition.label}` : 'Player Pool'}
                  </h2>
                </div>
                {activePosition && (
                  <button 
                    onClick={() => setActivePosition(null)}
                    className="text-[10px] text-zinc-500 hover:text-white uppercase font-bold"
                  >
                    Close
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 flex-1 min-h-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                  {activePosition && filteredPlayers.length === 0 && searchQuery && (
                    <button
                      onClick={() => {
                        const newPlayer: Player = {
                          id: `custom-${Date.now()}`,
                          name: searchQuery,
                          position: activePosition.type,
                          club: 'Custom Entry',
                          league: 'None',
                          age: 25,
                          image: `https://ui-avatars.com/api/?name=${encodeURIComponent(searchQuery)}&background=10b981&color=fff`,
                          stats: { pace: 60, shooting: 60, passing: 60, dribbling: 60, defending: 60, physical: 60 }
                        };
                        handleAddPlayer(newPlayer);
                      }}
                      className="w-full flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-dashed border-emerald-500/50 hover:bg-emerald-500/20 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <User className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-bold text-emerald-400">Add "{searchQuery}"</p>
                        <p className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">New {activePosition.label} Entry</p>
                      </div>
                      <Plus className="w-5 h-5 text-emerald-500" />
                    </button>
                  )}

                  {(activePosition ? filteredPlayers : GHANA_PLAYERS.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))).map(p => {
                    const isNatural = activePosition && p.position === activePosition.type;
                    const isAlreadyInSquad = (Object.values(squad).flat() as Player[]).some(sp => sp.id === p.id);
                    
                    return (
                      <button
                        key={p.id}
                        disabled={isAlreadyInSquad}
                        onClick={() => {
                          if (activePosition) {
                            handleAddPlayer(p);
                          } else {
                            setSelectedPlayer(p);
                          }
                        }}
                        className={`
                          w-full flex items-center gap-3 p-2 rounded-xl transition-all group relative
                          ${isAlreadyInSquad ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800 hover:border-zinc-600 cursor-pointer'}
                          ${isNatural ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-zinc-800/30 border border-zinc-700/50'}
                        `}
                      >
                        <div className="w-10 h-10">
                          <PlayerJersey player={p} size="md" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`text-sm font-bold transition-colors ${isNatural ? 'text-emerald-400' : 'group-hover:text-emerald-400'}`}>
                            {formatPlayerName(p.name)}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-medium">{p.position} • {p.club}</p>
                        </div>
                        {isNatural && (
                          <div className="absolute top-1 right-1">
                            <div className="bg-emerald-500 w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                          </div>
                        )}
                        {activePosition && !isAlreadyInSquad && <Plus className="w-4 h-4 text-zinc-600 group-hover:text-emerald-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* Validation Footer */}
          <div className="p-6 border-t border-zinc-800 bg-zinc-900/80">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                <span>Squad Status</span>
                {isValidSquad ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Valid
                  </span>
                ) : (
                  <span className="text-zinc-500">Incomplete</span>
                )}
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

        {/* Right Panel: Squad List & Player Details */}
        <aside className="w-80 border-l border-zinc-800 bg-zinc-900/30 flex flex-col">
          <AnimatePresence mode="wait">
            {selectedPlayer ? (
              <motion.div
                key="details"
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 50, opacity: 0 }}
                className="flex-1 flex flex-col"
              >
                <div className="relative h-64 bg-zinc-950 flex items-center justify-center border-b border-zinc-800 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.1),transparent)]" />
                  <PlayerJersey player={selectedPlayer} size="xl" className="mt-4" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-6 right-6">
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none">
                      {formatPlayerName(selectedPlayer.name)}
                    </h2>
                    <p className="text-emerald-400 font-bold text-sm mt-1">{selectedPlayer.position} • {selectedPlayer.club}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedPlayer(null)}
                    className="absolute top-4 right-4 w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-black/60 transition-all"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                  {/* Stats Grid */}
                  <section>
                    <div className="flex items-center gap-2 mb-6">
                      <Info className="w-4 h-4 text-emerald-500" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Player Attributes</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      {Object.entries(selectedPlayer.stats).map(([key, val]) => (
                        <div key={key} className="space-y-2">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            <span>{key}</span>
                            <span className="text-zinc-100">{val}</span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-emerald-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${val}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Bio Info */}
                  <section className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-zinc-800">
                      <span className="text-xs font-bold text-zinc-500 uppercase">Age</span>
                      <span className="text-sm font-bold">{selectedPlayer.age} Years</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-zinc-800">
                      <span className="text-xs font-bold text-zinc-500 uppercase">Nationality</span>
                      <span className="text-sm font-bold">Ghanaian</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-zinc-800">
                      <span className="text-xs font-bold text-zinc-500 uppercase">Preferred Foot</span>
                      <span className="text-sm font-bold">Right</span>
                    </div>
                  </section>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="squad-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col p-6 overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-6">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Full Squad List</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
                  {selectedFormation.positions.map(pos => {
                    const players = squad[pos.id] || [];
                    return (
                      <div key={pos.id} className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            {pos.label}
                          </p>
                          <button 
                            onClick={() => setActivePosition(pos)}
                            className="text-[10px] text-emerald-500 hover:text-emerald-400 font-bold uppercase flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        </div>
                        <div className="space-y-1">
                          {players.map(p => (
                            <div 
                              key={p.id} 
                              onClick={() => setSelectedPlayer(p)}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/30 border border-zinc-700/50 group cursor-pointer hover:bg-zinc-800 hover:border-zinc-600 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8">
                                  <PlayerJersey player={p} size="sm" />
                                </div>
                                <span className="text-xs font-bold">{formatPlayerName(p.name)}</span>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePlayer(pos.id, p.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all"
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                              </button>
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
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </main>
      
      {/* Scout Report Modal */}
      <AnimatePresence>
        {scoutReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setScoutReport(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter">Scout Report</h2>
                      <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">AI Tactical Analysis</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setScoutReport(null)}
                    className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700 transition-all"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="prose prose-invert prose-emerald max-w-none max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                  <div className="markdown-body">
                    <ReactMarkdown>{scoutReport}</ReactMarkdown>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-800 flex justify-end">
                  <button 
                    onClick={() => setScoutReport(null)}
                    className="px-8 py-3 bg-emerald-500 text-white font-black uppercase tracking-tighter rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Dismiss Report
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Squad Card Overlay */}
      <AnimatePresence>
        {isSharing && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-6xl bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(16,185,129,0.1)] my-8"
              id="squad-card"
            >
              <div className="absolute top-6 right-6 z-10 print:hidden">
                <button 
                  onClick={() => setIsSharing(false)}
                  className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-col lg:flex-row min-h-[700px]">
                {/* Left: Pitch (Starting XI) */}
                <div className="w-full lg:w-1/2 bg-[#001f3f] p-8 flex flex-col border-r border-zinc-800 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,185,129,0.05),transparent)]" />
                  
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white p-1 rounded-lg">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/FIFA_logo_without_slogan.svg" alt="FIFA" className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-white italic tracking-tighter leading-none">MY WORLD CUP SQUAD</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-5 h-3 bg-red-600 relative">
                             <div className="absolute inset-0 flex flex-col">
                               <div className="h-1/3 bg-red-600" />
                               <div className="h-1/3 bg-yellow-400 flex items-center justify-center"><div className="w-1 h-1 bg-black rounded-full" /></div>
                               <div className="h-1/3 bg-green-600" />
                             </div>
                          </div>
                          <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">GHANA</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                       <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Total Value</span>
                       <span className="text-xl font-black text-white italic">€212.68M</span>
                    </div>
                  </div>

                  <div className="flex-1 scale-95 origin-center">
                    <Pitch 
                      formation={selectedFormation}
                      squad={squad}
                      onPositionClick={() => {}}
                      onPlayerClick={() => {}}
                    />
                  </div>

                  <div className="mt-8 flex justify-between items-center relative z-10 opacity-50">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-zinc-800 rounded">
                        <span className="text-[10px] font-bold">RATING: {teamStats.rating}</span>
                      </div>
                      <div className="p-2 bg-zinc-800 rounded">
                        <span className="text-[10px] font-bold">CHEM: {teamStats.chemistry}</span>
                      </div>
                    </div>
                    <div className="text-[10px] font-black text-zinc-500 tracking-[0.3em]">STAFFCALL BUILDER</div>
                  </div>
                </div>

                {/* Right: Full Squad List (Transfermarkt Style) */}
                <div className="w-full lg:w-1/2 p-10 bg-[#00162d] flex flex-col overflow-y-auto">
                  <div className="grid grid-cols-1 gap-10">
                    {/* Goalkeepers */}
                    <div className="space-y-4">
                      <div className="pb-2 border-b border-white/10 flex justify-between items-end">
                        <h3 className="text-sm font-black text-white/40 uppercase tracking-[0.2em]">Goalkeepers</h3>
                        <span className="text-[10px] font-black text-zinc-500 uppercase">{Object.values(squad).flat().filter(p => p.position === 'GK').length} Players</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {Object.values(squad).flat().filter(p => p.position === 'GK').map(p => (
                          <div key={p.id} className="flex items-center gap-3">
                            <PlayerJersey player={p} size="sm" />
                            <span className="text-xs font-black text-white italic uppercase">{formatPlayerName(p.name)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Defence */}
                    <div className="space-y-4">
                      <div className="pb-2 border-b border-white/10 flex justify-between items-end">
                        <h3 className="text-sm font-black text-white/40 uppercase tracking-[0.2em]">Defence</h3>
                        <span className="text-[10px] font-black text-zinc-500 uppercase">{Object.values(squad).flat().filter(p => ['LB', 'CB', 'RB', 'LWB', 'RWB'].includes(p.position)).length} Players</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {Object.values(squad).flat().filter(p => ['LB', 'CB', 'RB', 'LWB', 'RWB'].includes(p.position)).map(p => (
                          <div key={p.id} className="flex items-center gap-3">
                            <PlayerJersey player={p} size="sm" />
                            <span className="text-xs font-black text-white italic uppercase">{formatPlayerName(p.name)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Midfielders/Strikers */}
                    <div className="space-y-4">
                      <div className="pb-2 border-b border-white/10 flex justify-between items-end">
                        <h3 className="text-sm font-black text-white/40 uppercase tracking-[0.2em]">Midfielders / Forwards</h3>
                        <span className="text-[10px] font-black text-zinc-500 uppercase">{Object.values(squad).flat().filter(p => !['GK', 'LB', 'CB', 'RB', 'LWB', 'RWB'].includes(p.position)).length} Players</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {Object.values(squad).flat().filter(p => !['GK', 'LB', 'CB', 'RB', 'LWB', 'RWB'].includes(p.position)).map(p => (
                          <div key={p.id} className="flex items-center gap-3">
                            <PlayerJersey player={p} size="sm" />
                            <span className="text-xs font-black text-white italic uppercase">{formatPlayerName(p.name)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-10 flex justify-between items-end">
                    <div className="flex gap-3 print:hidden">
                      <button 
                        onClick={() => setIsSharing(false)}
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-tighter text-sm transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Back to Editor
                      </button>
                      <button 
                        onClick={() => window.print()}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-tighter text-sm shadow-xl shadow-emerald-500/20 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        Download Card
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </div>
  );
}
