/**
 * CyberSidebar: Comprehensive, responsive sliding navigation drawer and control center.
 * Consolidates ALL system controls, CDI switches, 3D environments, audio soundscapes,
 * Wake Word recognition, computer vision, telemetry, memories, and settings.
 * Leaves the main 3D viewport completely spotless and clean.
 */

import React, { useState, useEffect } from 'react';
import { MultiCDIManager, ViewMode } from '../core/MultiCDIManager';
import { Scene3DManager, SceneConfig } from '../core/Scene3DManager';
import { SceneSoundtrackManager } from '../core/SceneSoundtrackManager';
import { WakeWordManager } from '../core/WakeWordManager';
import { ConnectionStatus, CDIListItem } from '../types/protocol';
import { Agent } from '../agents/AgentTypes';
import {
  X,
  Users,
  User,
  Sparkles,
  BookOpen,
  Activity,
  Camera,
  Settings,
  Flame,
  Sun,
  CloudRain,
  Moon,
  Palette,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Radio,
  ChevronRight,
  ShieldCheck,
  Check,
  Cpu,
  Sliders,
  Play,
  Eye,
} from 'lucide-react';

interface CyberSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  status: ConnectionStatus;
  isRuntimeConnected: boolean;
  activeAgent: Agent;
  multiCDIManager: MultiCDIManager;
  scene3DManager: Scene3DManager | null;
  soundtrackManager: SceneSoundtrackManager;
  wakeWordManager: WakeWordManager;
  activeAffect?: string;
  onOpenSettings: () => void;
  onOpenMemoryGallery: () => void;
  onOpenTimeline: () => void;
  onToggleVision: () => void;
  isVisionOpen: boolean;
  onSelectAgent: (agentId: string) => void;
}

