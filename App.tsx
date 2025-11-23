import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { useGameEngine } from './hooks/useGameEngine';
import { AntType, LogEntry } from './types';
import { COSTS, DAY_LENGTH } from './constants';
import { getQueenAdvice, generateRandomEncounter } from './services/geminiService';
import { Activity, Zap, Shield, Hammer, MapPin, Bug, MessageCircle, Crown, Info, Package, Heart, Sun, Moon, Star, Sword, Play, FastForward, Skull, Flame } from 'lucide-react';

const App: React.FC = () => {
  const { gameStateRef, spawnAnt, interactCell, spawnEnemy, addResources, tick } = useGameEngine();
  
  // UI State
  const [selectedTool, setSelectedTool] = useState<string>('dig');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [queenMessage, setQueenMessage] = useState<string>("Grow my empire. Consume everything.");
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [gameSpeed, setGameSpeed] = useState(1);
  const [autoBreed, setAutoBreed] = useState(false);

  const resources = gameStateRef.current.resources;
  const time = gameStateRef.current.time;
  const isNight = time > 1300 || time < 500;
  
  // Sync state to ref
  useEffect(() => {
    gameStateRef.current.gameSpeed = gameSpeed;
    gameStateRef.current.autoBreed = autoBreed;
  }, [gameSpeed, autoBreed]);

  const addLog = (msg: string, type: 'info' | 'alert' | 'success' | 'ai') => {
    setLogs(prev => [{ id: Date.now().toString(), message: msg, type, timestamp: Date.now() }, ...prev].slice(0, 10));
  };

  const handleConsultQueen = async () => {
    setIsLoadingAi(true);
    addLog("Consulting the Queen...", "info");
    const advice = await getQueenAdvice(resources, logs[0]?.message || "Quiet colony.");
    setQueenMessage(advice);
    addLog("The Queen has spoken.", "ai");
    setIsLoadingAi(false);
  };

  const handleExplore = async () => {
    setIsLoadingAi(true);
    const encounter = await generateRandomEncounter();
    addLog(`Exploration Report: ${encounter.title}`, "info");
    if (encounter.reward.toLowerCase().includes("food")) addResources(50, 0);
    if (encounter.reward.toLowerCase().includes("material")) addResources(0, 50);
    if (encounter.reward.toLowerCase().includes("ant")) spawnAnt(AntType.WORKER);
    
    setQueenMessage(`Exploration Report: ${encounter.description} (${encounter.reward})`);
    setIsLoadingAi(false);
  };

  const ToolButton = ({ tool, icon: Icon, label, cost }: { tool: string, icon: any, label: string, cost?: string }) => (
    <button
      onClick={() => setSelectedTool(tool)}
      className={`p-2 rounded-lg flex flex-col items-center justify-center transition-all border ${
        selectedTool === tool 
          ? 'bg-amber-600 border-amber-500 text-white shadow-lg' 
          : 'bg-stone-800 border-stone-700 text-stone-400 hover:bg-stone-700'
      }`}
    >
      <Icon size={20} />
      <span className="text-[10px] mt-1 font-bold uppercase">{label}</span>
      {cost && <span className="text-[9px] text-stone-500">{cost}</span>}
    </button>
  );

  return (
    <div className="h-screen w-screen bg-stone-950 text-stone-200 font-sans flex flex-col overflow-hidden">
      
      {/* TOP BAR: HUD */}
      <div className="h-14 bg-stone-900 border-b border-stone-800 flex items-center justify-between px-4 z-20 shadow-md">
        <div className="flex items-center gap-4">
             <div className="text-amber-500 font-black text-xl flex items-center gap-2">
                <Crown size={20} /> EMPIRE
             </div>
             {/* Time Widget */}
             <div className="flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full border border-stone-800 text-sm">
                {isNight ? <Moon size={14} className="text-blue-300" /> : <Sun size={14} className="text-yellow-400" />}
                <span className="w-12 text-center text-xs font-mono text-stone-400">
                    {Math.floor((time / DAY_LENGTH) * 24).toString().padStart(2, '0')}h
                </span>
             </div>
             
             {/* Speed Control */}
             <div className="flex items-center gap-1 bg-stone-800 rounded p-1">
                 <button onClick={() => setGameSpeed(1)} className={`p-1 rounded ${gameSpeed === 1 ? 'bg-amber-600 text-white' : 'text-stone-400'}`}><Play size={12}/></button>
                 <button onClick={() => setGameSpeed(2)} className={`p-1 rounded ${gameSpeed === 2 ? 'bg-amber-600 text-white' : 'text-stone-400'}`}><FastForward size={12}/></button>
                 <button onClick={() => setGameSpeed(4)} className={`p-1 rounded ${gameSpeed === 4 ? 'bg-amber-600 text-white' : 'text-stone-400'}`}><Flame size={12}/></button>
             </div>
        </div>

        <div className="flex gap-4">
            <div className="bg-stone-800 px-3 py-1 rounded border border-stone-700 flex items-center gap-2">
                <Skull size={14} className="text-red-500" />
                <div className="flex flex-col items-center leading-none">
                    <span className="text-[10px] text-stone-500 uppercase">Threat</span>
                    <div className="w-16 h-1.5 bg-stone-900 rounded-full mt-0.5 overflow-hidden">
                        <div className="h-full bg-red-600" style={{ width: `${gameStateRef.current.threatLevel}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="bg-stone-800 px-4 py-1 rounded border border-stone-700 flex items-center gap-3">
                <div className="flex flex-col items-center leading-none">
                    <span className="text-xs text-stone-500 uppercase">Score</span>
                    <span className="font-bold text-cyan-400 flex items-center gap-1"><Star size={12}/> {Math.floor(resources.score)}</span>
                </div>
            </div>
            <div className="bg-stone-800 px-4 py-1 rounded border border-stone-700 flex items-center gap-3">
                <div className="flex flex-col items-center leading-none">
                    <span className="text-xs text-stone-500 uppercase">Food</span>
                    <span className="font-bold text-green-400">{Math.floor(resources.food)} <span className="text-stone-600 text-xs">/ {resources.maxFood}</span></span>
                </div>
            </div>
            <div className="bg-stone-800 px-4 py-1 rounded border border-stone-700 flex items-center gap-3">
                <div className="flex flex-col items-center leading-none">
                    <span className="text-xs text-stone-500 uppercase">Army</span>
                    <span className="font-bold text-purple-400">{resources.population}</span>
                </div>
            </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL: Tools */}
        <div className="w-64 bg-stone-900 border-r border-stone-800 flex flex-col z-10 shadow-xl overflow-y-auto">
            
            <div className="p-4 border-b border-stone-800">
                <h3 className="text-[10px] font-bold text-stone-500 uppercase mb-2 tracking-wider">War Commands</h3>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <ToolButton tool="rally" icon={MapPin} label="Rally Point" />
                    <ToolButton tool="warcry" icon={Sword} label="War Cry" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <ToolButton tool="dig" icon={Hammer} label="Dig" />
                    <ToolButton tool="build_food" icon={Zap} label="Bait" />
                </div>
            </div>

            <div className="p-4 border-b border-stone-800">
                <h3 className="text-[10px] font-bold text-stone-500 uppercase mb-2 tracking-wider">Construction</h3>
                <div className="grid grid-cols-2 gap-2">
                    <ToolButton tool="build_storage" icon={Package} label="Storage" cost={`${COSTS.BUILD_STORAGE.materials} Mat`} />
                    <ToolButton tool="build_nursery" icon={Heart} label="Nursery" cost={`${COSTS.BUILD_NURSERY.materials} Mat`} />
                    <ToolButton tool="build_defense" icon={Shield} label="Bunker" cost={`${COSTS.BUILD_DEFENSE.materials} Mat`} />
                </div>
            </div>

            <div className="p-4 border-b border-stone-800">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Hatchery</h3>
                    <button 
                        onClick={() => setAutoBreed(!autoBreed)}
                        className={`text-[10px] px-2 py-0.5 rounded border ${autoBreed ? 'bg-green-900 border-green-700 text-green-300' : 'bg-stone-800 border-stone-700 text-stone-400'}`}
                    >
                        Auto: {autoBreed ? 'ON' : 'OFF'}
                    </button>
                </div>

                <div className="space-y-2">
                    <button 
                        onClick={() => spawnAnt(AntType.WORKER)}
                        disabled={resources.food < COSTS.WORKER.food}
                        className="w-full flex justify-between items-center p-2 bg-stone-800 hover:bg-stone-700 rounded border border-stone-700 disabled:opacity-50"
                    >
                        <div className="flex items-center gap-2">
                            <Bug size={16} className="text-amber-200" />
                            <span className="text-sm font-bold">Worker</span>
                        </div>
                        <span className="text-xs text-green-500">{COSTS.WORKER.food} F</span>
                    </button>
                    <button 
                        onClick={() => spawnAnt(AntType.SOLDIER)}
                        disabled={resources.food < COSTS.SOLDIER.food}
                        className="w-full flex justify-between items-center p-2 bg-stone-800 hover:bg-stone-700 rounded border border-stone-700 disabled:opacity-50"
                    >
                        <div className="flex items-center gap-2">
                            <Shield size={16} className="text-red-400" />
                            <span className="text-sm font-bold">Soldier</span>
                        </div>
                        <span className="text-xs text-green-500">{COSTS.SOLDIER.food} F</span>
                    </button>
                     <button 
                        onClick={() => spawnAnt(AntType.SUPER_SOLDIER)}
                        disabled={resources.food < COSTS.SUPER_SOLDIER.food}
                        className="w-full flex justify-between items-center p-2 bg-stone-800 hover:bg-stone-700 rounded border border-stone-700 disabled:opacity-50 border-red-900/50 bg-red-900/10"
                    >
                        <div className="flex items-center gap-2">
                            <Sword size={16} className="text-red-600" />
                            <span className="text-sm font-bold text-red-200">Super Soldier</span>
                        </div>
                        <span className="text-xs text-green-500">{COSTS.SUPER_SOLDIER.food} F</span>
                    </button>
                </div>
            </div>

            <div className="p-4 mt-auto">
                 <button 
                    onClick={() => {
                        spawnEnemy();
                        addLog("You provoked the hive!", "alert");
                    }}
                    className="w-full py-3 border border-red-900 bg-red-900/10 text-red-500 hover:bg-red-900/30 rounded text-xs uppercase tracking-widest font-bold transition-colors mb-2"
                >
                    ⚠️ Summon Wave
                </button>
            </div>
        </div>

        {/* CENTER: Game View */}
        <div className="flex-1 relative bg-black overflow-hidden">
            {/* Overlay UI */}
            <div className="absolute top-4 right-4 z-10 w-80 space-y-2 pointer-events-none">
                {/* Queen's Message */}
                <div className="bg-purple-900/80 backdrop-blur p-3 rounded border border-purple-500/30 pointer-events-auto">
                     <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-purple-200 text-xs font-bold uppercase">
                             <Crown size={12} /> Her Majesty
                        </div>
                        <div className="flex gap-1">
                            <button onClick={handleConsultQueen} disabled={isLoadingAi} className="p-1 hover:bg-purple-700 rounded">
                                {isLoadingAi ? <Activity size={12} className="animate-spin" /> : <MessageCircle size={12} />}
                            </button>
                            <button onClick={handleExplore} disabled={isLoadingAi} className="p-1 hover:bg-purple-700 rounded">
                                <MapPin size={12} />
                            </button>
                        </div>
                     </div>
                     <p className="text-sm text-purple-100 italic">"{queenMessage}"</p>
                </div>

                {/* Logs */}
                <div className="max-h-48 overflow-y-auto flex flex-col items-end gap-1">
                     {logs.map(log => (
                        <div key={log.id} className={`
                            px-3 py-1 rounded text-xs font-medium shadow-sm backdrop-blur-sm
                            ${log.type === 'alert' ? 'bg-red-900/80 text-red-100' : 
                              log.type === 'success' ? 'bg-green-900/80 text-green-100' : 
                              log.type === 'ai' ? 'bg-purple-900/80 text-purple-100' : 
                              'bg-stone-800/80 text-stone-300'}
                        `}>
                            {log.message}
                        </div>
                    ))}
                </div>
            </div>

            <GameCanvas 
                worldState={gameStateRef} 
                onCellClick={(x, y) => interactCell(x, y, selectedTool)}
                selectedTool={selectedTool}
             />
        </div>
      </div>
    </div>
  );
};

export default App;