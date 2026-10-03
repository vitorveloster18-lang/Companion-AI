/**
 * OfflineIndicator: Discreet Cyberpunk indicator showing offline state,
 * last preserved CDI state, and pending background sync messages.
 */

import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, CloudOff, CheckCircle2 } from 'lucide-react';
import { OfflineSyncManager } from '../core/OfflineSyncManager';

interface OfflineIndicatorProps {
  offlineSyncManager: OfflineSyncManager;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ offlineSyncManager }) => {
  const [state, setState] = useState({
    isOnline: offlineSyncManager.getIsOnline(),
    queuedCount: offlineSyncManager.getQueuedCount(),
  });
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    return offlineSyncManager.subscribe((newState) => {
      if (!state.isOnline && newState.isOnline) {
        setJustReconnected(true);
        const timer = setTimeout(() => setJustReconnected(false), 3500);
        return () => clearTimeout(timer);
      }
      setState({
        isOnline: newState.isOnline,
        queuedCount: newState.queuedCount,
      });
    });
  }, [offlineSyncManager, state.isOnline]);

  if (state.isOnline && !justReconnected && state.queuedCount === 0) {
    return null;
  }

  return (
    <div className="absolute top-16 left-4 z-40 animate-in fade-in slide-in-from-top-2 duration-200 select-none">
      {justReconnected ? (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/80 backdrop-blur-xl border border-emerald-500/50 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] text-emerald-300 text-xs font-mono font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>// REDE RESTAURADA • CDI SINCRONIZADO</span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-3 py-1.5 bg-purple-950/85 backdrop-blur-xl border border-purple-500/50 rounded-xl shadow-[0_0_25px_rgba(124,58,237,0.3)] text-purple-200 text-xs font-mono">
          <CloudOff className="w-4 h-4 text-purple-400 animate-pulse" />
          <div className="flex flex-col">
            <span className="font-bold text-white tracking-wide">
              // MODO OFFLINE • ESTADO PRESERVADO
            </span>
            {state.queuedCount > 0 && (
              <span className="text-[10px] text-purple-300">
                {state.queuedCount} mensagem(ns) em fila de sincronização
              </span>
            )}
          </div>
          <button
            onClick={() => offlineSyncManager.flushQueue()}
            className="ml-1 p-1 hover:bg-purple-900/60 rounded-lg text-purple-300 hover:text-white transition-colors cursor-pointer"
            title="Tentar sincronizar agora"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
