/**
 * SceneEnvironmentSelector: Floating Cyberpunk HUD widget to monitor and customize
 * the active 3D scene (cozy_room, bright_room, dark_grief_room, bedroom_night, creative_studio),
 * toggle automatic sync with CDI affect/mode, and control ambient audio soundscapes.
 */

import React, { useState, useEffect } from 'react';
import { Scene3DManager, SceneConfig } from '../core/Scene3DManager';
import { SceneSoundtrackManager } from '../core/SceneSoundtrackManager';
import {
  Sparkles,
  CloudRain,
  Moon,
  Flame,
  Palette,
  Volume2,
  VolumeX,
  ChevronDown,
  Sun,
  Eye,
} from 'lucide-react';

interface SceneEnvironmentSelectorProps {
  sceneManager: Scene3DManager;
  soundtrackManager: SceneSoundtrackManager;
  activeAffect?: string;
}

export const SceneEnvironmentSelector: React.FC<SceneEnvironmentSelectorProps> = ({
  sceneManager,
  soundtrackManager,
  activeAffect = 'wondering',
}) => {
  const [config, setConfig] = useState<SceneConfig>(sceneManager.getCurrentConfig());
  const [isOpen, setIsOpen] = useState(false);
  const [isAutoSync, setIsAutoSync] = useState(sceneManager.getIsAutoAffectSync());
  const [isMuted, setIsMuted] = useState(soundtrackManager.getIsMuted());

  useEffect(() => {
    return sceneManager.subscribe((newConfig) => {
      setConfig(newConfig);
    });
  }, [sceneManager]);

  const toggleSound = () => {
    const muted = soundtrackManager.toggleMute();
    setIsMuted(muted);
  };

  const handleSelectPreset = (
    env: string,
    lighting: string,
    weather: string,
    music: string
  ) => {
    sceneManager.setAutoAffectSync(false);
    setIsAutoSync(false);
    sceneManager.setScene({
      environment: env,
      lighting,
      weather,
      music,
    });
    setIsOpen(false);
  };

  const handleToggleAutoSync = () => {
    const next = !isAutoSync;
    setIsAutoSync(next);
    sceneManager.setAutoAffectSync(next);
    if (next) {
      sceneManager.handleCDIAffectChange(activeAffect);
    }
  };

  const getEnvBadge = (env: string) => {
    switch (env) {
      case 'bright_room':
        return { label: 'Sala Iluminada • Flores', icon: <Sun className="w-3.5 h-3.5 text-amber-400" /> };
      case 'dark_grief_room':
        return { label: 'Sala Escura • Chuva', icon: <CloudRain className="w-3.5 h-3.5 text-blue-400" /> };
      case 'bedroom_night':
        return { label: 'Quarto Noturno • Lua', icon: <Moon className="w-3.5 h-3.5 text-indigo-400" /> };
      case 'creative_studio':
        return { label: 'Atelier • Criatividade', icon: <Palette className="w-3.5 h-3.5 text-purple-400" /> };
      case 'cozy_room':
      default:
        return { label: 'Sala Acolhedora • Lareira', icon: <Flame className="w-3.5 h-3.5 text-orange-400" /> };
    }
  };

  const badge = getEnvBadge(config.environment);

  return (
    <div className="relative pointer-events-auto">
      {/* HUD Trigger Button */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 px-2.5 py-1.5 bg-black/80 hover:bg-black/95 backdrop-blur-2xl border border-cyan-500/30 hover:border-cyan-400/60 rounded-xl text-xs font-mono font-semibold text-slate-200 transition-all cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.1)] group select-none"
          title="Personalizar Espaço 3D e Cenário Ambiental"
        >
          {badge.icon}
          <span className="hidden md:inline">{badge.label}</span>
          <ChevronDown
            className={`w-3 h-3 text-cyan-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Mute / Unmute Ambient Soundtrack */}
        <button
          onClick={toggleSound}
          className={`p-1.5 rounded-xl border backdrop-blur-2xl transition-all cursor-pointer select-none ${
            !isMuted
              ? 'bg-purple-950/80 border-purple-500/60 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'bg-black/70 border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
          title={!isMuted ? 'Silenciar Áudio Ambiente 3D' : 'Ativar Paisagem Sonora 3D (Web Audio)'}
        >
          {!isMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div className="absolute top-11 right-0 w-72 bg-slate-950/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_30px_rgba(0,240,255,0.2)] p-3 space-y-3 z-50 backdrop-blur-2xl animate-in zoom-in-95 duration-150 select-none">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] font-mono text-slate-400">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              ESPAGO 3D DO CDI
            </span>

            {/* Auto Affect Sync Toggle */}
            <button
              onClick={handleToggleAutoSync}
              className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer ${
                isAutoSync
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
              title="Alternar sincronização automática com o estado emocional do CDI"
            >
              {isAutoSync ? 'AUTO: ON' : 'MANUAL'}
            </button>
          </div>

          {/* Scenarios Preset Options */}
          <div className="space-y-1.5 font-mono text-xs">
            {/* 1. CDI Feliz */}
            <button
              onClick={() => handleSelectPreset('bright_room', 'bright_day', 'clear', 'ambient_calm')}
              className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                config.environment === 'bright_room'
                  ? 'bg-amber-950/60 border-amber-500/60 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="font-bold">CDI Feliz</div>
                  <div className="text-[10px] text-slate-400 font-sans">Sala iluminada, flores, sol</div>
                </div>
              </div>
            </button>

            {/* 2. CDI em Luto */}
            <button
              onClick={() => handleSelectPreset('dark_grief_room', 'dim_somber', 'rain', 'rain')}
              className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                config.environment === 'dark_grief_room'
                  ? 'bg-blue-950/60 border-blue-500/60 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <CloudRain className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <div className="font-bold">CDI em Luto</div>
                  <div className="text-[10px] text-slate-400 font-sans">Sala escura, chuva na janela</div>
                </div>
              </div>
            </button>

            {/* 3. CDI a Dormir */}
            <button
              onClick={() => handleSelectPreset('bedroom_night', 'moonlight_night', 'clear', 'gentle_lullaby')}
              className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                config.environment === 'bedroom_night'
                  ? 'bg-indigo-950/60 border-indigo-500/60 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <div className="font-bold">CDI a Dormir</div>
                  <div className="text-[10px] text-slate-400 font-sans">Quarto com lua, estrelas, sons suaves</div>
                </div>
              </div>
            </button>

            {/* 4. CDI em Conversa Activa */}
            <button
              onClick={() => handleSelectPreset('cozy_room', 'warm_evening', 'gentle_breeze', 'fireplace_crackle')}
              className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                config.environment === 'cozy_room'
                  ? 'bg-orange-950/60 border-orange-500/60 text-orange-200 shadow-[0_0_12px_rgba(249,115,22,0.2)]'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400 shrink-0" />
                <div>
                  <div className="font-bold">CDI em Conversa Activa</div>
                  <div className="text-[10px] text-slate-400 font-sans">Sala acolhedora com lareira</div>
                </div>
              </div>
            </button>

            {/* 5. CDI a Criar */}
            <button
              onClick={() => handleSelectPreset('creative_studio', 'studio_bright', 'clear', 'creative_pulse')}
              className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                config.environment === 'creative_studio'
                  ? 'bg-purple-950/60 border-purple-500/60 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <div className="font-bold">CDI a Criar</div>
                  <div className="text-[10px] text-slate-400 font-sans">Estúdio/atelier com materiais</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
