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
import {
  ConnectionStatus,
  LogEntry,
  RuntimeStatusMessage,
  BotConfig,
  AudioInputMessage,
  AudioOutputMessage,
  VisionResponseMessage,
  NotificationMessage,
  StateUpdateMessage,
  CDITimelineEventMessage,
  ConfigDataMessage,
  SceneSetMessage,
  MemoryGalleryMessage,
  CDIListMessage,
  PeerBusEventMessage,
} from './types/protocol';
import { VoiceLipSyncManager } from './core/VoiceLipSyncManager';
import { VisionManager } from './core/VisionManager';
import { VisionOverlay } from './components/VisionOverlay';
import { OfflineSyncManager } from './core/OfflineSyncManager';
import { OfflineIndicator } from './components/OfflineIndicator';
import { NotificationManager } from './core/NotificationManager';
import { NotificationToastContainer } from './components/NotificationToastContainer';
import { WakeWordManager } from './core/WakeWordManager';
import { CDITimelineStore } from './core/CDITimelineStore';
import { CDITimelineOverlay } from './components/CDITimelineOverlay';
import { CDIConfigManager } from './core/CDIConfigManager';
import { Scene3DManager } from './core/Scene3DManager';
import { SceneSoundtrackManager } from './core/SceneSoundtrackManager';
import { CDIMemoryGalleryStore } from './core/CDIMemoryGalleryStore';
import { CDIMemoryGalleryModal } from './components/CDIMemoryGalleryModal';
import { MultiCDIManager } from './core/MultiCDIManager';
import { PeerBusDialogueOverlay } from './components/PeerBusDialogueOverlay';
import { CyberSidebar } from './components/CyberSidebar';

