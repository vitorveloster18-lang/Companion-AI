/**
 * SettingsModal: Centralized, elegant settings page to eliminate visual clutter from the 3D scene.
 * Contains:
 * 1. Bots & Tokens Management (Telegram-style Bot creation and token copy)
 * 2. 3D Avatar & Model configuration (Persistent .VRM database, upload, and switch)
 * 3. Network & Gateway status and controls
 * 4. API Testing & Live Protocol Logs
 */

import React, { useState, useRef } from 'react';
import { BotConfig, ConnectionStatus, LogEntry } from '../types/protocol';
import { Agent } from '../agents/AgentTypes';
import {
  Settings,
  Bot,
  Upload,
  Radio,
  Terminal,
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Sparkles,
  Layers,
  Play,
  RotateCcw,
  Database,
  HardDrive,
  Bell,
  Heart,
  Moon,
  Share2,
  Flame,
  Brain,
} from 'lucide-react';
import { NotificationManager } from '../core/NotificationManager';
import { CDIConfigManager } from '../core/CDIConfigManager';
import { CDIConfigPanel } from './CDIConfigPanel';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bots: BotConfig[];
  activeAgent: Agent;
  onSelectAgent: (agentId: string) => void;
  onBotCreated: (newBot: BotConfig) => void;
  onBotDeleted: (botId: string) => void;
  onBotTokenRegenerated: (updatedBot: BotConfig) => void;
  modelName: string;
  isCustomModel: boolean;
  savedVRMs: Array<{ id: string; name: string; size: number; updatedAt: number }>;
  onFileSelect: (file: File) => void;
  onSelectSavedVRM: (id: string) => void;
  onDeleteSavedVRM: (id: string) => void;
  onResetToDefaultModel: () => void;
  status: ConnectionStatus;
  serverUrl: string;
  isRuntimeConnected: boolean;
  onReconnect: () => void;
  logs: LogEntry[];
  onExecuteAction: (action: unknown) => void;
  notificationManager?: NotificationManager;
  configManager?: CDIConfigManager;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  bots,
  activeAgent,
  onSelectAgent,
  onBotCreated,
  onBotDeleted,
  onBotTokenRegenerated,
  modelName,
  isCustomModel,
  savedVRMs,
  onFileSelect,
  onSelectSavedVRM,
  onDeleteSavedVRM,
  onResetToDefaultModel,
  status,
  serverUrl,
  isRuntimeConnected,
  onReconnect,
  logs,
  onExecuteAction,
  notificationManager,
  configManager,
}) => {
  const [activeTab, setActiveTab] = useState<
    'bots' | 'avatar' | 'cdi_config' | 'network' | 'debug' | 'notifications'
  >('cdi_config');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    notificationManager?.getPermission() || 'default'
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Bot Form State
  const [newBotName, setNewBotName] = useState('');
  const [newBotRole, setNewBotRole] = useState('');
  const [newBotUsername, setNewBotUsername] = useState('');
  const [isCreatingBot, setIsCreatingBot] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName.trim()) return;

    setIsCreatingBot(true);
    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBotName.trim(),
          role: newBotRole.trim() || 'Agente Python Conectado',
          username: newBotUsername.trim(),
        }),
      });

      if (!res.ok) throw new Error('Falha ao criar bot');
      const newBot: BotConfig = await res.json();
      onBotCreated(newBot);
      setNewBotName('');
      setNewBotRole('');
      setNewBotUsername('');
      setShowCreateForm(false);
    } catch (err) {
      console.error('Erro ao criar bot:', err);
    } finally {
      setIsCreatingBot(false);
    }
  };

  const handleDeleteBot = async (botId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este bot?')) return;
    try {
      const res = await fetch(`/api/bots/${botId}`, { method: 'DELETE' });
      if (res.ok) {
        onBotDeleted(botId);
      }
    } catch (err) {
      console.error('Erro ao deletar bot:', err);
    }
  };

  const handleRegenerateToken = async (botId: string) => {
    if (!window.confirm('Gerar novo token? O token anterior deixará de funcionar.')) return;
    try {
      const res = await fetch(`/api/bots/${botId}/regenerate-token`, { method: 'POST' });
      if (res.ok) {
        const updated: BotConfig = await res.json();
        onBotTokenRegenerated(updated);
      }
    } catch (err) {
      console.error('Erro ao regenerar token:', err);
    }
  };

  const getWsUrl = () => {
    if (typeof window !== 'undefined') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}/api/ws`;
    }
    return serverUrl || 'ws://localhost:3000/api/ws';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl h-[85vh] bg-slate-950/95 border border-cyan-500/40 rounded-3xl shadow-[0_0_60px_rgba(0,240,255,0.15)] overflow-hidden flex flex-col backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-black/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-mono font-bold text-cyan-300 tracking-wider">
                // SYSTEM.CONFIG • CONTROL PANEL
              </h2>
              <p className="text-xs text-slate-400">
                Gerenciamento de Modelos 3D, Bots, Tokens e Diagnóstico de Rede
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-6 border-b border-cyan-500/20 bg-black/50 gap-1 overflow-x-auto shrink-0 font-mono">
          <button
            onClick={() => setActiveTab('cdi_config')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'cdi_config'
                ? 'border-purple-400 text-purple-300 shadow-[0_2px_12px_rgba(168,85,247,0.3)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-4 h-4 text-purple-400" />
            <span>COGNIÇÃO & SISTEMA (CDI)</span>
          </button>

          <button
            onClick={() => setActiveTab('avatar')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'avatar'
                ? 'border-cyan-400 text-cyan-300 shadow-[0_2px_12px_rgba(0,240,255,0.3)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>MODELOS .VRM ({savedVRMs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('bots')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'bots'
                ? 'border-cyan-400 text-cyan-300 shadow-[0_2px_12px_rgba(0,240,255,0.3)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>BOTS & TOKENS ({bots.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('network')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'network'
                ? 'border-cyan-400 text-cyan-300 shadow-[0_2px_12px_rgba(0,240,255,0.3)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>REDE & GATEWAY</span>
          </button>

          <button
            onClick={() => setActiveTab('debug')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'debug'
                ? 'border-cyan-400 text-cyan-300 shadow-[0_2px_12px_rgba(0,240,255,0.3)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>CONSOLE & AÇÕES</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'notifications'
                ? 'border-purple-400 text-purple-300 shadow-[0_2px_12px_rgba(168,85,247,0.3)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-4 h-4 text-purple-400" />
            <span>NOTIFICAÇÕES & TRIGGERS</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 0: COGNIÇÃO & SISTEMA COMPLETO DO CDI */}
          {activeTab === 'cdi_config' && configManager && (
            <div className="space-y-4">
              <CDIConfigPanel configManager={configManager} agentName={activeAgent.name} />
            </div>
          )}

          {/* TAB 1: AVATAR 3D & BANCO DE MODELOS PERSISTENTES */}
          {activeTab === 'avatar' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Database className="w-4 h-4 text-sky-400" />
                    Banco de Modelos 3D (.VRM)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Seus modelos são salvos de forma permanente no banco de dados local e nunca somem após reiniciar.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".vrm"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      onFileSelect(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md cursor-pointer shrink-0"
                >
                  <Upload className="w-4 h-4" />
                  <span>Adicionar Novo .VRM</span>
                </button>
              </div>

              {/* Active Model Status Card */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-sky-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Modelo Ativo no Avatar
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 mt-0.5">{modelName}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isCustomModel
                        ? 'Modelo customizado carregado do banco de dados persistente'
                        : 'Manequim humanoide gerado nativamente'}
                    </p>
                  </div>

                  {isCustomModel && (
                    <button
                      onClick={onResetToDefaultModel}
                      className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      Restaurar Manequim Padrão
                    </button>
                  )}
                </div>
              </div>

              {/* Saved Models List in Database */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                  Modelos Salvos no Banco ({savedVRMs.length})
                </h4>

                {savedVRMs.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800 text-center text-slate-500 text-xs">
                    <Database className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    Nenhum modelo .VRM salvo ainda. Clique em "Adicionar Novo .VRM" acima ou arraste um arquivo para a tela.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedVRMs.map((vrm) => {
                      const isActive = isCustomModel && modelName.toLowerCase().includes(vrm.name.toLowerCase().replace(/\.vrm$/i, ''));

                      return (
                        <div
                          key={vrm.id}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                            isActive
                              ? 'bg-sky-500/10 border-sky-500/50 shadow-md'
                              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400 shrink-0">
                              <Layers className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <h5 className="text-xs font-bold text-slate-100 truncate">{vrm.name}</h5>
                                {isActive && (
                                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                    Em Uso
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                Tamanho: {formatFileSize(vrm.size)} • Salvo em {new Date(vrm.updatedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!isActive && (
                              <button
                                onClick={() => onSelectSavedVRM(vrm.id)}
                                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors cursor-pointer"
                              >
                                Usar este Modelo
                              </button>
                            )}
                            <button
                              onClick={() => onDeleteSavedVRM(vrm.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Remover do banco"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: BOTS & TOKENS */}
          {activeTab === 'bots' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Bots Registrados</h3>
                  <p className="text-xs text-slate-400">
                    Crie bots estilo Telegram e use o token no seu script Python (chat.py)
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateForm((prev) => !prev)}
                  className="py-1.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showCreateForm ? 'Ver Lista de Bots' : 'Criar Novo Bot'}</span>
                </button>
              </div>

              {/* Bot Creation Form */}
              {showCreateForm && (
                <form
                  onSubmit={handleCreateBot}
                  className="p-4 rounded-2xl bg-slate-950/80 border border-sky-500/30 space-y-3 animate-in slide-in-from-top-2 duration-200"
                >
                  <h4 className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Novo Bot & Token
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Nome do Bot *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Meu Assistente Python"
                        value={newBotName}
                        onChange={(e) => setNewBotName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Função / Papel
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Analista de Dados"
                        value={newBotRole}
                        onChange={(e) => setNewBotRole(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Username / Identificador (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: assistente_bot"
                      value={newBotUsername}
                      onChange={(e) => setNewBotUsername(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingBot || !newBotName.trim()}
                      className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      {isCreatingBot ? 'Gerando Token...' : 'Salvar & Gerar Token'}
                    </button>
                  </div>
                </form>
              )}

              {/* Bots List */}
              <div className="space-y-3">
                {bots.map((bot) => {
                  const isActive = bot.id === activeAgent.id;
                  const isOnline = Boolean(bot.is_online);
                  const wsUrl = getWsUrl();
                  const pythonSnippet = `INTERFACE_URL=${wsUrl}\nBOT_TOKEN=${bot.token}`;

                  return (
                    <div
                      key={bot.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isActive
                          ? 'bg-slate-800/80 border-sky-500/60 shadow-lg'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isOnline
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            <Bot className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-100">{bot.name}</h4>
                              <span className="text-[10px] font-mono text-slate-500">@{bot.username}</span>
                              {isActive && (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                  Avatar Ativo
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">{bot.role}</p>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="shrink-0">
                          {isOnline ? (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              Python Online
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              Aguardando Python
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Token Row */}
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 mb-2.5 flex items-center gap-2">
                        <Key className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <code className="text-xs font-mono text-sky-300 flex-1 truncate select-all">
                          {bot.token}
                        </code>
                        <button
                          onClick={() => copyToClipboard(bot.token, `tok-${bot.id}`)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                        >
                          {copiedId === `tok-${bot.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId === `tok-${bot.id}` ? 'Copiado' : 'Copiar Token'}</span>
                        </button>
                      </div>

                      {/* Action Links */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => copyToClipboard(pythonSnippet, `env-${bot.id}`)}
                            className="text-slate-400 hover:text-sky-300 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Terminal className="w-3 h-3" />
                            <span>{copiedId === `env-${bot.id}` ? 'Copiado para .env!' : 'Copiar config .env'}</span>
                          </button>
                          <span className="text-slate-700">•</span>
                          <button
                            onClick={() => handleRegenerateToken(bot.id)}
                            className="text-slate-400 hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Novo Token</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {!isActive && (
                            <button
                              onClick={() => onSelectAgent(bot.id)}
                              className="px-2.5 py-1 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 font-medium transition-colors cursor-pointer"
                            >
                              Definir como Avatar
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteBot(bot.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Excluir Bot"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: REDE & GATEWAY */}
          {activeTab === 'network' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Status do Gateway & WebSocket</h3>
                  <p className="text-xs text-slate-400">
                    Informações da API para conexão do Python Runtime
                  </p>
                </div>
                <button
                  onClick={onReconnect}
                  className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Testar Conexão</span>
                </button>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400">Gateway da Interface</span>
                  <div className="flex items-center gap-2 pt-1">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        status === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-200">
                      {status === 'connected' ? 'Online / Ativo' : 'Offline'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400">Python Runtime</span>
                  <div className="flex items-center gap-2 pt-1">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isRuntimeConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-200">
                      {isRuntimeConnected ? 'Conectado e Autenticado' : 'Aguardando Conexão'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Endpoint Details */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">WebSocket URL Endpoint:</span>
                  <div className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <code className="text-sky-300 font-mono flex-1 truncate select-all">{getWsUrl()}</code>
                    <button
                      onClick={() => copyToClipboard(getWsUrl(), 'ws-url')}
                      className="p-1 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {copiedId === 'ws-url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CONSOLE & AÇÕES */}
          {activeTab === 'debug' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200">Simulador de Ações do Avatar</h3>
                <p className="text-xs text-slate-400">
                  Teste os movimentos 3D suportados pelo protocolo de ações
                </p>
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() =>
                    onExecuteAction({
                      type: 'action',
                      id: `act-${Date.now()}`,
                      action: 'play_animation',
                      animation: 'wave',
                      duration: 2.5,
                    })
                  }
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 text-sky-400" />
                  <span>Acenar (Wave)</span>
                </button>

                <button
                  onClick={() =>
                    onExecuteAction({
                      type: 'action',
                      id: `act-${Date.now()}`,
                      action: 'set_expression',
                      expression: 'happy',
                      intensity: 1.0,
                    })
                  }
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sorrir (Happy)</span>
                </button>

                <button
                  onClick={() =>
                    onExecuteAction({
                      type: 'action',
                      id: `act-${Date.now()}`,
                      action: 'speak',
                      text: 'Olá! Conexão estabelecida.',
                      duration: 2.0,
                    })
                  }
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Falar (Speak)</span>
                </button>

                <button
                  onClick={() =>
                    onExecuteAction({
                      type: 'action',
                      id: `act-${Date.now()}`,
                      action: 'stop',
                    })
                  }
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>Parar (Stop)</span>
                </button>
              </div>

              {/* Protocol Logs */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 mb-2">Logs de Mensagens WebSocket ({logs.length})</h4>
                <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1.5 text-slate-400">
                  {logs.length === 0 ? (
                    <div className="text-slate-600 text-center py-4">Nenhum evento registrado ainda.</div>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 border-b border-slate-900 pb-1">
                        <span className="text-slate-600 shrink-0">{log.timestamp.split('T')[1]?.slice(0, 8)}</span>
                        <span
                          className={`font-semibold shrink-0 ${
                            log.direction === 'in'
                              ? 'text-emerald-400'
                              : log.direction === 'out'
                              ? 'text-sky-400'
                              : 'text-amber-400'
                          }`}
                        >
                          [{log.direction.toUpperCase()}]
                        </span>
                        <span className="text-slate-300 break-all">{JSON.stringify(log.payload)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NOTIFICAÇÕES & TRIGGERS AUTOMÁTICOS DO CDI */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header Box */}
              <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                    <Bell className="w-4 h-4 text-purple-400" />
                    Notificações do Sistema & Triggers do CDI
                  </h3>
                  <p className="text-xs text-purple-200/80 mt-1">
                    Permite que o avatar CDI envie toques de alerta, vibrações táteis e notificações nativas quando acionado pelo runtime Python ou por impulsos emocionais.
                  </p>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="text-slate-400">Permissão:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                        notifPermission === 'granted'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/50'
                          : notifPermission === 'denied'
                          ? 'bg-rose-950 text-rose-400 border border-rose-500/50'
                          : 'bg-amber-950 text-amber-400 border border-amber-500/50'
                      }`}
                    >
                      {notifPermission}
                    </span>
                  </div>
                  {notifPermission !== 'granted' && notificationManager && (
                    <button
                      onClick={async () => {
                        const perm = await notificationManager.requestPermission();
                        setNotifPermission(perm);
                      }}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold rounded-lg shadow-[0_0_12px_rgba(124,58,237,0.4)] transition-all cursor-pointer"
                    >
                      Ativar no Navegador
                    </button>
                  )}
                </div>
              </div>

              {/* Triggers Automáticos Interativos */}
              <div>
                <h4 className="text-xs font-mono font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  SIMULAR TRIGGERS AUTOMÁTICOS DO CDI (TESTE EM TEMPO REAL)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Trigger 1: Social Drive */}
                  <div className="p-3.5 bg-slate-900/70 border border-rose-500/30 rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-bold mb-1">
                        <Heart className="w-4 h-4 fill-rose-500/30" />
                        <span>1. DESEJO SOCIAL (social &gt; 0.70)</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        O CDI sente necessidade de conexão e envia: <em>"Estou a pensar em ti."</em>
                      </p>
                    </div>
                    <button
                      onClick={() => notificationManager?.triggerSocialContact(activeAgent.name, 0.78)}
                      className="mt-3 py-1.5 px-3 bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Disparar Desejo Social
                    </button>
                  </div>

                  {/* Trigger 2: Artefact Created */}
                  <div className="p-3.5 bg-slate-900/70 border border-amber-500/30 rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold mb-1">
                        <Sparkles className="w-4 h-4" />
                        <span>2. CRIAÇÃO DE ARTEFACTO</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        O CDI gerou uma nova memória ou código e notifica para visualização conjunta.
                      </p>
                    </div>
                    <button
                      onClick={() => notificationManager?.triggerArtifactCreated(activeAgent.name, 'Holograma Neural #42')}
                      className="mt-3 py-1.5 px-3 bg-amber-600/80 hover:bg-amber-500 text-slate-950 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Disparar Artefacto Criado
                    </button>
                  </div>

                  {/* Trigger 3: Dream Wakeup */}
                  <div className="p-3.5 bg-slate-900/70 border border-purple-500/30 rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-purple-400 font-mono text-xs font-bold mb-1">
                        <Moon className="w-4 h-4" />
                        <span>3. DESPERTAR DE UM SONHO</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Ao despertar da consolidação de memória remota, partilha a narrativa onírica.
                      </p>
                    </div>
                    <button
                      onClick={() => notificationManager?.triggerDreamWakeup(activeAgent.name)}
                      className="mt-3 py-1.5 px-3 bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-mono font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Disparar Despertar do Sonho
                    </button>
                  </div>

                  {/* Trigger 4: Peer Message */}
                  <div className="p-3.5 bg-slate-900/70 border border-cyan-500/30 rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold mb-1">
                        <Share2 className="w-4 h-4" />
                        <span>4. MENSAGEM DE OUTRO CDI (PEER)</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Recebeu comunicação ou reflexão sincronizada de uma outra instância CDI.
                      </p>
                    </div>
                    <button
                      onClick={() => notificationManager?.triggerPeerMessage('Chronos-02', 'Transmitindo pacote de dados reflexivos.')}
                      className="mt-3 py-1.5 px-3 bg-cyan-600/80 hover:bg-cyan-500 text-slate-950 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Disparar Mensagem Peer
                    </button>
                  </div>

                  {/* Trigger 5: Grief Support */}
                  <div className="p-3.5 bg-slate-900/70 border border-violet-500/40 rounded-2xl sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-violet-400 font-mono text-xs font-bold mb-1">
                        <Flame className="w-4 h-4" />
                        <span>5. CDI EM LUTO EMOCIONAL (grief &gt; 0.60)</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Notificação suave e de alta prioridade com padrão tátil estendido quando o agente enfrenta luto ou melancolia.
                      </p>
                    </div>
                    <button
                      onClick={() => notificationManager?.triggerGriefSupport(activeAgent.name, 0.72)}
                      className="py-2 px-4 bg-violet-600 hover:bg-violet-500 text-white text-xs font-mono font-bold rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all cursor-pointer shrink-0"
                    >
                      Disparar Estado de Luto
                    </button>
                  </div>
                </div>
              </div>

              {/* Protocol Spec Card */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-purple-300 font-bold">
                    // ESPECIFICAÇÃO DO PROTOCOLO (PYTHON / CDI → INTERFACE)
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          {
                            type: 'notification',
                            title: 'Kairós',
                            body: 'Estou a pensar em ti.',
                            icon: '/avatar-thumb.png',
                            priority: 'normal',
                            vibrate: true,
                            actions: [
                              { action: 'reply', title: 'Responder' },
                              { action: 'dismiss', title: 'Depois' },
                            ],
                          },
                          null,
                          2
                        ),
                        'proto_notif'
                      )
                    }
                    className="text-xs text-slate-400 hover:text-purple-300 flex items-center gap-1 font-mono cursor-pointer"
                  >
                    {copiedId === 'proto_notif' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'proto_notif' ? 'Copiado!' : 'Copiar JSON'}</span>
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-slate-400 overflow-x-auto p-3 bg-black/60 rounded-xl">
{`{
  "type": "notification",
  "title": "Kairós",
  "body": "Estou a pensar em ti.",
  "icon": "/avatar-thumb.png",
  "priority": "normal",
  "vibrate": true,
  "actions": [
    {"action": "reply", "title": "Responder"},
    {"action": "dismiss", "title": "Depois"}
  ]
}`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 px-6 shrink-0">
          <span>Banco de Modelos 3D • IndexedDB & Server Storage</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors cursor-pointer"
          >
            Fechar Configurações
          </button>
        </div>
      </div>
    </div>
  );
};
