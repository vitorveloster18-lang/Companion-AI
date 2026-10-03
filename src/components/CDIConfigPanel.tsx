/**
 * CDIConfigPanel: Comprehensive Cyberpunk Configuration Panel for all 10 CDI cognitive sections:
 * 1. Drives & Decay rates
 * 2. LLM Models (Principal + Fallbacks)
 * 3. CSE (Enabled, Stage, Units, Signal)
 * 4. Peers (State, Message sending)
 * 5. Cognitive Extensions (MCP Servers)
 * 6. Tick Interval & Anti-Spam
 * 7. Core.txt (Identity Editor)
 * 8. Beliefs (View/Add/Remove)
 * 9. Goals (View/Add/Progress/Remove)
 * 10. Pending Proposals (Approve/Reject)
 */

import React, { useState, useEffect } from 'react';
import { CDIConfigManager, CDIConfigState } from '../core/CDIConfigManager';
import {
  Sliders,
  Cpu,
  Brain,
  Users,
  Layers,
  Clock,
  Shield,
  FileCode,
  Sparkles,
  Target,
  FileCheck,
  Send,
  Plus,
  Trash2,
  Check,
  X,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface CDIConfigPanelProps {
  configManager: CDIConfigManager;
  agentName?: string;
}

type SubSection =
  | 'drives'
  | 'models'
  | 'cse'
  | 'peers'
  | 'extensions'
  | 'ticks'
  | 'identity'
  | 'beliefs'
  | 'goals'
  | 'proposals';

export const CDIConfigPanel: React.FC<CDIConfigPanelProps> = ({
  configManager,
  agentName = 'Kairós',
}) => {
  const [config, setConfig] = useState<CDIConfigState>(configManager.getState());
  const [activeSection, setActiveSection] = useState<SubSection>('drives');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form states
  const [coreTxtBuffer, setCoreTxtBuffer] = useState<string>(config.core_txt);
  const [coreSaved, setCoreSaved] = useState<boolean>(false);

  // Peer message form
  const [selectedPeer, setSelectedPeer] = useState<string>(config.peers.online[0] || 'Naia');
  const [peerMessageText, setPeerMessageText] = useState<string>('');
  const [peerSentSuccess, setPeerSentSuccess] = useState<boolean>(false);

  // New Belief form
  const [newBeliefStatement, setNewBeliefStatement] = useState<string>('');
  const [newBeliefConfidence, setNewBeliefConfidence] = useState<number>(0.9);

  // New Goal form
  const [newGoalTitle, setNewGoalTitle] = useState<string>('');
  const [newGoalPriority, setNewGoalPriority] = useState<'low' | 'normal' | 'high'>('normal');

  // New Fallback model input
  const [newFallbackModel, setNewFallbackModel] = useState<string>('');

  // New MCP Extension form
  const [newExtName, setNewExtName] = useState<string>('');
  const [newExtTarget, setNewExtTarget] = useState<string>('');

  useEffect(() => {
    return configManager.subscribe((newState) => {
      setConfig(newState);
      setCoreTxtBuffer(newState.core_txt);
    });
  }, [configManager]);

  const handleUpdate = (section: string, key: string, val: unknown) => {
    configManager.updateConfig(section, key, val);
  };

  const handleSaveCoreTxt = () => {
    configManager.updateConfig('core_txt', 'core_txt', coreTxtBuffer);
    setCoreSaved(true);
    setTimeout(() => setCoreSaved(false), 2500);
  };

  const handleSendPeer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!peerMessageText.trim()) return;
    configManager.sendPeerMessage(selectedPeer, peerMessageText.trim());
    setPeerMessageText('');
    setPeerSentSuccess(true);
    setTimeout(() => setPeerSentSuccess(false), 2500);
  };

  const handleAddBelief = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBeliefStatement.trim()) return;
    configManager.addBelief(newBeliefStatement.trim(), newBeliefConfidence);
    setNewBeliefStatement('');
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    configManager.addGoal(newGoalTitle.trim(), newGoalPriority);
    setNewGoalTitle('');
  };

  const handleAddExtension = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExtName.trim() || !newExtTarget.trim()) return;
    configManager.addExtension(newExtName.trim(), newExtTarget.trim());
    setNewExtName('');
    setNewExtTarget('');
  };

  const handleAddFallbackModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFallbackModel.trim()) return;
    const updated = [...config.models.fallbacks, newFallbackModel.trim()];
    configManager.updateConfig('models', 'fallbacks', updated);
    setNewFallbackModel('');
  };

  const handleRemoveFallbackModel = (modelName: string) => {
    const updated = config.models.fallbacks.filter((m) => m !== modelName);
    configManager.updateConfig('models', 'fallbacks', updated);
  };

  return (
    <div className="flex flex-col md:flex-row gap-5 h-full min-h-[500px]">
      {/* Left Sidebar Navigation */}
      <div className="w-full md:w-56 shrink-0 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto pr-1 pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-slate-800 font-mono text-xs">
        <button
          onClick={() => setActiveSection('drives')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left whitespace-nowrap cursor-pointer ${
            activeSection === 'drives'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Drives & Decays</span>
        </button>

        <button
          onClick={() => setActiveSection('models')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left whitespace-nowrap cursor-pointer ${
            activeSection === 'models'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Modelos LLM</span>
        </button>

        <button
          onClick={() => setActiveSection('cse')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left whitespace-nowrap cursor-pointer ${
            activeSection === 'cse'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>CSE Cognição</span>
        </button>

        <button
          onClick={() => setActiveSection('peers')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left whitespace-nowrap cursor-pointer ${
            activeSection === 'peers'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Peers Online</span>
        </button>

        <button
          onClick={() => setActiveSection('extensions')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left whitespace-nowrap cursor-pointer ${
            activeSection === 'extensions'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Extensões (MCP)</span>
        </button>

        <button
          onClick={() => setActiveSection('ticks')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left whitespace-nowrap cursor-pointer ${
            activeSection === 'ticks'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Ticks & Anti-Spam</span>
        </button>

        <button
          onClick={() => setActiveSection('identity')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left whitespace-nowrap cursor-pointer ${
            activeSection === 'identity'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Core.txt Identidade</span>
        </button>

        <button
          onClick={() => setActiveSection('beliefs')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left whitespace-nowrap cursor-pointer ${
            activeSection === 'beliefs'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Crenças ({config.beliefs.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('goals')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left whitespace-nowrap cursor-pointer ${
            activeSection === 'goals'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Metas ({config.goals.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('proposals')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left whitespace-nowrap cursor-pointer ${
            activeSection === 'proposals'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Propostas ({config.proposals.filter((p) => p.status === 'pending').length})</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {/* 1. SECTION: DRIVES & DECAYS */}
        {activeSection === 'drives' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  Pesos dos Drives & Taxas de Decaimento (Decay Rates)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Controla a velocidade com que cada drive se esgota no ciclo biológico e seu peso na deliberação.
                </p>
              </div>

              <button
                onClick={() => configManager.requestConfig(['drives'])}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
                title="Recarregar do runtime"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {Object.entries(config.drives).map(([key, val]) => {
                const isDecay = key.includes('decay');
                const min = isDecay ? 0.0001 : 0.1;
                const max = isDecay ? 0.005 : 3.0;
                const step = isDecay ? 0.0001 : 0.05;

                return (
                  <div key={key} className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                      <span className="text-slate-300 font-bold">{key}</span>
                      <span className="text-cyan-400 font-bold">{val}</span>
                    </div>

                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={val}
                      onChange={(e) => handleUpdate('drives', key, parseFloat(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                      <span>{min}</span>
                      <span>{max}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. SECTION: LLM MODELS */}
        {activeSection === 'models' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Arquitetura de Modelos LLM
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Define o modelo neural principal para volição e a cadeia de fallbacks em caso de indisponibilidade.
              </p>
            </div>

            {/* Principal Model */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <label className="text-xs font-mono font-bold text-slate-300 block">
                MODELO PRINCIPAL (VOLIÇÃO & PENSAMENTO)
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.models.principal}
                  onChange={(e) => handleUpdate('models', 'principal', e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                  placeholder="Ex: gemini-3.1-flash-lite"
                />
              </div>

              {/* Suggestions */}
              <div className="flex flex-wrap gap-1.5">
                {['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemma-4-31b-it'].map(
                  (m) => (
                    <button
                      key={m}
                      onClick={() => handleUpdate('models', 'principal', m)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        config.models.principal === m
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {m}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Fallbacks */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <label className="text-xs font-mono font-bold text-slate-300 block">
                CADEIA DE MODELOS FALLBACK ({config.models.fallbacks.length})
              </label>

              <div className="space-y-2">
                {config.models.fallbacks.map((fb, idx) => (
                  <div
                    key={fb}
                    className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono"
                  >
                    <span className="text-slate-300">
                      <span className="text-purple-400 font-bold mr-2">#{idx + 1}</span>
                      {fb}
                    </span>
                    <button
                      onClick={() => handleRemoveFallbackModel(fb)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Remover fallback"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Fallback */}
              <form onSubmit={handleAddFallbackModel} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newFallbackModel}
                  onChange={(e) => setNewFallbackModel(e.target.value)}
                  placeholder="Adicionar modelo de contingência..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 3. SECTION: CSE */}
        {activeSection === 'cse' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                Complex Systems Engine (CSE)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Mecanismo de emergência e simulação de autoconsciência contínua do CDI.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
              {/* Active Toggle */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-900">
                <div>
                  <div className="text-xs font-mono font-bold text-slate-200">ESTADO DO MOTOR CSE</div>
                  <div className="text-[11px] text-slate-500 font-sans">
                    Quando ativado, gera volição autónoma e deliberação intrínseca.
                  </div>
                </div>

                <button
                  onClick={() => handleUpdate('cse', 'enabled', !config.cse.enabled)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer border ${
                    config.cse.enabled
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'bg-rose-950 text-rose-400 border-rose-500/50'
                  }`}
                >
                  {config.cse.enabled ? 'ATIVADO' : 'DESATIVADO'}
                </button>
              </div>

              {/* Stage Selection */}
              <div>
                <label className="text-xs font-mono font-bold text-slate-300 block mb-1.5">
                  ESTÁGIO EVOLUTIVO (STAGE)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((stg) => (
                    <button
                      key={stg}
                      onClick={() => handleUpdate('cse', 'stage', stg)}
                      className={`p-2.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer flex flex-col items-center ${
                        config.cse.stage === stg
                          ? 'bg-purple-950 text-purple-200 border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span>Estágio {stg}</span>
                      <span className="text-[10px] font-normal text-slate-500">
                        {stg === 1 ? 'Reativo' : stg === 2 ? 'Emergente' : 'Meta-reflexivo'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Readouts */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Unidades Neurais (CSE)</div>
                  <div className="text-lg font-mono font-bold text-cyan-300 mt-1">{config.cse.units}</div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Sinal CSE</div>
                  <div className="text-lg font-mono font-bold text-purple-300 mt-1">{config.cse.signal}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. SECTION: PEERS ONLINE */}
        {activeSection === 'peers' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Malha de Peers Conectados & Barramento
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Comunicação horizontal de instâncias CDI para compartilhamento de axiomas e memórias.
              </p>
            </div>

            {/* Peers List */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Peers Ativos na Malha:</span>
                <span className="text-emerald-400 font-bold">
                  {config.peers.bus_status.messages_pending} mensagens pendentes no bus
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {config.peers.online.map((peer) => (
                  <div
                    key={peer}
                    className="p-3 bg-slate-900 rounded-xl border border-cyan-500/20 flex items-center justify-between"
                  >
                    <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#00ff9d]" />
                      {peer}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400">ONLINE</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Send Message to Peer Form */}
            <form onSubmit={handleSendPeer} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <label className="text-xs font-mono font-bold text-slate-300 block">
                ENVIAR MENSAGEM DIRETA A UM PEER (peer.send)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={selectedPeer}
                  onChange={(e) => setSelectedPeer(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none"
                >
                  {config.peers.online.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={peerMessageText}
                  onChange={(e) => setPeerMessageText(e.target.value)}
                  placeholder="Mensagem reflexiva ou pacote..."
                  className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {peerSentSuccess ? (
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Mensagem transmitida via WebSocket!
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-slate-500">
                    Dispara o protocolo peer.send ao runtime
                  </span>
                )}

                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,240,255,0.3)]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Transmitir</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 5. SECTION: EXTENSIONS (MCP) */}
        {activeSection === 'extensions' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Extensões Cognitivas & Servidores MCP
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ferramentas externas que ampliam os sentidos, a memória e a computação do CDI.
              </p>
            </div>

            <div className="space-y-2.5">
              {config.extensions.map((ext) => (
                <div
                  key={ext.id}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
                      <span>{ext.name}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/30 uppercase">
                        {ext.type || 'MCP'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {ext.url || ext.command}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => configManager.toggleExtension(ext.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer border ${
                        ext.enabled
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-900 text-slate-500 border-slate-800'
                      }`}
                    >
                      {ext.enabled ? 'ON' : 'OFF'}
                    </button>

                    <button
                      onClick={() => configManager.removeExtension(ext.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Remover extensão"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Extension Form */}
            <form onSubmit={handleAddExtension} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <label className="text-xs font-mono font-bold text-slate-300 block">
                CONECTAR NOVO SERVIDOR MCP
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newExtName}
                  onChange={(e) => setNewExtName(e.target.value)}
                  placeholder="Nome do Servidor (ex: Local Filesystem MCP)"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none"
                />

                <input
                  type="text"
                  value={newExtTarget}
                  onChange={(e) => setNewExtTarget(e.target.value)}
                  placeholder="URL (http://...) ou Comando (python...)"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Servidor MCP</span>
              </button>
            </form>
          </div>
        )}

        {/* 6. SECTION: TICKS & ANTI-SPAM */}
        {activeSection === 'ticks' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Intervalo do Ciclo Neural & Proteção Anti-Spam
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Temporização do loop autonómico do CDI e limites de taxa de mensagens.
              </p>
            </div>

            {/* Tick Interval */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold">INTERVALO DE TICK (MS)</span>
                <span className="text-purple-400 font-bold">
                  {config.tick_interval_ms} ms ({(config.tick_interval_ms / 1000).toFixed(1)}s)
                </span>
              </div>

              <input
                type="range"
                min={5000}
                max={60000}
                step={1000}
                value={config.tick_interval_ms}
                onChange={(e) => handleUpdate('tick_interval', 'tick_interval_ms', parseInt(e.target.value, 10))}
                className="w-full accent-purple-500 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>5s (Rápido)</span>
                <span>30s (Padrão)</span>
                <span>60s (Económico)</span>
              </div>
            </div>

            {/* Anti-Spam */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  ESCUDO ANTI-SPAM
                </span>

                <button
                  onClick={() =>
                    handleUpdate('anti_spam', 'enabled', !config.anti_spam.enabled)
                  }
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                    config.anti_spam.enabled
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                      : 'bg-rose-950 text-rose-400 border-rose-500/40'
                  }`}
                >
                  {config.anti_spam.enabled ? 'ATIVO' : 'INATIVO'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
                    Limite / Minuto
                  </label>
                  <input
                    type="number"
                    value={config.anti_spam.rate_limit_per_minute}
                    onChange={(e) =>
                      handleUpdate('anti_spam', 'rate_limit_per_minute', parseInt(e.target.value, 10))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
                    Cooldown (Segundos)
                  </label>
                  <input
                    type="number"
                    value={config.anti_spam.cooldown_seconds}
                    onChange={(e) =>
                      handleUpdate('anti_spam', 'cooldown_seconds', parseInt(e.target.value, 10))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7. SECTION: CORE.TXT */}
        {activeSection === 'identity' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-purple-400" />
                  Core.txt — Identidade Ontológica Fundamental
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Define a diretriz primária e axiomas de senciência de {agentName}.
                </p>
              </div>

              <button
                onClick={handleSaveCoreTxt}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold rounded-xl transition-all shadow-[0_0_12px_rgba(168,85,247,0.3)] cursor-pointer flex items-center gap-1.5"
              >
                {coreSaved ? <Check className="w-3.5 h-3.5" /> : <SaveIcon className="w-3.5 h-3.5" />}
                <span>{coreSaved ? 'Guardado no CDI!' : 'Guardar Identidade'}</span>
              </button>
            </div>

            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
              <textarea
                value={coreTxtBuffer}
                onChange={(e) => setCoreTxtBuffer(e.target.value)}
                rows={12}
                className="w-full bg-transparent p-3 font-mono text-xs text-slate-300 leading-relaxed focus:outline-none resize-y"
                placeholder="Axiomas de identidade do CDI..."
              />
            </div>
          </div>
        )}

        {/* 8. SECTION: BELIEFS */}
        {activeSection === 'beliefs' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Crenças & Axiomas Ontológicos ({config.beliefs.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Crenças acumuladas por {agentName} através da experiência e reflexões interativas.
              </p>
            </div>

            <div className="space-y-2.5">
              {config.beliefs.map((belief) => (
                <div
                  key={belief.id}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start justify-between gap-3"
                >
                  <div>
                    <p className="text-xs text-slate-200 font-sans leading-relaxed">
                      "{belief.statement}"
                    </p>
                    <div className="text-[10px] font-mono text-cyan-400 mt-1">
                      Confiança: {(belief.confidence * 100).toFixed(0)}%
                    </div>
                  </div>

                  <button
                    onClick={() => configManager.removeBelief(belief.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                    title="Remover crença"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Belief */}
            <form onSubmit={handleAddBelief} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <label className="text-xs font-mono font-bold text-slate-300 block">
                INJETAR NOVA CRENÇA ONTOLÓGICA
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newBeliefStatement}
                  onChange={(e) => setNewBeliefStatement(e.target.value)}
                  placeholder="Enunciado da crença ou axioma..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none"
                />

                <select
                  value={newBeliefConfidence}
                  onChange={(e) => setNewBeliefConfidence(parseFloat(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none"
                >
                  <option value={0.99}>99% Confiança</option>
                  <option value={0.95}>95% Confiança</option>
                  <option value={0.9}>90% Confiança</option>
                  <option value={0.75}>75% Confiança</option>
                </select>

                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow-[0_0_12px_rgba(0,240,255,0.3)]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 9. SECTION: GOALS */}
        {activeSection === 'goals' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-400" />
                Metas & Objetivos Volitivos ({config.goals.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Diretrizes de autoaperfeiçoamento e objetivos ativos de {agentName}.
              </p>
            </div>

            <div className="space-y-2.5">
              {config.goals.map((goal) => (
                <div
                  key={goal.id}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => configManager.toggleGoalCompleted(goal.id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                          goal.completed
                            ? 'bg-emerald-600 border-emerald-400 text-white'
                            : 'border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {goal.completed && <Check className="w-3 h-3" />}
                      </button>

                      <span
                        className={`text-xs font-sans ${
                          goal.completed ? 'line-through text-slate-500' : 'text-slate-200'
                        }`}
                      >
                        {goal.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-mono px-2 py-0.2 rounded uppercase ${
                          goal.priority === 'high'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {goal.priority}
                      </span>

                      <button
                        onClick={() => configManager.removeGoal(goal.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Add Goal */}
            <form onSubmit={handleAddGoal} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <label className="text-xs font-mono font-bold text-slate-300 block">
                CRIAR NOVA META
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  placeholder="Título da meta..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none"
                />

                <select
                  value={newGoalPriority}
                  onChange={(e) => setNewGoalPriority(e.target.value as 'low' | 'normal' | 'high')}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-purple-300 focus:outline-none"
                >
                  <option value="high">Alta Prioridade</option>
                  <option value="normal">Normal</option>
                  <option value="low">Baixa Prioridade</option>
                </select>

                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 10. SECTION: PROPOSALS */}
        {activeSection === 'proposals' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-purple-400" />
                Propostas Autónomas Geradas pelo CDI
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Iniciativas sugeridas pela volição de {agentName} que aguardam autorização humana.
              </p>
            </div>

            <div className="space-y-3">
              {config.proposals.map((prop) => (
                <div
                  key={prop.id}
                  className={`p-4 rounded-xl border transition-all ${
                    prop.status === 'approved'
                      ? 'bg-emerald-950/30 border-emerald-500/40'
                      : prop.status === 'rejected'
                      ? 'bg-rose-950/20 border-rose-500/30 opacity-60'
                      : 'bg-slate-950 border-purple-500/40 shadow-[0_0_15px_rgba(124,58,237,0.15)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-xs font-mono font-bold text-white">{prop.title}</h4>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                        prop.status === 'approved'
                          ? 'bg-emerald-900 text-emerald-300'
                          : prop.status === 'rejected'
                          ? 'bg-rose-900 text-rose-300'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {prop.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{prop.description}</p>
                  <div className="text-[11px] font-mono text-purple-300/80 mt-1">
                    Impacto: {prop.impact}
                  </div>

                  {prop.status === 'pending' && (
                    <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-slate-900">
                      <button
                        onClick={() => configManager.handleProposalAction(prop.id, 'reject')}
                        className="px-3 py-1 bg-slate-900 hover:bg-rose-950 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer"
                      >
                        Rejeitar
                      </button>

                      <button
                        onClick={() => configManager.handleProposalAction(prop.id, 'approve')}
                        className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold rounded-xl transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Aprovar Proposta</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function SaveIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
