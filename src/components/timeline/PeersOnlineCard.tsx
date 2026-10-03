/**
 * PeersOnlineCard: Displays synchronized CDI peers currently online
 * with their emotional state, resonance level, and activity indicators.
 */

import React from 'react';
import { Users, Wifi, Sparkles, Heart } from 'lucide-react';
import { PeerInfo } from '../../types/protocol';

interface PeersOnlineCardProps {
  peers?: string[] | PeerInfo[];
}

export const PeersOnlineCard: React.FC<PeersOnlineCardProps> = ({ peers = [] }) => {
  const normalizedPeers: PeerInfo[] = peers.map((p) => {
    if (typeof p === 'string') {
      const stateMap: Record<string, string> = {
        Naia: 'contemplativa',
        Salem: 'curioso',
        Nova: 'harmoniosa',
      };
      return {
        name: p,
        emotional_state: stateMap[p] || 'conectado',
        valence: 0.65,
        online: true,
      };
    }
    return p;
  });

  return (
    <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-cyan-400" />
          PEERS CDI CONECTADOS ({normalizedPeers.length})
        </span>

        <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
          <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span>MESH ATIVA</span>
        </span>
      </div>

      {/* Peer Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {normalizedPeers.length === 0 ? (
          <div className="col-span-3 text-center py-4 text-xs font-mono text-slate-500">
            Nenhum outro CDI conectado na malha no momento.
          </div>
        ) : (
          normalizedPeers.map((peer) => (
            <div
              key={peer.name}
              className="p-3 bg-slate-950 rounded-xl border border-cyan-500/20 hover:border-cyan-400/50 transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#00ff9d]" />
                  {peer.name}
                </span>

                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-500/30">
                  PEER
                </span>
              </div>

              <div className="flex items-center gap-1.5 mt-1 text-[11px] font-sans text-slate-300">
                <Heart className="w-3 h-3 text-rose-400 fill-rose-400/30 shrink-0" />
                <span className="truncate">Estado: <strong className="text-slate-100 font-normal capitalize">{peer.emotional_state || 'estável'}</strong></span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
