/**
 * DebugPanel: Collapsible panel for inspecting WebSocket protocol logs,
 * testing 3D avatar actions, and simulating chat/agent protocol messages.
 */

import React, { useState } from 'react';
import { LogEntry, ConnectionStatus } from '../types/protocol';
import { AvatarState } from '../core/WorldState';
import { Agent } from '../agents/AgentTypes';
import { X, Play, Square, Send, Copy, Check, Terminal, CheckCircle2, CircleDot, MessageSquare, Bot } from 'lucide-react';

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  status: ConnectionStatus;
  serverUrl: string;
  onUpdateUrl: (url: string) => void;
  onReconnect: () => void;
  logs: LogEntry[];
  worldState: AvatarState;
  activeAgent: Agent;
  onExecuteAction: (action: unknown) => void;
}

const EXACT_PROTOCOL_TESTS = [
  {
    index: 1,
    title: '1. Play Animation (wave)',
    id: 'test-wave',
    payload: {
      type: 'action',
      id: 'test-wave',
      action: 'play_animation',
      animation: 'wave',
    },
  },
  {
    index: 2,
    title: '2. Move To (x: 2, y: 0, z: 0)',
    id: 'test-move',
    payload: {
      type: 'action',
      id: 'test-move',
      action: 'move_to',
      target: {
        x: 2,
        y: 0,
        z: 0,
      },
    },
  },
  {
    index: 3,
    title: '3. Look At (x: 0, y: 1.5, z: 0)',
    id: 'test-look',
    payload: {
      type: 'action',
      id: 'test-look',
      action: 'look_at',
      target: {
        x: 0,
        y: 1.5,
        z: 0,
      },
    },
  },
  {
    index: 4,
    title: '4. Speak Text',
    id: 'test-speak',
    payload: {
      type: 'action',
      id: 'test-speak',
      action: 'speak',
      text: 'Olá, este é um teste.',
    },
  },
];

