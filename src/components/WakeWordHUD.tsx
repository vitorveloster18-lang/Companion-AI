/**
 * WakeWordHUD: Top banner and indicator for local Wake Word detection ("Ei Kairós"),
 * with live status, screen-off keepalive indicator, and detection flash animation.
 */

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Zap, Volume2 } from 'lucide-react';
import { WakeWordManager, WakeWordState } from '../core/WakeWordManager';

interface WakeWordHUDProps {
  wakeWordManager: WakeWordManager;
  agentName: string;
}

export const WakeWordHUD: React.FC<WakeWordHUDProps> = ({ wakeWordManager, agentName }) => {
  const [state, setState] = useState<WakeWordState>(wakeWordManager.getState());
  const [wakeFlash, setWakeFlash] = useState<string | null>(null);

  useEffect(() => {
    wakeWordManager.setAgentName(agentName);
  }, [wakeWordManager, agentName]);

  useEffect(() => {
    return wakeWordManager.subscribe((newState) => {
      setState(newState);
      if (newState.lastDetectedWord && (!state.lastDetectedTime || newState.lastDetectedTime !== state.lastDetectedTime)) {
        setWakeFlash(newState.lastDetectedWord);
        const timer = setTimeout(() => setWakeFlash(null), 3500);
        return () => clearTimeout(timer);
      }
    });
  }, [wakeWordManager, state.lastDetectedTime]);

  if (!state.isSupported) {
    return null;
  }

  return (
    <>
      {/* 1. Wake Detected Holographic Flash Notification Banner */}
      {wakeFlash && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in zoom-in-95 duration-200 pointer-events-none select-none">
          <div className="flex items-center gap-3 px-5 py-2.5 bg-purple-950/95 backdrop-blur-2xl border-2 border-purple-400 rounded-2xl shadow-[0_0_40px_rgba(168,85,247,0.6)] text-white">
            <div className="p-2 rounded-xl bg-purple-500/30 text-purple-300 animate-pulse">
              <Zap className="w-5 h-5 text-purple-200 fill-purple-300" />
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-widest text-purple-300 font-bold uppercase">
                // WAKE WORD LOCAL DETETADA
              </div>
              <div className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <span>"Ei {wakeFlash}"</span>
                <span className="text-xs text-purple-300 font-normal">→ Canal de voz ativado!</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Compact Wake Word Toggle Button in Header HUD */}
      <button
        onClick={() => wakeWordManager.toggle()}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono font-semibold transition-all cursor-pointer border select-none ${
          state.isActive
            ? 'bg-purple-950/80 border-purple-500/60 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:bg-purple-900/80'
            : 'bg-slate-900/60 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600'
        }`}
        title={
          state.isActive
            ? `Escuta ativa contínua ("Ei ${agentName}"). Funciona com ecrã desligado via Background Audio.`
            : `Ativar detecção de Wake Word ("Ei ${agentName}")`
        }
      >
        {state.isActive ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            <Mic className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">"Ei {agentName}"</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-purple-800/60 text-purple-200 font-bold uppercase">
              ON
            </span>
          </>
        ) : (
          <>
            <MicOff className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">"Ei {agentName}"</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-bold uppercase">
              OFF
            </span>
          </>
        )}
      </button>
    </>
  );
};
