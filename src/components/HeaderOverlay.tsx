/**
 * HeaderOverlay: Cyberpunk HUD top navigation bar.
 * Clean, minimal, futuristic aesthetics with discrete ON/OFF telemetry.
 */

import React from 'react';
import { ConnectionStatus } from '../types/protocol';
import { Agent } from '../agents/AgentTypes';
import { Settings, Bot, ChevronDown, Radio } from 'lucide-react';

interface HeaderOverlayProps {
  status: ConnectionStatus;
  activeAgent: Agent;
  isRuntimeConnected: boolean;
  onOpenAgentSelector: () => void;
  onOpenSettings: () => void;
}

export const HeaderOverlay: React.FC<HeaderOverlayProps> = ({
  status,
  activeAgent,
  isRuntimeConnected,
  onOpenAgentSelector,
  onOpenSettings,
}) => {
  return (
    <header className="absolute top-4 inset-x-4 z-30 flex items-center justify-between pointer-events-none select-none">
      {/* Left: Minimal Cyberpunk Bot Pill */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onOpenAgentSelector}
          className="relative flex items-center gap-2.5 px-3 py-1.5 bg-black/80 hover:bg-black/95 backdrop-blur-2xl border border-cyan-500/30 hover:border-cyan-400/60 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.1)] transition-all cursor-pointer group"
          title="Clique para alternar bot ou agente"
        >
          {/* Cyberpunk Top Accent Bar */}
          <div className="absolute -top-[1px] left-3 w-4 h-[1.5px] bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />

          <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform shadow-[0_0_10px_rgba(0,240,255,0.3)]">
            <Bot className="w-4 h-4" />
          </div>

          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-slate-100 group-hover:text-cyan-200 transition-colors">
                {activeAgent.name}
              </span>
              <ChevronDown className="w-3 h-3 text-cyan-400/70 group-hover:text-cyan-300 transition-colors" />
            </div>

            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRuntimeConnected
                    ? 'bg-emerald-400 shadow-[0_0_6px_#00ff9d]'
                    : status === 'connected'
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
              />
              <span
                className={`text-[10px] font-mono tracking-wider uppercase font-semibold ${
                  isRuntimeConnected
                    ? 'text-emerald-400'
                    : status === 'connected'
                    ? 'text-amber-400/80'
                    : 'text-rose-400/80'
                }`}
              >
                {isRuntimeConnected ? 'ONLINE' : 'STANDBY'}
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Right: Cyberpunk Settings Trigger */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onOpenSettings}
          title="Abrir Painel de Configurações"
          className="relative px-3 py-2 bg-black/80 hover:bg-black/95 backdrop-blur-2xl border border-cyan-500/30 hover:border-cyan-400/60 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.1)] text-slate-200 hover:text-cyan-300 transition-all cursor-pointer group flex items-center gap-2 hover:scale-105"
        >
          {/* Cyberpunk Top Accent Bar */}
          <div className="absolute -top-[1px] right-3 w-4 h-[1.5px] bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />

          <div className="relative">
            <Settings className="w-4 h-4 text-cyan-400 group-hover:rotate-90 transition-transform duration-300" />
            <span
              className={`absolute -top-1 -right-1 h-2 w-2 rounded-full ${
                isRuntimeConnected
                  ? 'bg-emerald-400 shadow-[0_0_6px_#00ff9d]'
                  : 'bg-rose-500'
              }`}
            />
          </div>
          <span className="text-xs font-mono font-semibold hidden sm:inline tracking-wider uppercase">
            // CONFIG
          </span>
        </button>
      </div>
    </header>
  );
};