export const DebugPanel: React.FC<DebugPanelProps> = ({
  isOpen,
  onClose,
  status,
  serverUrl,
  onUpdateUrl,
  onReconnect,
  logs,
  worldState,
  activeAgent,
  onExecuteAction,
}) => {
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [customJson, setCustomJson] = useState(`{
  "type": "chat.started",
  "id": "msg-test",
  "agent_id": "${activeAgent.id}"
}`);
  const [activeTab, setActiveTab] = useState<'protocol' | 'chat' | 'triggers' | 'json' | 'logs'>('protocol');
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [isRunningSuite, setIsRunningSuite] = useState(false);

  if (!isOpen) return null;

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUrl(urlInput);
  };

  const handleSendCustomJson = () => {
    try {
      const parsed = JSON.parse(customJson);
      onExecuteAction(parsed);
    } catch (err) {
      alert(`JSON inválido: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLogId(id);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  const triggerAction = (action: string, payload: Record<string, unknown> = {}) => {
    const cmd = {
      type: 'action',
      id: String(Date.now()),
      action,
      ...payload,
    };
    onExecuteAction(cmd);
  };

  // Simulates a full agent chat response stream from Python
  const simulateChatStream = async () => {
    const testId = `msg-${Date.now()}`;

    // 1. chat.started + status thinking
    onExecuteAction({ type: 'agent.status', agent_id: activeAgent.id, status: 'thinking' });
    onExecuteAction({ type: 'chat.started', id: testId, agent_id: activeAgent.id });
    await new Promise((r) => setTimeout(r, 600));

    // 2. status speaking + deltas
    onExecuteAction({ type: 'agent.status', agent_id: activeAgent.id, status: 'speaking' });
    const deltas = ['Estou ', 'analisando ', 'os dados ', 'que você ', 'enviou... ', '\n\nEncontrei ', '3 pontos ', 'importantes ', 'no relatório.'];

    for (const chunk of deltas) {
      onExecuteAction({ type: 'chat.delta', id: testId, text: chunk });
      await new Promise((r) => setTimeout(r, 180));
    }

    // 3. chat.completed + status idle
    await new Promise((r) => setTimeout(r, 400));
    onExecuteAction({ type: 'chat.completed', id: testId });
    onExecuteAction({ type: 'agent.status', agent_id: activeAgent.id, status: 'idle' });
  };

  const runSequentialSuite = async () => {
    if (isRunningSuite) return;
    setIsRunningSuite(true);

    for (const test of EXACT_PROTOCOL_TESTS) {
      onExecuteAction(test.payload);
      await new Promise((resolve) => setTimeout(resolve, 3200));
    }

    setIsRunningSuite(false);
  };

  const getTestStatus = (testId: string) => {
    const started = logs.some(
      (l) =>
        l.direction === 'out' &&
        typeof l.payload === 'object' &&
        (l.payload as { type?: string; id?: string })?.type === 'action.started' &&
        (l.payload as { type?: string; id?: string })?.id === testId
    );
    const completed = logs.some(
      (l) =>
        l.direction === 'out' &&
        typeof l.payload === 'object' &&
        (l.payload as { type?: string; id?: string })?.type === 'action.completed' &&
        (l.payload as { type?: string; id?: string })?.id === testId
    );
    const failed = logs.some(
      (l) =>
        l.direction === 'out' &&
        typeof l.payload === 'object' &&
        (l.payload as { type?: string; id?: string })?.type === 'action.failed' &&
        (l.payload as { type?: string; id?: string })?.id === testId
    );

    return { started, completed, failed };
  };

  return (
    <aside className="fixed top-16 right-4 bottom-4 w-[430px] max-w-[calc(100vw-2rem)] z-50 flex flex-col bg-slate-900/95 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Painel de Teste & Depuração</h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* State Monitor */}
      <div className="px-4 py-2 bg-slate-950/90 border-b border-slate-800/80 text-[11px] font-mono grid grid-cols-2 gap-x-3 gap-y-1 text-slate-300">
        <div>
          <span className="text-slate-500">Agente:</span> <span className="text-sky-300">{activeAgent.name}</span>
        </div>
        <div>
          <span className="text-slate-500">Status:</span> <span className="text-amber-300">{activeAgent.status}</span>
        </div>
        <div>
          <span className="text-slate-500">Pos:</span>{' '}
          <span className="text-slate-300">
            {worldState.position.x.toFixed(1)}, {worldState.position.y.toFixed(1)}, {worldState.position.z.toFixed(1)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Anim:</span> <span className="text-emerald-300">{worldState.animation}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800 px-2 pt-2 bg-slate-950/40 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('protocol')}
          className={`px-3 py-1.5 font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'protocol' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Ações 3D
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-1.5 font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'chat' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3 h-3" />
          <span>Chat & Agentes</span>
        </button>
        <button
          onClick={() => setActiveTab('triggers')}
          className={`px-3 py-1.5 font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'triggers' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Manuais
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`px-3 py-1.5 font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'json' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          JSON
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-3 py-1.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'logs' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Logs</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300">
            {logs.length}
          </span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Tab 1: Protocol 3D Tests */}
        {activeTab === 'protocol' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium text-xs">Validação de Ações do Avatar</span>
              <button
                onClick={runSequentialSuite}
                disabled={isRunningSuite}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isRunningSuite
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isRunningSuite ? 'Executando...' : 'Executar 1 a 4'}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {EXACT_PROTOCOL_TESTS.map((test) => {
                const { started, completed, failed } = getTestStatus(test.id);

                return (
                  <div key={test.id} className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 text-xs">{test.title}</span>
                      <button
                        onClick={() => onExecuteAction(test.payload)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/40 rounded-md font-medium transition-colors cursor-pointer text-[11px]"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Testar</span>
                      </button>
                    </div>

                    <pre className="p-1.5 bg-slate-900/90 rounded text-[10px] font-mono text-sky-300 overflow-x-auto border border-slate-800/80">
                      {JSON.stringify(test.payload, null, 2)}
                    </pre>

                    <div className="flex items-center gap-3 text-[10.5px] font-mono">
                      <div className="flex items-center gap-1">
                        {started ? <CheckCircle2 className="w-3 h-3 text-sky-400" /> : <CircleDot className="w-3 h-3 text-slate-600" />}
                        <span className={started ? 'text-sky-300' : 'text-slate-500'}>started</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {completed ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : failed ? (
                          <X className="w-3 h-3 text-rose-400" />
                        ) : (
                          <CircleDot className="w-3 h-3 text-slate-600" />
                        )}
                        <span className={completed ? 'text-emerald-300' : failed ? 'text-rose-400' : 'text-slate-500'}>
                          {failed ? 'failed' : 'completed'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Chat & Agent Simulator */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-slate-300 font-medium text-xs block">Simulação de Streaming do Python</span>
              <button
                onClick={simulateChatStream}
                className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors cursor-pointer shadow-md"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Simular Resposta Completa em Streaming</span>
              </button>
              <p className="text-[10.5px] text-slate-400 leading-relaxed">
                Dispara <code className="text-sky-300 font-mono">chat.started</code>, deltas parciais com <code className="text-sky-300 font-mono">chat.delta</code> e finaliza com <code className="text-sky-300 font-mono">chat.completed</code>.
              </p>
            </div>

            {/* Status Simulators */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-slate-400 font-medium text-[11px] block">Simular Evento agent.status</span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => onExecuteAction({ type: 'agent.status', agent_id: activeAgent.id, status: 'thinking' })}
                  className="py-1.5 px-2 bg-purple-950/50 hover:bg-purple-900/50 text-purple-300 border border-purple-800 rounded-lg text-center cursor-pointer truncate"
                >
                  thinking
                </button>
                <button
                  onClick={() => onExecuteAction({ type: 'agent.status', agent_id: activeAgent.id, status: 'speaking' })}
                  className="py-1.5 px-2 bg-sky-950/50 hover:bg-sky-900/50 text-sky-300 border border-sky-800 rounded-lg text-center cursor-pointer truncate"
                >
                  speaking
                </button>
                <button
                  onClick={() => onExecuteAction({ type: 'agent.status', agent_id: activeAgent.id, status: 'working' })}
                  className="py-1.5 px-2 bg-amber-950/50 hover:bg-amber-900/50 text-amber-300 border border-amber-800 rounded-lg text-center cursor-pointer truncate"
                >
                  working
                </button>
                <button
                  onClick={() => onExecuteAction({ type: 'agent.status', agent_id: activeAgent.id, status: 'moving' })}
                  className="py-1.5 px-2 bg-cyan-950/50 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-800 rounded-lg text-center cursor-pointer truncate"
                >
                  moving
                </button>
                <button
                  onClick={() => onExecuteAction({ type: 'agent.status', agent_id: activeAgent.id, status: 'idle' })}
                  className="py-1.5 px-2 bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800 rounded-lg text-center cursor-pointer truncate"
                >
                  idle
                </button>
                <button
                  onClick={() => onExecuteAction({ type: 'agent.status', agent_id: activeAgent.id, status: 'error' })}
                  className="py-1.5 px-2 bg-rose-950/50 hover:bg-rose-900/50 text-rose-300 border border-rose-800 rounded-lg text-center cursor-pointer truncate"
                >
                  error
                </button>
              </div>
            </div>

            {/* Agent List Sync Simulator */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-slate-400 font-medium text-[11px] block">Simular Sincronização de Lista (agent.list)</span>
              <button
                onClick={() =>
                  onExecuteAction({
                    type: 'agent.list',
                    agents: [
                      { id: 'agent-01', name: 'Agent Alpha', role: 'Estrategista Líder', status: 'online' },
                      { id: 'agent-02', name: 'Agent Beta', role: 'Engenheiro de Dados', status: 'idle' },
                      { id: 'agent-03', name: 'Agent Gamma', role: 'Revisor de Código', status: 'working' },
                      { id: 'agent-04', name: 'Agent Delta', role: 'Pesquisador Web', status: 'thinking' },
                    ],
                  })
                }
                className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-center cursor-pointer"
              >
                Injetar Lista com 4 Agentes
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Manual Controls */}
        {activeTab === 'triggers' && (
          <div className="space-y-3">
            <button
              onClick={() => triggerAction('stop')}
              className="w-full flex items-center justify-center gap-2 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-lg font-medium transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>stop (Parar tudo)</span>
            </button>

            <div className="space-y-1">
              <span className="text-slate-400 text-[11px]">move_to</span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => triggerAction('move_to', { target: { x: 2, y: 0, z: -2 }, speed: 2.0 })}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-center truncate cursor-pointer"
                >
                  (2, 0, -2)
                </button>
                <button
                  onClick={() => triggerAction('move_to', { target: { x: -2, y: 0, z: 1 }, speed: 2.0 })}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-center truncate cursor-pointer"
                >
                  (-2, 0, 1)
                </button>
                <button
                  onClick={() => triggerAction('move_to', { target: { x: 0, y: 0, z: 0 }, speed: 2.5 })}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-center truncate cursor-pointer"
                >
                  (0, 0, 0)
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[11px]">play_animation</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => triggerAction('play_animation', { animation: 'wave', duration: 3.0 })}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-center cursor-pointer"
                >
                  wave (3s)
                </button>
                <button
                  onClick={() => triggerAction('play_animation', { animation: 'talk', duration: 4.0 })}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-center cursor-pointer"
                >
                  talk (4s)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Custom JSON */}
        {activeTab === 'json' && (
          <div className="space-y-3">
            <p className="text-slate-400 text-[11px]">
              Envie qualquer mensagem JSON estruturada diretamente para o frontend:
            </p>
            <textarea
              rows={9}
              value={customJson}
              onChange={(e) => setCustomJson(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-sky-300 font-mono focus:outline-none focus:border-sky-500 leading-relaxed"
            />
            <button
              onClick={handleSendCustomJson}
              className="w-full flex items-center justify-center gap-2 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Executar JSON</span>
            </button>
          </div>
        )}

        {/* Tab 5: Logs */}
        {activeTab === 'logs' && (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Nenhum evento registrado até o momento.
              </div>
            ) : (
              <div className="space-y-2 font-mono">
                {[...logs].reverse().map((log) => (
                  <div
                    key={log.id}
                    className={`p-2 rounded-lg border text-[10.5px] ${
                      log.direction === 'in'
                        ? 'bg-sky-950/40 border-sky-800/60 text-sky-200'
                        : log.direction === 'out'
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 opacity-75">
                      <span className="font-semibold">
                        {log.direction === 'in' ? '▲ RECEBIDO (Python)' : log.direction === 'out' ? '▼ ENVIADO' : '● SISTEMA'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span>{log.timestamp}</span>
                        <button
                          onClick={() => copyToClipboard(log.rawText || JSON.stringify(log.payload), log.id)}
                          className="hover:text-white p-0.5 cursor-pointer"
                          title="Copiar JSON"
                        >
                          {copiedLogId === log.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all max-h-32 text-[10px]">
                      {typeof log.payload === 'object' ? JSON.stringify(log.payload, null, 2) : String(log.payload)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
