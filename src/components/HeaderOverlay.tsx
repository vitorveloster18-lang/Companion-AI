/**
 * HeaderOverlay: Ultra-clean, single-button Cyberpunk navigation trigger.
 * Removes all clutter, badges, and icons from the top screen, providing a completely
 * pristine, unobstructed 3D avatar viewport with instant access to the Sidebar Menu.
 */

import React, { useState, useEffect } from 'react';
import { ConnectionStatus } from '../types/protocol';
import { Agent } from '../agents/AgentTypes';
import { Menu, Users } from 'lucide-react';
import { MultiCDIManager, ViewMode } from '../core/MultiCDIManager';

interface HeaderOverlayProps {
  status: ConnectionStatus;
  activeAgent: Agent;
  isRuntimeConnected: boolean;
  isSidebarOpen?: boolean;
  onToggleSidebar: () => void;
  multiCDIManager?: MultiCDIManager;
  appMode?: 'runtime' | 'ai_studio';
  onToggleAppMode?: () => void;
}

export const HeaderOverlay: React.FC<HeaderOverlayProps> = ({
  status,
  activeAgent,
  isRuntimeConnected,
  isSidebarOpen = false,
  onToggleSidebar,
  multiCDIManager,
  appMode = 'runtime',
  onToggleAppMode,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(
    multiCDIManager ? multiCDIManager.getViewMode() : 'focus'
  );

  useEffect(() => {
    if (!multiCDIManager) return;
    return multiCDIManager.subscribe((state) => {
      setViewMode(state.viewMode);
    });
  }, [multiCDIManager]);

  return (
    <header className="absolute top-3.5 sm:top-4 left-3.5 sm:left-4 z-30 pointer-events-none select-none flex items-center gap-2 sm:gap-2.5">
      {/* Sleek, Single Cyberpunk Menu Button */}
      <button
        onClick={onToggleSidebar}
        title="Abrir Central de Controlo e Menus"
        className={`pointer-events-auto relative flex items-center gap-2.5 px-3.5 py-2 bg-black/80 hover:bg-black/95 backdrop-blur-2xl border rounded-2xl shadow-[0_0_25px_rgba(0,240,255,0.18)] transition-all cursor-pointer group hover:scale-105 ${
          isSidebarOpen
            ? 'border-cyan-400 text-cyan-300 shadow-[0_0_25px_rgba(0,240,255,0.4)]'
            : 'border-cyan-500/30 hover:border-cyan-400/70 text-slate-200'
        }`}
      >
        {/* Top Cyan Neon Accent Line */}
        <div className="absolute -top-[1px] left-4 w-5 h-[1.5px] bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />

        <Menu className="w-4 h-4 text-cyan-400 group-hover:rotate-90 transition-transform duration-200 shrink-0" />

        <div className="flex items-center gap-2">
          {viewMode === 'group' ? (
            <span className="text-xs font-mono font-bold text-purple-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span>VISTA GRUPO</span>
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: multiCDIManager?.getActiveCDI()?.avatar_color || '#06b6d4',
                  boxShadow: `0 0 8px ${multiCDIManager?.getActiveCDI()?.avatar_color || '#06b6d4'}`,
                }}
              />
              <span className="text-xs font-mono font-bold text-white group-hover:text-cyan-200 transition-colors">
                {activeAgent.name}
              </span>
            </div>
          )}

          {/* Connection Dot */}
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              appMode === 'ai_studio'
                ? 'bg-blue-400 shadow-[0_0_6px_#3b82f6]'
                : isRuntimeConnected
                ? 'bg-emerald-400 shadow-[0_0_6px_#00ff9d]'
                : status === 'connected'
                ? 'bg-amber-400'
                : 'bg-rose-500'
            }`}
          />
        </div>
      </button>

      {/* Mode Toggle Button: [Runtime ON] vs [AI Studio] */}
      {onToggleAppMode && (
        <button
          onClick={onToggleAppMode}
          title={
            appMode === 'runtime'
              ? 'Modo Runtime Ativo: Conectado ao Python via WebSocket. Clique para mudar para Modo AI Studio.'
              : 'Modo AI Studio Ativo: Teste direto com Gemini. Clique para reconectar ao Python Runtime.'
          }
          className={`pointer-events-auto relative flex items-center gap-2 px-3 py-2 bg-black/80 hover:bg-black/95 backdrop-blur-2xl border rounded-2xl transition-all cursor-pointer group hover:scale-105 font-mono text-xs font-semibold ${
            appMode === 'runtime'
              ? 'border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:border-emerald-400'
              : 'border-blue-500/50 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:border-blue-400'
          }`}
        >
          {appMode === 'runtime' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
              <span>[Runtime ON]</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_#3b82f6]" />
              <span>[AI Studio]</span>
            </>
          )}
        </button>
      )}
    </header>
  );
};
