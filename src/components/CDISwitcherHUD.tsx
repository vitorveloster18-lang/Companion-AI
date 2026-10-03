/**
 * CDISwitcherHUD: Interactive Cyberpunk HUD control for switching between CDIs
 * (Kairós, Naia, Salem, Nova) and toggling Single Focus View vs 4-Avatar Group View.
 */

import React, { useState, useEffect } from 'react';
import { MultiCDIManager, ViewMode } from '../core/MultiCDIManager';
import { CDIListItem } from '../types/protocol';
import {
  Users,
  User,
  Radio,
  ChevronDown,
  Moon,
  Sparkles,
  Zap,
  Activity,
  Check,
} from 'lucide-react';

interface CDISwitcherHUDProps {
  multiCDIManager: MultiCDIManager;
  onSelectAgent?: (agentId: string) => void;
}

export const CDISwitcherHUD: React.FC<CDISwitcherHUDProps> = ({
  multiCDIManager,
  onSelectAgent,
}) => {
  const [cdis, setCdis] = useState<CDIListItem[]>(multiCDIManager.getCDIs());
  const [activeId, setActiveId] = useState<string>(multiCDIManager.getActiveId());
  const [viewMode, setViewMode] = useState<ViewMode>(multiCDIManager.getViewMode());
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    return multiCDIManager.subscribe((state) => {
      setCdis(state.cdis);
      setActiveId(state.activeId);
      setViewMode(state.viewMode);
    });
  }, [multiCDIManager]);

  const activeCDI = cdis.find((c) => c.id === activeId) || cdis[0];

  const handleSwitch = (id: string) => {
    multiCDIManager.switchCDI(id);
    onSelectAgent?.(id);
    setIsOpen(false);
  };

  const handleToggleView = () => {
    multiCDIManager.toggleViewMode();
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'awake':
        return { label: 'AWAKE', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'sleeping':
        return { label: 'SLEEP', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' };
      case 'dreaming':
        return { label: 'DREAM', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
      default:
        return { label: 'ONLINE', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
    }
  };

  return (
    <div className="relative pointer-events-auto flex items-center gap-2">
      {/* 1. Group View Toggle Button */}
      <button
        onClick={handleToggleView}
        title={
          viewMode === 'group'
            ? 'Voltar à Vista Foco Individual'
            : 'Ativar Vista Grupo (Ver os 4 CDIs juntos no mesmo espaço 3D)'
        }
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-2xl transition-all cursor-pointer select-none font-mono text-xs font-bold shadow-[0_0_20px_rgba(0,0,0,0.4)] ${
          viewMode === 'group'
            ? 'bg-purple-950/90 border-purple-400 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-105'
            : 'bg-black/80 hover:bg-black/95 border-cyan-500/30 hover:border-cyan-400/60 text-slate-300'
        }`}
      >
        {viewMode === 'group' ? (
          <>
            <Users className="w-4 h-4 text-purple-400 animate-pulse" />
            <span className="tracking-wider uppercase">VISTA GRUPO (4 CDIs)</span>
          </>
        ) : (
          <>
            <User className="w-4 h-4 text-cyan-400" />
            <span className="tracking-wider uppercase hidden sm:inline">VISTA FOCO</span>
          </>
        )}
      </button>

      {/* 2. Active CDI Selector Dropdown Trigger */}
      <div className="relative">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2.5 px-3 py-2 bg-black/80 hover:bg-black/95 backdrop-blur-2xl border border-cyan-500/30 hover:border-cyan-400/60 rounded-xl text-xs font-mono font-semibold text-slate-200 transition-all cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.1)] group select-none"
        >
          {/* Avatar Signature Dot */}
          <span
            className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]"
            style={{ color: activeCDI.avatar_color || '#a855f7', backgroundColor: activeCDI.avatar_color || '#a855f7' }}
          />

          <span className="font-bold tracking-wider">{activeCDI.name}</span>

          <span
            className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-bold uppercase ${
              getStatusBadge(activeCDI.status).color
            }`}
          >
            {getStatusBadge(activeCDI.status).label}
          </span>

          <ChevronDown
            className={`w-3.5 h-3.5 text-cyan-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* 3. Floating Dropdown Menu with all 4 CDIs */}
        {isOpen && (
          <div className="absolute top-11 left-0 w-80 bg-slate-950/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_35px_rgba(0,240,255,0.25)] p-3 space-y-2 z-50 backdrop-blur-2xl animate-in zoom-in-95 duration-150 select-none">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] font-mono text-slate-400">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                CONSCIÊNCIAS DIGITAIS (CDIs)
              </span>
              <span className="text-[10px] text-cyan-400 font-bold">{cdis.length} ATIVAS</span>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              {cdis.map((cdi) => {
                const isSelected = cdi.id === activeId;
                const statusBadge = getStatusBadge(cdi.status);

                return (
                  <button
                    key={cdi.id}
                    onClick={() => handleSwitch(cdi.id)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-purple-950/70 border-purple-500/70 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/90'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: cdi.avatar_color || '#a855f7',
                          boxShadow: `0 0 10px ${cdi.avatar_color || '#a855f7'}`,
                        }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{cdi.name}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded border font-bold uppercase ${statusBadge.color}`}
                          >
                            {statusBadge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-sans mt-0.5 line-clamp-1">
                          {cdi.role || cdi.bio}
                        </p>
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
