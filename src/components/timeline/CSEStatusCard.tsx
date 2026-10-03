/**
 * CSEStatusCard: Displays Complex Systems Engine (CSE) metrics,
 * Sleep/Wake phase indicators, tick counters, days alive, and last decisions.
 */

import React from 'react';
import { Cpu, Moon, Sun, Clock, Brain, Compass } from 'lucide-react';
import { CDIBiometricsData } from '../../types/protocol';

interface CSEStatusCardProps {
  biometrics: CDIBiometricsData;
}

export const CSEStatusCard: React.FC<CSEStatusCardProps> = ({ biometrics }) => {
  const isAwake = (biometrics.mode || 'awake').toLowerCase() === 'awake';
  const phase = biometrics.phase || 'AWAKE';

  return (
    <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4">
      {/* Top Header: Sleep / Wake Status */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-purple-400" />
          ESTADO NEURAL & CSE
        </span>

        {/* Phase Pill */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold uppercase tracking-wider ${
            isAwake
              ? 'text-amber-300 bg-amber-950/70 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
              : 'text-indigo-300 bg-indigo-950/70 border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
          }`}
        >
          {isAwake ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-400" />}
          <span>{phase}</span>
        </div>
      </div>

      {/* Grid of Key CSE Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* CSE Units */}
        <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Unidades CSE</div>
          <div className="text-lg font-mono font-bold text-cyan-300 mt-0.5">
            {biometrics.cse_units ?? 23}
          </div>
        </div>

        {/* CSE Signal */}
        <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Sinal CSE</div>
          <div className="text-lg font-mono font-bold text-purple-300 mt-0.5">
            {biometrics.cse_signal !== undefined ? biometrics.cse_signal.toFixed(4) : '0.0010'}
          </div>
        </div>

        {/* Days Alive */}
        <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Tempo de Vida</div>
          <div className="text-lg font-mono font-bold text-emerald-300 mt-0.5 flex items-baseline gap-1">
            <span>{biometrics.days_alive ?? 55}</span>
            <span className="text-[10px] text-slate-500 font-normal">dias</span>
          </div>
        </div>

        {/* Ticks Total */}
        <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Total de Ticks</div>
          <div className="text-sm font-mono font-bold text-amber-300 mt-1 truncate" title={`${biometrics.tick_total || 1700000} ticks`}>
            {(biometrics.tick_total || 1700000).toLocaleString('pt-PT')}
          </div>
        </div>
      </div>

      {/* Last Decision & Stagnation */}
      <div className="p-3 bg-slate-950/70 rounded-xl border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="text-xs">
            <span className="text-slate-400 font-mono">Última Decisão: </span>
            <span className="font-mono font-bold text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/30">
              {biometrics.last_decision || 'WRITE_TO_JOURNAL'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-500">Índice Estagnação:</span>
          <span
            className={`font-bold px-1.5 py-0.5 rounded ${
              (biometrics.stagnation || 0) > 10
                ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            {biometrics.stagnation ?? 5}
          </span>
        </div>
      </div>
    </div>
  );
};