export const CyberSidebar: React.FC<CyberSidebarProps> = ({
  isOpen,
  onClose,
  status,
  isRuntimeConnected,
  activeAgent,
  multiCDIManager,
  scene3DManager,
  soundtrackManager,
  wakeWordManager,
  activeAffect = 'wondering',
  onOpenSettings,
  onOpenMemoryGallery,
  onOpenTimeline,
  onToggleVision,
  isVisionOpen,
  onSelectAgent,
}) => {
  const [cdis, setCdis] = useState<CDIListItem[]>(multiCDIManager.getCDIs());
  const [activeCDIId, setActiveCDIId] = useState<string>(multiCDIManager.getActiveId());
  const [viewMode, setViewMode] = useState<ViewMode>(multiCDIManager.getViewMode());
  const [sceneConfig, setSceneConfig] = useState<SceneConfig>(
    scene3DManager
      ? scene3DManager.getCurrentConfig()
      : { environment: 'cozy_room', lighting: 'warm_evening', weather: 'gentle_breeze', music: 'fireplace_crackle' }
  );
  const [isAutoAffect, setIsAutoAffect] = useState<boolean>(
    scene3DManager ? scene3DManager.getIsAutoAffectSync() : true
  );
  const [isMuted, setIsMuted] = useState<boolean>(soundtrackManager.getIsMuted());
  const [isWakeWordListening, setIsWakeWordListening] = useState<boolean>(
    wakeWordManager.getState().isActive
  );

  useEffect(() => {
    const unsubMulti = multiCDIManager.subscribe((state) => {
      setCdis(state.cdis);
      setActiveCDIId(state.activeId);
      setViewMode(state.viewMode);
    });

    const unsubScene = scene3DManager?.subscribe((cfg) => {
      setSceneConfig(cfg);
    });

    const unsubWake = wakeWordManager.subscribe((state) => {
      setIsWakeWordListening(state.isActive);
    });

    return () => {
      unsubMulti();
      unsubScene?.();
      unsubWake();
    };
  }, [multiCDIManager, scene3DManager, wakeWordManager]);

  const handleSwitchCDI = (id: string) => {
    multiCDIManager.switchCDI(id);
    onSelectAgent(id);
  };

  const handleToggleViewMode = () => {
    multiCDIManager.toggleViewMode();
  };

  const handleSelectScenePreset = (env: string, lighting: string, weather: string, music: string) => {
    if (!scene3DManager) return;
    scene3DManager.setAutoAffectSync(false);
    setIsAutoAffect(false);
    scene3DManager.setScene({ environment: env, lighting, weather, music });
  };

  const handleToggleAutoAffect = () => {
    if (!scene3DManager) return;
    const next = !isAutoAffect;
    setIsAutoAffect(next);
    scene3DManager.setAutoAffectSync(next);
    if (next) {
      scene3DManager.handleCDIAffectChange(activeAffect);
    }
  };

  const handleToggleSound = () => {
    const muted = soundtrackManager.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleWakeWord = () => {
    wakeWordManager.toggle();
  };

  const handleTestWakeWord = () => {
    wakeWordManager.simulateWakeWord();
  };

  const getStatusBadge = (st: string) => {
    switch (st.toLowerCase()) {
      case 'awake':
        return { label: 'AWAKE', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'sleeping':
        return { label: 'SLEEP', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' };
      case 'dreaming':
        return { label: 'DREAM', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
      default:
        return { label: 'ONLINE', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-auto select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <aside className="relative w-full max-w-sm sm:max-w-md h-full bg-slate-950/95 border-r border-cyan-500/30 shadow-[0_0_50px_rgba(0,240,255,0.25)] flex flex-col z-10 text-slate-100 font-sans backdrop-blur-2xl animate-in slide-in-from-left duration-300 overflow-hidden">
        {/* Top Accent Neon Line */}
        <div className="h-1 bg-gradient-to-r from-cyan-400 via-purple-500 to-amber-400 w-full shrink-0" />

        {/* Sidebar Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                CENTRAL DE CONTROLO
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRuntimeConnected
                      ? 'bg-emerald-400 shadow-[0_0_8px_#00ff9d]'
                      : status === 'connected'
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                  }`}
                />
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  {isRuntimeConnected ? 'RUNTIME ACTIVO' : status === 'connected' ? 'GATEWAY CONECTADO' : 'STANDBY'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar Central"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* SECTION 1: CONSCIÊNCIAS DIGITAIS (CDIs) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Radio className="w-3.5 h-3.5" />
                // CONSCIÊNCIAS (CDIs)
              </span>

              {/* View Mode Toggle */}
              <button
                onClick={handleToggleViewMode}
                className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'group'
                    ? 'bg-purple-950 text-purple-200 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title="Alternar entre Vista Foco (1 avatar) e Vista Grupo (4 avatares juntos)"
              >
                {viewMode === 'group' ? (
                  <>
                    <Users className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                    <span>VISTA GRUPO (4 CDIs)</span>
                  </>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    <span>VISTA FOCO</span>
                  </>
                )}
              </button>
            </div>

            {/* List of 4 CDIs */}
            <div className="grid grid-cols-1 gap-2">
              {cdis.map((cdi) => {
                const isSelected = cdi.id === activeCDIId;
                const badge = getStatusBadge(cdi.status);

                return (
                  <button
                    key={cdi.id}
                    onClick={() => handleSwitchCDI(cdi.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-purple-950/70 border-purple-400/80 text-white shadow-[0_0_18px_rgba(168,85,247,0.25)]'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/90'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: cdi.avatar_color || '#a855f7',
                          boxShadow: `0 0 10px ${cdi.avatar_color || '#a855f7'}`,
                        }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm">{cdi.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-bold ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-sans mt-0.5 line-clamp-1">
                          {cdi.role || cdi.bio}
                        </p>
                      </div>
                    </div>

                    {isSelected ? (
                      <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: WAKE WORD ("EI KAIRÓS") & RECONHECIMENTO DE VOZ */}
          <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300">
                <Mic className="w-4 h-4 text-cyan-400" />
                <span>PALAVRA DE ATIVAÇÃO VOCAL</span>
              </div>

              <button
                onClick={handleToggleWakeWord}
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  isWakeWordListening
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                {isWakeWordListening ? 'ESCUTA ACTIVA' : 'PAUSADO'}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs font-sans text-slate-400">
              <span>Diga <strong className="text-cyan-300 font-mono">"Ei {activeAgent.name}"</strong> para falar</span>
              <button
                onClick={handleTestWakeWord}
                className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer"
              >
                Simular Ativação
              </button>
            </div>
          </div>

          {/* SECTION 3: ESPAÇO 3D, CENÁRIOS & ÁUDIO AMBIENTE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Sparkles className="w-3.5 h-3.5" />
                // ESPAÇO 3D & AMBIENTE
              </span>

              <div className="flex items-center gap-1.5">
                {/* Auto Affect Toggle */}
                <button
                  onClick={handleToggleAutoAffect}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    isAutoAffect
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                  title="Sincronizar ambiente automaticamente com as emoções do CDI"
                >
                  {isAutoAffect ? 'AUTO: ON' : 'MANUAL'}
                </button>

                {/* Sound Mute Toggle */}
                <button
                  onClick={handleToggleSound}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    !isMuted
                      ? 'bg-purple-950 text-purple-200 border-purple-400'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                  title={!isMuted ? 'Silenciar som ambiente' : 'Ativar áudio ambiente 3D'}
                >
                  {!isMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* 5 Scenario Presets */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                onClick={() => handleSelectScenePreset('cozy_room', 'warm_evening', 'gentle_breeze', 'fireplace_crackle')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  sceneConfig.environment === 'cozy_room'
                    ? 'bg-orange-950/70 border-orange-400 text-orange-200 shadow-[0_0_12px_rgba(249,115,22,0.25)]'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span>Sala Acolhedora</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-sans">Lareira e calor</div>
              </button>

              <button
                onClick={() => handleSelectScenePreset('bright_room', 'bright_day', 'clear', 'ambient_calm')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  sceneConfig.environment === 'bright_room'
                    ? 'bg-amber-950/70 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sala Iluminada</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-sans">Flores e sol</div>
              </button>

              <button
                onClick={() => handleSelectScenePreset('dark_grief_room', 'dim_somber', 'rain', 'rain')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  sceneConfig.environment === 'dark_grief_room'
                    ? 'bg-blue-950/70 border-blue-400 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <CloudRain className="w-3.5 h-3.5 text-blue-400" />
                  <span>Sala Escura</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-sans">Chuva na janela</div>
              </button>

              <button
                onClick={() => handleSelectScenePreset('bedroom_night', 'moonlight_night', 'clear', 'gentle_lullaby')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  sceneConfig.environment === 'bedroom_night'
                    ? 'bg-indigo-950/70 border-indigo-400 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Quarto Noturno</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-sans">Lua e sono</div>
              </button>

              <button
                onClick={() => handleSelectScenePreset('creative_studio', 'studio_bright', 'clear', 'creative_pulse')}
                className={`col-span-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  sceneConfig.environment === 'creative_studio'
                    ? 'bg-purple-950/70 border-purple-400 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Palette className="w-3.5 h-3.5 text-purple-400" />
                  <span>Atelier & Estúdio Criativo</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-sans">Cavalete e criação</div>
              </button>
            </div>
          </div>

          {/* SECTION 4: MENTE, MEMÓRIAS, SENSORES & DEFINIÇÕES */}
          <div className="space-y-2">
            <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              // MENTE, SENSORES & ANÁLISE
            </div>

            {/* 1. Memory Gallery */}
            <button
              onClick={() => {
                onOpenMemoryGallery();
                onClose();
              }}
              className="w-full p-3 rounded-2xl bg-slate-900/70 hover:bg-purple-950/60 border border-purple-500/30 hover:border-purple-400/60 text-left transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-950 border border-purple-500/40 text-purple-300">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-mono font-bold text-xs text-white group-hover:text-purple-300">
                    Galeria de Memórias & Artefactos
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Artefactos, Diário Íntimo, Traços e Sonhos
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* 2. Telemetry & Timeline */}
            <button
              onClick={() => {
                onOpenTimeline();
                onClose();
              }}
              className="w-full p-3 rounded-2xl bg-slate-900/70 hover:bg-cyan-950/60 border border-cyan-500/30 hover:border-cyan-400/60 text-left transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-mono font-bold text-xs text-white group-hover:text-cyan-300">
                    Telemetria & Biometria do CDI
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Valência, Arousal, Drives e Logs
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* 3. Computer Vision / Optic Camera */}
            <button
              onClick={() => {
                onToggleVision();
                onClose();
              }}
              className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between group ${
                isVisionOpen
                  ? 'bg-cyan-950/70 border-cyan-400 text-cyan-200'
                  : 'bg-slate-900/70 hover:bg-slate-900/90 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-400">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-mono font-bold text-xs text-white">
                    Câmara Óptica & Visão
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Transmissão de frames (vision.frame)
                  </div>
                </div>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                  isVisionOpen ? 'bg-cyan-900 border-cyan-400 text-cyan-200' : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {isVisionOpen ? 'ACTIVA' : 'ABRIR'}
              </span>
            </button>

            {/* 4. Settings */}
            <button
              onClick={() => {
                onOpenSettings();
                onClose();
              }}
              className="w-full p-3 rounded-2xl bg-slate-900/70 hover:bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-left transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-400">
                  <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                </div>
                <div>
                  <div className="font-mono font-bold text-xs text-white">
                    Configurações & Modelos VRM
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Crenças, Objetivos, MCP Tools, Prompts
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-black/60 flex items-center justify-between text-xs font-mono text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Kairós CDI Engine</span>
          </span>
          <span className="text-[10px] text-slate-500">v2.4 • Cyberpunk</span>
        </div>
      </aside>
    </div>
  );
};