export default function App() {
  // 1. Core Managers (Singletons)
  const connectionRef = useRef<AgentConnection>(new AgentConnection());
  const worldStateRef = useRef<WorldState>(new WorldState());
  const messageStoreRef = useRef<MessageStore>(new MessageStore());
  const conversationManagerRef = useRef<ConversationManager>(
    new ConversationManager(connectionRef.current, messageStoreRef.current)
  );
  const agentManagerRef = useRef<AgentManager>(new AgentManager(connectionRef.current));
  const voiceManagerRef = useRef<VoiceLipSyncManager>(new VoiceLipSyncManager());
  const visionManagerRef = useRef<VisionManager>(new VisionManager());
  const offlineSyncManagerRef = useRef<OfflineSyncManager>(new OfflineSyncManager());
  const notificationManagerRef = useRef<NotificationManager>(new NotificationManager());
  const wakeWordManagerRef = useRef<WakeWordManager>(new WakeWordManager());
  const timelineStoreRef = useRef<CDITimelineStore>(new CDITimelineStore());
  const configManagerRef = useRef<CDIConfigManager>(new CDIConfigManager(connectionRef.current));
  const soundtrackManagerRef = useRef<SceneSoundtrackManager>(new SceneSoundtrackManager());
  const memoryGalleryStoreRef = useRef<CDIMemoryGalleryStore>(
    new CDIMemoryGalleryStore(connectionRef.current)
  );
  const multiCDIManagerRef = useRef<MultiCDIManager>(new MultiCDIManager(connectionRef.current));

  const avatarControllerRef = useRef<AvatarController | null>(null);
  const actionExecutorRef = useRef<ActionExecutor | null>(null);

  // 2. State
  const [scene3DManager, setScene3DManager] = useState<Scene3DManager | null>(null);
  const [currentAffect, setCurrentAffect] = useState<string>('wondering');
  const [isMemoryGalleryOpen, setIsMemoryGalleryOpen] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

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
  const [isVisionOpen, setIsVisionOpen] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(false);
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
        } else if (msg.type === 'audio.output') {
          const audioMsg = data as AudioOutputMessage;
          voiceManagerRef.current.playAudioOutput(audioMsg);
          if (audioMsg.text) {
            msgStore.addMessage(activeAgent.id, {
              id: audioMsg.id || `audio_${Date.now()}`,
              role: 'agent',
              content: audioMsg.text,
              timestamp: Date.now(),
              agentId: activeAgent.id,
              status: 'completed',
            });
          }
        } else if (msg.type === 'vision.response') {
          const visionMsg = data as VisionResponseMessage;
          visionManagerRef.current.handleVisionResponse(visionMsg);

          if (visionMsg.reaction_expression && avatarControllerRef.current) {
            avatarControllerRef.current.setExpression(visionMsg.reaction_expression, 1.0);
          } else if (visionMsg.emotion_detected && avatarControllerRef.current) {
            avatarControllerRef.current.setExpression(visionMsg.emotion_detected, 1.0);
          }

          if (visionMsg.reaction_animation && avatarControllerRef.current) {
            avatarControllerRef.current.setAnimation(visionMsg.reaction_animation);
          }

          if (visionMsg.description) {
            msgStore.addMessage(activeAgent.id, {
              id: visionMsg.id || `vis_${Date.now()}`,
              role: 'agent',
              content: `👁️ [Visão]: "${visionMsg.description}" (Emoção: ${visionMsg.emotion_detected || 'neutra'})`,
              timestamp: Date.now(),
              agentId: activeAgent.id,
              status: 'completed',
            });
          }
        } else if (msg.type === 'notification') {
          const notifMsg = data as NotificationMessage;
          notificationManagerRef.current.handleNotification(notifMsg);

          msgStore.addMessage(activeAgent.id, {
            id: notifMsg.id || `notif_${Date.now()}`,
            role: 'system',
            content: `🔔 [${notifMsg.title}]: "${notifMsg.body}"`,
            timestamp: Date.now(),
            agentId: activeAgent.id,
            status: 'completed',
          });
        } else if (msg.type === 'state.update') {
          const stateMsg = data as StateUpdateMessage;
          if (stateMsg.data) {
            timelineStoreRef.current.updateBiometrics(stateMsg.data);
          }
        } else if (msg.type === 'timeline.event') {
          const timelineMsg = data as CDITimelineEventMessage;
          if (timelineMsg.event) {
            timelineStoreRef.current.addTimelineEvent(timelineMsg.event);
          }
        } else if (msg.type === 'config.data') {
          const configMsg = data as ConfigDataMessage;
          configManagerRef.current.handleIncomingConfig(configMsg);
        } else if (msg.type === 'scene.set') {
          const sceneMsg = data as SceneSetMessage;
          scene3DManager?.handleSceneSetMessage(sceneMsg);
        } else if (msg.type === 'memory.gallery') {
          const galleryMsg = data as MemoryGalleryMessage;
          memoryGalleryStoreRef.current.handleIncomingMemories(galleryMsg.memories);
        } else if (msg.type === 'cdi.list') {
          const listMsg = data as CDIListMessage;
          multiCDIManagerRef.current.handleIncomingCDIList(listMsg.cdis);
        } else if (msg.type === 'peer_bus.event') {
          const peerMsg = data as PeerBusEventMessage;
          multiCDIManagerRef.current.handleIncomingPeerBusEvent(peerMsg);
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

  // Keep camera streaming state updated
  useEffect(() => {
    return visionManagerRef.current.subscribe((vState) => {
      setIsCameraActive(vState.isStreaming);
    });
  }, []);

  // Frame capture pipeline: WebSocket forward to Python runtime or fallback to gateway AI
  useEffect(() => {
    const visionMgr = visionManagerRef.current;
    const connection = connectionRef.current;

    visionMgr.setOnFrameCaptured(async (frame) => {
      // 1. Send vision.frame over WebSocket to Python CDI
      connection.send({
        ...frame,
        agent_id: activeAgent.id,
      });

      // 2. Fallback to server-side Gemini multimodal if Python runtime is not connected
      if (!isRuntimeConnected) {
        try {
          const res = await fetch('/api/vision/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: frame.data, format: frame.format }),
          });

          if (res.ok) {
            const result = await res.json();
            const visionResp: VisionResponseMessage = {
              type: 'vision.response',
              id: frame.id,
              description: result.description,
              emotion_detected: result.emotion_detected,
              reaction_expression: result.reaction_expression,
              reaction_animation: result.reaction_animation,
              agent_id: activeAgent.id,
            };

            visionMgr.handleVisionResponse(visionResp);

            if (result.reaction_expression && avatarControllerRef.current) {
              avatarControllerRef.current.setExpression(result.reaction_expression, 1.0);
            }
            if (result.reaction_animation && avatarControllerRef.current) {
              avatarControllerRef.current.setAnimation(result.reaction_animation);
            }

            if (result.description) {
              messageStoreRef.current.addMessage(activeAgent.id, {
                id: frame.id,
                role: 'agent',
                content: `👁️ [Visão]: "${result.description}" (Emoção: ${result.emotion_detected || 'neutra'})`,
                timestamp: Date.now(),
                agentId: activeAgent.id,
                status: 'completed',
              });
            }
          }
        } catch (err) {
          console.warn('[Vision] Erro ao analisar frame:', err);
        }
      }
    });
  }, [activeAgent.id, isRuntimeConnected]);

  // Offline sync queue flush handler
  useEffect(() => {
    offlineSyncManagerRef.current.setFlushHandler(async (queued) => {
      const conn = connectionRef.current;
      if (conn.getStatus() !== 'connected') {
        conn.reconnect();
      }
      for (const msg of queued) {
        conn.send(msg);
      }
      return true;
    });
  }, []);

  // Save last known CDI state to local storage for offline continuity
  useEffect(() => {
    offlineSyncManagerRef.current.saveLastCDIState({
      agentId: activeAgent.id,
      agentName: activeAgent.name,
      modelName,
      expression: worldState.expression,
      animation: worldState.animation,
      messageCount: messages.length,
      lastActive: Date.now(),
    });
  }, [activeAgent, modelName, worldState.expression, worldState.animation, messages.length]);

  // Notification reply action handler
  useEffect(() => {
    notificationManagerRef.current.setOnReplyHandler((notif) => {
      if (notif.agent_id && notif.agent_id !== activeAgent.id) {
        agentManagerRef.current.selectAgent(notif.agent_id);
      }
      const chatInput = document.querySelector('textarea, input[placeholder*="mensagem"]') as HTMLInputElement | null;
      if (chatInput) {
        chatInput.focus();
      }
    });
  }, [activeAgent.id]);

  // Wake Word Detection Callback & Agent Name Sync ("Ei Kairós")
  useEffect(() => {
    wakeWordManagerRef.current.setAgentName(activeAgent.name);
    configManagerRef.current.setAgentId(activeAgent.id);
    memoryGalleryStoreRef.current.setAgentId(activeAgent.id);

    wakeWordManagerRef.current.setOnWakeCallback((wakeMsg) => {
      console.log(`[Wake Word Protocol] Emitindo wake.detected: "${wakeMsg.word}"`);

      // 1. Send wake.detected over WebSocket
      connectionRef.current.send(wakeMsg);

      // 2. Avatar physical reaction (perk up, smile, nod)
      if (avatarControllerRef.current) {
        avatarControllerRef.current.setExpression('happy', 1.0);
        avatarControllerRef.current.setAnimation('nod');
      }

      // 3. Record in conversation memory
      messageStoreRef.current.addMessage(activeAgent.id, {
        id: `wake_${Date.now()}`,
        role: 'user',
        content: `⚡ [Wake Word]: "Ei ${wakeMsg.word}"`,
        timestamp: Date.now(),
        agentId: activeAgent.id,
        status: 'completed',
      });

      // 4. Automatically open audio connection / voice recording so user can speak immediately
      try {
        voiceManagerRef.current.startRecording();
      } catch (err) {
        console.warn('Falha ao iniciar gravação de voz após wake word:', err);
      }
    });
  }, [activeAgent.name, activeAgent.id]);

  // Automatic 3D Scene Synchronization based on CDI Affect / Mode
  useEffect(() => {
    return timelineStoreRef.current.subscribe((timelineState) => {
      const affect = timelineState.biometrics.affect || 'wondering';
      const mode = timelineState.biometrics.mode || 'awake';
      setCurrentAffect(affect);

      if (scene3DManager) {
        scene3DManager.handleCDIAffectChange(affect, mode, worldState.isSpeaking);
      }
    });
  }, [scene3DManager, worldState.isSpeaking]);

  // 7. Handlers
  const handleAvatarReady = useCallback(
    (controller: AvatarController, executor: ActionExecutor) => {
      avatarControllerRef.current = controller;
      actionExecutorRef.current = executor;
      voiceManagerRef.current.setAvatarController(controller);

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

      // If offline or disconnected from Gateway, queue message for background sync
      if (!offlineSyncManagerRef.current.getIsOnline() || status !== 'connected') {
        offlineSyncManagerRef.current.enqueueMessage({
          type: 'chat.message',
          id: `msg_offline_${Date.now()}`,
          text,
          agent_id: activeAgent.id,
        });
      }
    },
    [activeAgent.id, status]
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

  const handleSendAudio = useCallback(
    (audio: { format: string; data: string; duration: number }) => {
      const connection = connectionRef.current;
      const msgStore = messageStoreRef.current;
      const audioId = `audio_in_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // Record speech visually in conversation
      msgStore.addMessage(activeAgent.id, {
        id: audioId,
        role: 'user',
        content: `🎙️ [Áudio de Voz - ${audio.duration.toFixed(1)}s]`,
        timestamp: Date.now(),
        agentId: activeAgent.id,
        status: 'completed',
      });

      const audioMsg: AudioInputMessage = {
        type: 'audio.input',
        id: audioId,
        format: audio.format || 'webm',
        data: audio.data,
        agent_id: activeAgent.id,
      };

      // Send or queue audio.input
      if (!offlineSyncManagerRef.current.getIsOnline() || status !== 'connected') {
        offlineSyncManagerRef.current.enqueueMessage(audioMsg);
      } else {
        connection.send(audioMsg);
      }
    },
    [activeAgent, status]
  );

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
          soundtrackManager={soundtrackManagerRef.current}
          multiCDIManager={multiCDIManagerRef.current}
          onAvatarControllerReady={handleAvatarReady}
          onScene3DManagerReady={(mgr) => setScene3DManager(mgr)}
          onModelLoaded={handleModelLoaded}
          onDropFile={handleLoadFile}
        />
      </div>

      {/* 2. Floating Minimal Single-Button Navigation Header */}
      <HeaderOverlay
        status={status}
        activeAgent={activeAgent}
        isRuntimeConnected={isRuntimeConnected}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        multiCDIManager={multiCDIManagerRef.current}
      />

      {/* 2.0 Cyberpunk Responsive Sliding Command Center Sidebar */}
      <CyberSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        status={status}
        isRuntimeConnected={isRuntimeConnected}
        activeAgent={activeAgent}
        multiCDIManager={multiCDIManagerRef.current}
        scene3DManager={scene3DManager}
        soundtrackManager={soundtrackManagerRef.current}
        wakeWordManager={wakeWordManagerRef.current}
        activeAffect={currentAffect}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenMemoryGallery={() => setIsMemoryGalleryOpen(true)}
        onOpenTimeline={() => setIsTimelineOpen(true)}
        onToggleVision={() => setIsVisionOpen((prev) => !prev)}
        isVisionOpen={isVisionOpen}
        onSelectAgent={handleSelectAgent}
      />

      {/* 2.1 Cyberpunk Offline Status & Sync HUD Indicator */}
      <OfflineIndicator offlineSyncManager={offlineSyncManagerRef.current} />

      {/* 2.2 Cyberpunk Optic Camera Viewfinder Overlay */}
      <VisionOverlay
        visionManager={visionManagerRef.current}
        isOpen={isVisionOpen}
        onClose={() => setIsVisionOpen(false)}
        onSnapshot={() => visionManagerRef.current.captureFrame()}
      />

      {/* 2.3 Cyberpunk Real-Time Telemetry & Timeline Overlay */}
      <CDITimelineOverlay
        timelineStore={timelineStoreRef.current}
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        agentName={activeAgent.name}
      />

      {/* 2.4 Cyberpunk Visual Memory & Artifact Gallery Modal */}
      <CDIMemoryGalleryModal
        isOpen={isMemoryGalleryOpen}
        onClose={() => setIsMemoryGalleryOpen(false)}
        galleryStore={memoryGalleryStoreRef.current}
        agentName={activeAgent.name}
      />

      {/* 2.5 Cyberpunk Inter-CDI Peer Bus Dialogue Balloons */}
      <PeerBusDialogueOverlay multiCDIManager={multiCDIManagerRef.current} />

      {/* 2.3 Cyberpunk Holographic Notification Toasts (CDI Triggers) */}
      <NotificationToastContainer notificationManager={notificationManagerRef.current} />

      {/* 3. Floating Bottom Companion Chat & Speech Overlay */}
      <CompanionChatOverlay
        activeAgent={activeAgent}
        messages={messages}
        onSendMessage={handleSendMessage}
        onSendAudio={handleSendAudio}
        voiceManager={voiceManagerRef.current}
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

      {/* 5. Comprehensive Centralized Settings Page with VRM Database & CDI Triggers */}
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
        notificationManager={notificationManagerRef.current}
        configManager={configManagerRef.current}
      />
    </main>
  );
}
