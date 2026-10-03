/**
 * MoodAffectBar: Visualizes CDI Valence (Valência Emocional) and Arousal (Nível de Ativação / Excitação)
 * with cyberpunk gradient bars, historical trend mini-sparkline, and current Affect badge.
 */

import React from 'react';
import { Smile, Zap, Activity } from 'lucide-react';

interface MoodAffectBarProps {
  valence: number; // 0.0 to 1.0 or -1.0 to 1.0
  arousal: number; // 0.0 to 1.0
  affect?: string;
  history?: Array<{ time: number; valence: number; arousal: number }>;
}

export const MoodAffectBar: React.FC<MoodAffectBarProps> = ({
  valence,
  arousal,
  affect = 'wondering',
  history = [],
}) => {
  // Normalize valence to 0-100%
  const valencePct = Math.round(
    Math.min(100, Math.max(0, valence < 0 ? (valence + 1) * 50 : valence > 1 ? valence : valence * 100))
  );

  // Normalize arousal to 0-100%
  const arousalPct = Math.round(Math.min(100, Math.max(0, arousal * 100)));

  const getAffectColor = (val: string) => {
    switch (val.toLowerCase()) {
      case 'wondering':
      case 'curious':
        return 'text-cyan-300 border-cyan-500/50 bg-cyan-950/70 shadow-[0_0_12px_rgba(0,240,255,0.3)]';
      case 'inspired':
      case 'happy':
        return 'text-emerald-300 border-emerald-500/50 bg-emerald-950/70 shadow-[0_0_12px_rgba(16,185,129,0.3)]';
      case 'melancholic':
      case 'grief':
        return 'text-violet-300 border-violet-500/50 bg-violet-950/70 shadow-[0_0_12px_rgba(139,92,246,0.3)]';
      default:
        return 'text-purple-300 border-purple-500/50 bg-purple-950/70 shadow-[0_0_12px_rgba(168,85,247,0.3)]';
    }
  };

  return (
    <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4">
      {/* Top Header with Affect Badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          ESTADO DE HUMOR & AFETO
        </span>

        <span
          className={`px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold uppercase tracking-wider ${getAffectColor(
            affect
          )}`}
        >
          {affect}
        </span>
      </div>

      {/* Valence Bar */}
      <div>
        <div className="flex items-center justify-between text-xs font-mono mb-1.5">
          <span className="text-slate-400 flex items-center gap-1">
            <Smile className="w-3.5 h-3.5 text-emerald-400" />
            Valência (Negativa ↔ Positiva)
          </span>
          <span className="text-emerald-400 font-bold">{valence.toFixed(2)} ({valencePct}%)</span>
        </div>
        <div className="relative h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-purple-500 to-emerald-400 transition-all duration-700 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
            style={{ width: `${valencePct}%` }}
          />
        </div>
      </div>

      {/* Arousal Bar */}
      <div>
        <div className="flex items-center justify-between text-xs font-mono mb-1.5">
          <span className="text-slate-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Ativação / Arousal (Calmo ↔ Excitado)
          </span>
          <span className="text-amber-400 font-bold">{arousal.toFixed(2)} ({arousalPct}%)</span>
        </div>
        <div className="relative h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-700 via-amber-500 to-rose-500 transition-all duration-700 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
            style={{ width: `${arousalPct}%` }}
          />
        </div>
      </div>

      {/* Sparkline History Trend if available */}
      {history.length > 2 && (
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>Tendência Histórica:</span>
          <div className="flex items-center gap-1 h-4">
            {history.slice(-8).map((point, idx) => {
              const hPct = Math.round(point.valence * 100);
              return (
                <div
                  key={idx}
                  className="w-1.5 bg-cyan-400/70 rounded-t hover:bg-cyan-300 transition-all"
                  style={{ height: `${Math.max(3, (hPct / 100) * 16)}px` }}
                  title={`V: ${point.valence} | A: ${point.arousal}`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
