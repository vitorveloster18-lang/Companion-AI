/**
 * CDITimelineOverlay: Cyberpunk HUD Overlay displaying real-time CDI Biometrics,
 * Drives Radar Chart, Mood (Valence/Arousal) Bar, CSE Neural Status, Connected Peers,
 * and Live Scrollable Event Timeline.
 */

import React, { useState, useEffect } from 'react';
import { CDITimelineStore, CDITimelineState } from '../core/CDITimelineStore';
import { DrivesRadarChart } from './timeline/DrivesRadarChart';
import { MoodAffectBar } from './timeline/MoodAffectBar';
import { CSEStatusCard } from './timeline/CSEStatusCard';
import { PeersOnlineCard } from './timeline/PeersOnlineCard';
import { EventTimelineList } from './timeline/EventTimelineList';
import { Activity, X, Play, RefreshCw, Zap, Compass } from 'lucide-react';

interface CDITimelineOverlayProps {
  timelineStore: CDITimelineStore;
  isOpen: boolean;
  onClose: () => void;
  agentName?: string;
}

export const CDITimelineOverlay: React.FC<CDITimelineOverlayProps> = ({
  timelineStore,
  isOpen,
  onClose,
  agentName = 'Kairós',
}) => {
  const [state, setState] = useState<CDITimelineState>(timelineStore.getState());

  useEffect(() => {
    return timelineStore.subscribe((newState) => {
      setState(newState);
    });
  }, [timelineStore]);

  if (!isOpen) return null;

  const { biometrics, events, valenceHistory } = state;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-5xl h-[90vh] bg-slate-950/95 border border-purple-500/40 rounded-3xl shadow-[0_0_60px_rgba(124,58,237,0.2)] overflow-hidden flex flex-col backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-purple-500/20 bg-black/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/50 text-purple-300 shadow-[0_0_12px_rgba(124,58,237,0.4)]">
              <Activity className="w-5 h-5 text-purple-400 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-widest text-purple-400 font-bold uppercase">
                // TELEMETRIA NEURAL & TIMELINE DO CDI
              </div>
              <h2 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <span>{agentName}</span>
                <span className="text-xs text-slate-400 font-normal">
                  • Ciclo de 30s • {biometrics.phase || 'AWAKE'}
                </span>
              </h2>
            </div>
          </div>

          {/* Quick Simulation & Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => timelineStore.simulateEmergentDecision('EMERGENT_SEEK_COMFORT')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-purple-900/60 hover:bg-purple-800/80 border border-purple-500/40 text-purple-200 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer shadow-[0_0_10px_rgba(124,58,237,0.2)]"
              title="Disparar evento simulado de decisão emergente"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>+ Decisão Emergente</span>
            </button>

            <button
              onClick={() => timelineStore.simulateStateShift()}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer"
              title="Simular transição de humor e drives"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Simular Atualização (30s)</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors cursor-pointer border border-transparent hover:border-slate-800"
              title="Fechar painel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (5 cols): Drives Radar Chart & Mood/Valence Bar */}
            <div className="lg:col-span-5 space-y-5 flex flex-col justify-between">
              {/* Radar Chart Card */}
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-slate-300 uppercase">
                    // DRIVES BIOLÓGICOS (RADAR CHART)
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40">
                    {biometrics.top_drives?.length || 0} Eixos
                  </span>
                </div>

                <div className="py-2">
                  <DrivesRadarChart drives={biometrics.top_drives || []} size={250} />
                </div>
              </div>

              {/* Mood & Affect Bar */}
              <MoodAffectBar
                valence={biometrics.valence}
                arousal={biometrics.arousal}
                affect={biometrics.affect}
                history={valenceHistory}
              />
            </div>

            {/* Right Column (7 cols): CSE Status, Peers Online, and Scrollable Timeline */}
            <div className="lg:col-span-7 space-y-5">
              {/* CSE & Consciousness Status */}
              <CSEStatusCard biometrics={biometrics} />

              {/* Peers Online Mesh */}
              <PeersOnlineCard peers={biometrics.peers_online} />

              {/* Scrollable Event Timeline */}
              <EventTimelineList events={events} />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 px-6 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-mono shrink-0">
          <span>Protocolo WebSocket: state.update (30s) • timeline.event</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)] cursor-pointer"
          >
            Fechar Telemetria
          </button>
        </div>
      </div>
    </div>
  );
};
