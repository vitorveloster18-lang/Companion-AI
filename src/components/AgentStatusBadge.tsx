/**
 * AgentStatusBadge: Visual status indicator for the agent.
 */

import React from 'react';
import { AgentStatus } from '../agents/AgentTypes';
import { Sparkles, MessageSquare, Loader2, Navigation, AlertCircle } from 'lucide-react';

interface AgentStatusBadgeProps {
  status: AgentStatus;
  size?: 'sm' | 'md';
}

export const AgentStatusBadge: React.FC<AgentStatusBadgeProps> = ({ status, size = 'md' }) => {
  const isSm = size === 'sm';

  switch (status) {
    case 'thinking':
      return (
        <div className={`inline-flex items-center gap-1.5 font-medium text-purple-400 bg-purple-950/50 border border-purple-800/60 rounded-full ${isSm ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs'}`}>
          <Sparkles className={`${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} animate-pulse`} />
          <span>Pensando...</span>
        </div>
      );

    case 'speaking':
      return (
        <div className={`inline-flex items-center gap-1.5 font-medium text-sky-400 bg-sky-950/50 border border-sky-800/60 rounded-full ${isSm ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs'}`}>
          <MessageSquare className={`${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} animate-bounce`} />
          <span>Falando</span>
        </div>
      );

    case 'working':
      return (
        <div className={`inline-flex items-center gap-1.5 font-medium text-amber-400 bg-amber-950/50 border border-amber-800/60 rounded-full ${isSm ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs'}`}>
          <Loader2 className={`${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} animate-spin`} />
          <span>Trabalhando</span>
        </div>
      );

    case 'moving':
      return (
        <div className={`inline-flex items-center gap-1.5 font-medium text-cyan-400 bg-cyan-950/50 border border-cyan-800/60 rounded-full ${isSm ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs'}`}>
          <Navigation className={`${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} animate-pulse`} />
          <span>Em movimento</span>
        </div>
      );

    case 'online':
    case 'idle':
      return (
        <div className={`inline-flex items-center gap-1.5 font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-full ${isSm ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs'}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Online</span>
        </div>
      );

    case 'connecting':
      return (
        <div className={`inline-flex items-center gap-1.5 font-medium text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded-full ${isSm ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs'}`}>
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Conectando...</span>
        </div>
      );

    case 'error':
      return (
        <div className={`inline-flex items-center gap-1.5 font-medium text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-full ${isSm ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs'}`}>
          <AlertCircle className={`${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
          <span>Erro</span>
        </div>
      );

    case 'offline':
    default:
      return (
        <div className={`inline-flex items-center gap-1.5 font-medium text-slate-400 bg-slate-900/60 border border-slate-800 rounded-full ${isSm ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs'}`}>
          <span className="h-2 w-2 rounded-full bg-slate-500" />
          <span>Offline</span>
        </div>
      );
  }
};
