/**
 * EventTimelineList: Scrollable cyberpunk timeline showing events received from
 * "timeline.event" protocol and state transitions in real time.
 */

import React, { useState } from 'react';
import { CDITimelineEventItem } from '../../types/protocol';
import {
  Clock,
  Compass,
  BookOpen,
  Moon,
  Share2,
  Activity,
  Sparkles,
  Filter,
} from 'lucide-react';

interface EventTimelineListProps {
  events: CDITimelineEventItem[];
}

export const EventTimelineList: React.FC<EventTimelineListProps> = ({ events }) => {
  const [filter, setFilter] = useState<'all' | 'decision' | 'dream' | 'peer'>('all');

  const getEventMeta = (type: string) => {
    switch (type.toLowerCase()) {
      case 'emergent_decision':
        return {
          icon: <Compass className="w-4 h-4 text-purple-400" />,
          borderColor: 'border-purple-500/40 bg-purple-950/20',
          badge: '// DECISÃO EMERGENTE',
          badgeColor: 'text-purple-300 bg-purple-950 border-purple-500/40',
        };
      case 'journal':
        return {
          icon: <BookOpen className="w-4 h-4 text-amber-400" />,
          borderColor: 'border-amber-500/40 bg-amber-950/20',
          badge: '// DIÁRIO / REFLEXÃO',
          badgeColor: 'text-amber-300 bg-amber-950 border-amber-500/40',
        };
      case 'dream':
        return {
          icon: <Moon className="w-4 h-4 text-indigo-400" />,
          borderColor: 'border-indigo-500/40 bg-indigo-950/20',
          badge: '// CICLO ONÍRICO',
          badgeColor: 'text-indigo-300 bg-indigo-950 border-indigo-500/40',
        };
      case 'peer_sync':
      case 'peer':
        return {
          icon: <Share2 className="w-4 h-4 text-cyan-400" />,
          borderColor: 'border-cyan-500/40 bg-cyan-950/20',
          badge: '// SINCRONIA PEER',
          badgeColor: 'text-cyan-300 bg-cyan-950 border-cyan-500/40',
        };
      case 'affect_shift':
        return {
          icon: <Activity className="w-4 h-4 text-rose-400" />,
          borderColor: 'border-rose-500/40 bg-rose-950/20',
          badge: '// TRANSIÇÃO AFETIVA',
          badgeColor: 'text-rose-300 bg-rose-950 border-rose-500/40',
        };
      default:
        return {
          icon: <Sparkles className="w-4 h-4 text-slate-400" />,
          borderColor: 'border-slate-800 bg-slate-900/30',
          badge: '// EVENTO DO SISTEMA',
          badgeColor: 'text-slate-300 bg-slate-900 border-slate-700',
        };
    }
  };

  const formatTime = (ts: string) => {
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) return ts;
      return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (filter === 'all') return true;
    if (filter === 'decision') return ev.type.includes('decision');
    if (filter === 'dream') return ev.type.includes('dream');
    if (filter === 'peer') return ev.type.includes('peer');
    return true;
  });

  return (
    <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col h-[380px]">
      {/* Header and Filter Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800 shrink-0">
        <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-purple-400" />
          TIMELINE DE EVENTOS EM TEMPO REAL ({events.length})
        </span>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto text-[10px] font-mono">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-purple-600 text-white border-purple-400'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('decision')}
            className={`px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
              filter === 'decision'
                ? 'bg-purple-600 text-white border-purple-400'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Decisões
          </button>
          <button
            onClick={() => setFilter('dream')}
            className={`px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
              filter === 'dream'
                ? 'bg-indigo-600 text-white border-indigo-400'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Sonhos
          </button>
          <button
            onClick={() => setFilter('peer')}
            className={`px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
              filter === 'peer'
                ? 'bg-cyan-600 text-slate-950 font-bold border-cyan-400'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Peers
          </button>
        </div>
      </div>

      {/* Scrollable Event List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1 font-mono">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-500">
            Nenhum evento registrado nesta categoria.
          </div>
        ) : (
          filteredEvents.map((ev, index) => {
            const meta = getEventMeta(ev.type);
            const isRecent = index === 0;

            return (
              <div
                key={`${ev.timestamp}_${index}`}
                className={`p-3 rounded-xl border transition-all ${meta.borderColor} ${
                  isRecent ? 'shadow-[0_0_15px_rgba(124,58,237,0.25)]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    {meta.icon}
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider uppercase border ${meta.badgeColor}`}
                    >
                      {meta.badge}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-500 font-normal shrink-0">
                    {formatTime(ev.timestamp)}
                  </span>
                </div>

                <p className="text-xs text-slate-200 mt-1 pl-5 font-sans leading-relaxed">
                  {ev.message}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
