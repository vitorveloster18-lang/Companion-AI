/**
 * Agent Runtime Interface: Main Application
 * Modern 3D Avatar companion with Persistent VRM Database, Telegram-style Bots, and Clutter-free UI.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AgentConnection } from './core/AgentConnection';
import { WorldState, AvatarState } from './core/WorldState';
import { AvatarController } from './core/AvatarController';
import { ActionExecutor } from './core/ActionExecutor';
import { vrmStorage } from './core/VRMStorage';
import { MessageStore } from './conversation/MessageStore';
import { ConversationManager } from './conversation/ConversationManager';
import { AgentManager } from './agents/AgentManager';
import { Agent } from './agents/AgentTypes';
import { Message } from './conversation/ConversationTypes';
import { SceneViewport } from './components/SceneViewport';
import { HeaderOverlay } from './components/HeaderOverlay';
import { AgentSelector } from './components/AgentSelector';
import { SettingsModal } from './components/SettingsModal';
import { CompanionChatOverlay } from './components/CompanionChatOverlay';
import { ConnectionStatus, LogEntry, RuntimeStatusMessage, BotConfig } from './types/protocol';

export default function App() {
  // 1. Core Managers (Singletons)
  const connectionRef = useRef<AgentConnection>(new AgentConnection());
  const worldStateRef = useRef<WorldState>(new WorldState());
  const messageStoreRef = useRef<MessageStore>(new MessageStore());
  const conversationManagerRef = useRef<ConversationManager>(
    new ConversationManager(connectionRef.current, messageStoreRef.current)
  );
  const agentManagerRef = useRef<AgentManager>(new AgentManager(connectionRef.current));

  const avatarControllerRef = useRef<AvatarController | null>(null);
  const actionExecutorRef = useRef<ActionExecutor | null>(null);

  // 2. State
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [serverUrl, setServerUrl] = useState<string>(connectionRef.current.getUrl());
  const [isRuntimeConnected, setIsRuntimeConnected] = useState<boolean>(false);
  const [modelName, setModelName] = useState<string>('Humanóide Padrão');
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  const [savedVRMs, setSavedVRMs] = useState<Array<{ id: string; name: string; size: number; updatedAt: number }>>([]);

  const [agents, setAgents] = useState<Agent[]>(agentManagerRef.current.getAgents());
  const [activeAgent, setActiveAgent] = useState<Agent>(agentManagerRef.current.getActiveAgent());
  const [messages, setMessages] = useState<Message[]>(messageStoreRef.current.getMessages());
  const [bots, setBots] = useState<BotConfig[]>([]);

  const [isAgentSelectorOpen, setIsAgentSelectorOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [worldState, setWorldState] = useState<AvatarState>(worldStateRef.current.getState());

  // 3. Database: Refresh Saved VRM Models
  const refreshSavedVRMs = useCallback(async () => {
    try {
      const list = await vrmStorage.listModels();
      setSavedVRMs(list);
    } catch (err) {
      console.warn('[App] Erro ao listar modelos VRM do banco:', err);
    }
  }, []);

  // 4. Fetch bots list on mount
  const refreshBots = useCallback(async () => {
    try {
      const res = await fetch('/api/bots');
      if (res.ok) {
        const list: BotConfig[] = await res.json();
        setBots(list);
        agentManagerRef.current.setBots(list);
      }
    } catch (err) {
      console.warn('Erro ao carregar bots:', err);
    }
  }, []);

  // 5. Restore saved VRM from IndexedDB database once avatar controller is initialized
  const restoreSavedVRMModel = useCallback(async () => {
    try {
      const activeSaved = await vrmStorage.getActiveModel();
      if (activeSaved && avatarControllerRef.current) {
        console.log(`[VRM Database] Restaurando modelo salvo do banco: "${activeSaved.name}"...`);
        avatarControllerRef.current.loadVRM(activeSaved.url, activeSaved.name);
        setModelName(activeSaved.name);
        setIsCustomModel(true);
      }
    } catch (err) {
      console.warn('[VRM Database] Falha ao restaurar modelo salvo:', err);
    }
  }, []);

  // 6. Subscriptions & Initialization
  useEffect(() => {
    const connection = connectionRef.current;
    const wsState = worldStateRef.current;
    const msgStore = messageStoreRef.current;
    const agentMgr = agentManagerRef.current;

    refreshBots();
    refreshSavedVRMs();

    // WebSocket status listener
    const unsubStatus = connection.onStatusChange((newStatus, url) => {
      setStatus(newStatus);
      setServerUrl(url);

      if (newStatus === 'disconnected' || newStatus === 'error') {
        setIsRuntimeConnected(false);
      }
    });

    // Handle runtime and bot status notifications from Gateway
    const unsubMessage = connection.onMessage((data: unknown) => {
      if (data && typeof data === 'object') {
        const msg = data as Record<string, unknown>;

        if (msg.type === 'runtime.status') {
          const runtimeMsg = data as RuntimeStatusMessage;
          setIsRuntimeConnected(Boolean(runtimeMsg.connected));
        } else if (msg.type === 'bot.list') {
          const botList = msg.bots as BotConfig[];
          if (Array.isArray(botList)) {
            setBots(botList);
            agentMgr.setBots(botList);
          }
        } else if (msg.type === 'bot.status') {
          const { bot_id, is_online } = msg as { bot_id?: string; is_online?: boolean };
          if (bot_id) {
            setBots((prev) =>
              prev.map((b) => (b.id === bot_id ? { ...b, is_online: Boolean(is_online) } : b))
            );
          }
        }
      }
    });

    // WebSocket activity log listener
    const unsubLog = connection.onLog((entry) => {
      setLogs((prev) => {
        const next = [...prev, entry];
        if (next.length > 200) next.shift();
        return next;
      });
    });

    // 3D World state listener
    const unsubWorld = wsState.subscribe((state) => {
      setWorldState(state);
    });

    // Conversation message store listener
    const unsubMessages = msgStore.subscribe((msgs) => {
      setMessages(msgs);
    });

    // Agent list and active agent listener
    const unsubAgents = agentMgr.subscribe((agentList, currentActive) => {
      setAgents(agentList);
      setActiveAgent(currentActive);
      msgStore.setActiveAgentId(currentActive.id);
    });

    // Connect to WebSocket gateway on mount
    connection.connect();

    return () => {
      unsubStatus();
      unsubMessage();
      unsubLog();
      unsubWorld();
      unsubMessages();
      unsubAgents();
      connection.disconnect();
    };
  }, [refreshBots, refreshSavedVRMs]);

  // 7. Handlers
  const handleAvatarReady = useCallback(
    (controller: AvatarController, executor: ActionExecutor) => {
      avatarControllerRef.current = controller;
      actionExecutorRef.current = executor;

      // Automatically restore active saved VRM from IndexedDB database
      restoreSavedVRMModel();
    },
    [restoreSavedVRMModel]
  );

  const handleModelLoaded = useCallback((name: string) => {
    setModelName(name);
    setIsCustomModel(true);
  }, []);

  // Save VRM to database and load into scene
  const handleLoadFile = useCallback(
    async (file: File) => {
      if (!avatarControllerRef.current) return;

      try {
        // 1. Save permanently to IndexedDB database
        const { url } = await vrmStorage.saveModel(file, file.name);

        // 2. Load into 3D scene
        avatarControllerRef.current.loadVRM(url, file.name);
        setModelName(file.name);
        setIsCustomModel(true);

        // 3. Refresh saved models list
        await refreshSavedVRMs();

        // 4. Send background backup to server storage (non-blocking)
        const reader = new FileReader();
        reader.onload = async () => {
          if (typeof reader.result === 'string') {
            const base64Data = reader.result.split(',')[1];
            try {
              await fetch('/api/models/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: file.name, base64Data }),
              });
            } catch {}
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('[VRM Database] Falha ao salvar modelo:', err);
      }
    },
    [refreshSavedVRMs]
  );

  const handleSelectSavedVRM = useCallback(async (id: string) => {
    if (!avatarControllerRef.current) return;
    try {
      const active = await vrmStorage.setActiveModelId(id);
      if (active) {
        avatarControllerRef.current.loadVRM(active.url, active.name);
        setModelName(active.name);
        setIsCustomModel(true);
      }
    } catch (err) {
      console.error('[VRM Database] Falha ao alternar modelo salvo:', err);
    }
  }, []);

  const handleDeleteSavedVRM = useCallback(
    async (id: string) => {
      try {
        await vrmStorage.deleteModel(id);
        await refreshSavedVRMs();
      } catch (err) {
        console.error('[VRM Database] Erro ao deletar modelo:', err);
      }
    },
    [refreshSavedVRMs]
  );

  const handleResetToDefaultModel = useCallback(async () => {
    try {
      await vrmStorage.clearAll();
      if (avatarControllerRef.current) {
        avatarControllerRef.current.loadDefaultMannequin();
      }
      setModelName('Humanóide Padrão');
      setIsCustomModel(false);
      await refreshSavedVRMs();
    } catch (err) {
      console.error('[VRM Database] Erro ao resetar modelo:', err);
    }
  }, [refreshSavedVRMs]);

  const handleSendMessage = useCallback(
    (text: string) => {
      conversationManagerRef.current.sendMessage(text, activeAgent.id);
    },
    [activeAgent.id]
  );

  const handleClearHistory = useCallback(() => {
    messageStoreRef.current.clearHistory(activeAgent.id);
  }, [activeAgent.id]);

  const handleSelectAgent = useCallback((agentId: string) => {
    agentManagerRef.current.selectAgent(agentId);
  }, []);

  const handleBotCreated = useCallback(
    (newBot: BotConfig) => {
      setBots((prev) => [...prev, newBot]);
      agentManagerRef.current.setBots([...bots, newBot]);
      agentManagerRef.current.selectAgent(newBot.id);
    },
    [bots]
  );

  const handleBotDeleted = useCallback(
    (botId: string) => {
      setBots((prev) => prev.filter((b) => b.id !== botId));
      refreshBots();
    },
    [refreshBots]
  );

  const handleBotTokenRegenerated = useCallback(
    (updatedBot: BotConfig) => {
      setBots((prev) => prev.map((b) => (b.id === updatedBot.id ? updatedBot : b)));
      refreshBots();
    },
    [refreshBots]
  );

  const handleExecuteAction = useCallback((action: unknown) => {
    if (action && typeof action === 'object' && (action as { type?: string }).type === 'action') {
      if (actionExecutorRef.current) {
        actionExecutorRef.current.handleIncomingMessage(action);
      }
    } else if (action && typeof action === 'object' && (action as { type?: string }).type?.startsWith('chat.')) {
      conversationManagerRef.current.handleIncomingMessage(action);
    } else if (action && typeof action === 'object' && (action as { type?: string }).type?.startsWith('agent.')) {
      agentManagerRef.current.handleIncomingMessage(action);
    }
  }, []);

  const handleReconnect = useCallback(() => {
    connectionRef.current.reconnect();
    refreshBots();
    refreshSavedVRMs();
  }, [refreshBots, refreshSavedVRMs]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* 1. Full-Screen Immersive 3D Avatar Viewport */}
      <div className="absolute inset-0 z-0">
        <SceneViewport
          connection={connectionRef.current}
          worldState={worldStateRef.current}
          onAvatarControllerReady={handleAvatarReady}
          onModelLoaded={handleModelLoaded}
          onDropFile={handleLoadFile}
        />
      </div>

      {/* 2. Floating Minimal Top Navigation Bar */}
      <HeaderOverlay
        status={status}
        activeAgent={activeAgent}
        isRuntimeConnected={isRuntimeConnected}
        onOpenAgentSelector={() => setIsAgentSelectorOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 3. Floating Bottom Companion Chat & Speech Overlay */}
      <CompanionChatOverlay
        activeAgent={activeAgent}
        messages={messages}
        onSendMessage={handleSendMessage}
        onClearHistory={handleClearHistory}
        isGatewayConnected={status === 'connected'}
        isRuntimeConnected={isRuntimeConnected}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 4. Floating Agent / Bot Selector Modal */}
      <AgentSelector
        agents={agents}
        activeAgent={activeAgent}
        onSelectAgent={handleSelectAgent}
        onOpenBotManager={() => setIsSettingsOpen(true)}
        isOpen={isAgentSelectorOpen}
        onClose={() => setIsAgentSelectorOpen(false)}
      />

      {/* 5. Comprehensive Centralized Settings Page with VRM Database */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        bots={bots}
        activeAgent={activeAgent}
        onSelectAgent={handleSelectAgent}
        onBotCreated={handleBotCreated}
        onBotDeleted={handleBotDeleted}
        onBotTokenRegenerated={handleBotTokenRegenerated}
        modelName={modelName}
        isCustomModel={isCustomModel}
        savedVRMs={savedVRMs}
        onFileSelect={handleLoadFile}
        onSelectSavedVRM={handleSelectSavedVRM}
        onDeleteSavedVRM={handleDeleteSavedVRM}
        onResetToDefaultModel={handleResetToDefaultModel}
        status={status}
        serverUrl={serverUrl}
        isRuntimeConnected={isRuntimeConnected}
        onReconnect={handleReconnect}
        logs={logs}
        onExecuteAction={handleExecuteAction}
      />
    </main>
  );
}
