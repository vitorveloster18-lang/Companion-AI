/**
 * PeerBusDialogueOverlay: Visualizes real-time inter-CDI conversations on the Peer Bus.
 * Renders floating holographic dialogue bubbles between the avatars with author badges,
 * affective state, and connection arcs.
 */

import React, { useState, useEffect } from 'react';
import { MultiCDIManager } from '../core/MultiCDIManager';
import { PeerBusEventMessage } from '../types/protocol';
import { Radio, MessageSquare, ArrowRight, Sparkles, Activity, X } from 'lucide-react';

interface PeerBusDialogueOverlayProps {
  multiCDIManager: MultiCDIManager;
  onSendPeerMessage?: (fromId: string, toName: string, text: string) => void;
}

export const PeerBusDialogueOverlay: React.FC<PeerBusDialogueOverlayProps> = ({
  multiCDIManager,
}) => {
  const [currentDialogue, setCurrentDialogue] = useState<PeerBusEventMessage | null>(null);
  const [recentEvents, setRecentEvents] = useState<PeerBusEventMessage[]>([]);
  const [isGroupMode, setIsGroupMode] = useState<boolean>(
    multiCDIManager.getViewMode() === 'group'
  );
  const [showLogDrawer, setShowLogDrawer] = useState<boolean>(false);

  useEffect(() => {
    return multiCDIManager.subscribe((state) => {
      setCurrentDialogue(state.currentPeerDialogue);
      setRecentEvents(state.recentPeerEvents);
      setIsGroupMode(state.viewMode === 'group');
    });
  }, [multiCDIManager]);

  // Only display peer bus overlay when in group mode or when there is an active peer dialogue
  if (!isGroupMode && !currentDialogue && !showLogDrawer) return null;

  return (
    <div className="absolute inset-x-4 bottom-28 z-30 pointer-events-none flex flex-col items-center select-none font-mono">
      {/* 1. Live Active Peer Bus Holographic Bubble */}
      {currentDialogue && (
        <div className="pointer-events-auto max-w-xl w-full bg-slate-950/90 border border-cyan-400/50 rounded-2xl p-4 shadow-[0_0_35px_rgba(0,240,255,0.25)] backdrop-blur-2xl animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20 text-xs">
            <div className="flex items-center gap-2 font-bold text-cyan-300">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>PEER BUS // CANAL COGNITIVO</span>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-purple-300 font-bold">{currentDialogue.from_name}</span>
              <ArrowRight className="w-3 h-3 text-cyan-400" />
              <span className="text-amber-300 font-bold">{currentDialogue.to_name}</span>
            </div>
          </div>

          {/* Dialogue Message */}
          <p className="mt-2.5 text-sm text-slate-100 font-sans leading-relaxed">
            "{currentDialogue.message}"
          </p>

          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
            <span>Sincronização em tempo real</span>
            <button
              onClick={() => setShowLogDrawer((prev) => !prev)}
              className="text-cyan-400 hover:text-cyan-300 transition-colors font-semibold cursor-pointer pointer-events-auto"
            >
              {showLogDrawer ? 'Ocultar Histórico' : 'Ver Histórico do Bus'}
            </button>
          </div>
        </div>
      )}

      {/* 2. Drawer / Log of Recent Peer Bus Interactions */}
      {showLogDrawer && (
        <div className="pointer-events-auto mt-3 max-w-xl w-full max-h-48 overflow-y-auto bg-black/90 border border-purple-500/30 rounded-xl p-3 shadow-2xl backdrop-blur-xl text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] text-purple-400 font-bold border-b border-slate-800 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              REGISTO DE TRANSMISSÕES PEER BUS
            </span>
            <button
              onClick={() => setShowLogDrawer(false)}
              className="text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentEvents.length === 0 ? (
            <div className="text-center py-4 text-slate-500">Nenhuma transmissão recente no barramento.</div>
          ) : (
            recentEvents.map((evt, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-bold text-slate-300">
                    {evt.from_name} ➔ {evt.to_name}
                  </span>
                  <span>{new Date(evt.timestamp).toLocaleTimeString('pt-PT')}</span>
                </div>
                <p className="text-xs text-slate-200 mt-1 font-sans">"{evt.message}"</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
