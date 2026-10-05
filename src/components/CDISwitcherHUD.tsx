/**
 * CDISwitcherHUD: Interactive Cyberpunk HUD control for switching between real created CDIs / Bots
 * and toggling Single Focus View vs Multi-Avatar Group View.
 */

import React, { useState, useEffect } from 'react';
import { MultiCDIManager, ViewMode } from '../core/MultiCDIManager';
import { CDIListItem } from '../types/protocol';
import {
  Users,
  User,
  Radio,
  ChevronDown,
  Check,
  Pencil,
  X,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    return multiCDIManager.subscribe((state) => {
      setCdis(state.cdis);
      setActiveId(state.activeId);
      setViewMode(state.viewMode);
    });
  }, [multiCDIManager]);

  const activeCDI = cdis.find((c) => c.id === activeId) || cdis[0] || {
    id: 'bot_01',
    name: 'Assistente',
    status: 'idle',
    avatar_color: '#06b6d4',
    role: 'Agente Python',
    bio: 'Instância de bot',
    current_topic: '',
  };

  const handleSwitch = (id: string) => {
    multiCDIManager.switchCDI(id);
    onSelectAgent?.(id);
    setIsOpen(false);
  };

  const handleToggleView = () => {
    multiCDIManager.toggleViewMode();
  };

  const handleStartRename = (cdi: CDIListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(cdi.id);
    setEditName(cdi.name);
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditName('');
  };

  const handleSaveRename = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editName.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/bots/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
      }
    } catch (err) {
      console.error('Erro ao renomear bot:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'awake':
      case 'online':
        return { label: 'ONLINE', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'sleeping':
      case 'idle':
        return { label: 'STANDBY', color: 'bg-slate-500/20 text-slate-300 border-slate-500/40' };
      case 'dreaming':
        return { label: 'DREAM', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
      default:
        return { label: 'ACTIVE', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
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
            : `Ativar Vista Grupo (Ver ${cdis.length} ${cdis.length === 1 ? 'bot' : 'bots'} no mesmo espaço 3D)`
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
            <span className="tracking-wider uppercase">VISTA GRUPO ({cdis.length})</span>
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
            style={{ color: activeCDI.avatar_color || '#06b6d4', backgroundColor: activeCDI.avatar_color || '#06b6d4' }}
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

        {/* 3. Floating Dropdown Menu with created CDIs */}
        {isOpen && (
          <div className="absolute top-11 left-0 w-80 bg-slate-950/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_35px_rgba(0,240,255,0.25)] p-3 space-y-2 z-50 backdrop-blur-2xl animate-in zoom-in-95 duration-150 select-none">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] font-mono text-slate-400">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                BOTS DISPONÍVEIS
              </span>
              <span className="text-[10px] text-cyan-400 font-bold">{cdis.length} {cdis.length === 1 ? 'INSTÂNCIA' : 'INSTÂNCIAS'}</span>
            </div>

            <div className="space-y-1.5 font-mono text-xs max-h-60 overflow-y-auto">
              {cdis.map((cdi) => {
                const isSelected = cdi.id === activeId;
                const statusBadge = getStatusBadge(cdi.status);
                const isEditingThis = editingId === cdi.id;

                if (isEditingThis) {
                  return (
                    <form
                      key={cdi.id}
                      onSubmit={(e) => handleSaveRename(cdi.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2.5 rounded-xl border border-cyan-400 bg-cyan-950/60 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-cyan-300 font-bold">Alterar Nome do Bot</span>
                        <button type="button" onClick={handleCancelRename} className="text-slate-400 hover:text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <input
                        type="text"
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                        placeholder="Nome do bot"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={handleCancelRename}
                          className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-white"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving || !editName.trim()}
                          className="px-2.5 py-0.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-[10px] rounded-lg disabled:opacity-50"
                        >
                          {isSaving ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </form>
                  );
                }

                return (
                  <div
                    key={cdi.id}
                    onClick={() => handleSwitch(cdi.id)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-purple-950/70 border-purple-500/70 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/90'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate mr-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: cdi.avatar_color || '#06b6d4',
                          boxShadow: `0 0 10px ${cdi.avatar_color || '#06b6d4'}`,
                        }}
                      />
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm truncate">{cdi.name}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded border font-bold uppercase shrink-0 ${statusBadge.color}`}
                          >
                            {statusBadge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-sans mt-0.5 line-clamp-1">
                          {cdi.role || cdi.bio}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleStartRename(cdi, e)}
                        title="Alterar nome do bot"
                        className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 rounded transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      {isSelected && <Check className="w-4 h-4 text-purple-400 shrink-0 ml-1" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
