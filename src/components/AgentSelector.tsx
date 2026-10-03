/**
 * AgentSelector: Cyberpunk HUD floating modal to switch active agent or create new bots.
 */

import React from 'react';
import { Agent } from '../agents/AgentTypes';
import { AgentStatusBadge } from './AgentStatusBadge';
import { Users, Bot, X, Check, Plus, Key, Terminal } from 'lucide-react';

interface AgentSelectorProps {
  agents: Agent[];
  activeAgent: Agent;
  onSelectAgent: (agentId: string) => void;
  onOpenBotManager: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  agents,
  activeAgent,
  onSelectAgent,
  onOpenBotManager,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-start p-4 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-slate-950/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_40px_rgba(0,240,255,0.15)] overflow-hidden backdrop-blur-2xl mt-12 sm:mt-14"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 border-b border-cyan-500/20 flex items-center justify-between bg-black/80">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
              // BOTS & AGENTES
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Agents List */}
        <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
          {agents.map((agent) => {
            const isActive = agent.id === activeAgent.id;

            return (
              <button
                key={agent.id}
                onClick={() => {
                  onSelectAgent(agent.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/15 border border-cyan-500/60 text-white shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                    : 'hover:bg-slate-900/80 border border-transparent text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_#00f0ff]'
                        : 'bg-slate-900 border border-slate-800 text-slate-400'
                    }`}
                  >
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-mono font-semibold leading-tight truncate text-slate-100 flex items-center gap-1.5">
                      {agent.name}
                      {agent.token && <Key className="w-3 h-3 text-cyan-400 shrink-0" />}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5 font-sans">
                      {agent.role || 'Agente de Runtime'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <AgentStatusBadge status={agent.status} size="sm" />
                  {isActive && <Check className="w-4 h-4 text-cyan-400" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer: Create Bot Shortcut */}
        <div className="p-3 border-t border-cyan-500/20 bg-black/60">
          <button
            onClick={() => {
              onClose();
              onOpenBotManager();
            }}
            className="w-full py-2 px-3 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(0,240,255,0.2)]"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>// NOVO BOT / TOKENS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
