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
  DriveItem,
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

export interface CDIEmotionalStatePayload {
  affect?: string;
  affect_label?: string;
  valence?: number;
  arousal?: number;
  mode?: string;
  phase?: string;
  drives?: Record<string, number> | DriveItem[];
  top_drives?: DriveItem[];
  last_decision?: string;
}

/**
 * Automatically maps CDI emotional states (affect_label, drives, mode, last_decision)
 * to 3D avatar facial expressions, animations, visual aura, and gaze orientation.
 * Maintains natural dynamic idle breathing as the baseline when not actively interacting.
 */
let activeDecisionTimeout: any = null;

function applyCDIEmotionalState(
  payload: CDIEmotionalStatePayload,
  avatarController?: AvatarController | null,
  worldState?: WorldState | null
) {
  if (!avatarController) return;

  const rawAffect = (payload.affect || payload.affect_label || '').toLowerCase().trim();
  const decision = (payload.last_decision || '').trim().toUpperCase();
  const mode = (payload.mode || payload.phase || 'awake').toLowerCase().trim();

  let expression = 'neutral';
  let intensity = 0.4;
  let baseAnimation = 'idle';
  let lookTarget: { x: number; y: number; z: number } | null = { x: 0, y: 1.4, z: 2.8 };

  // ----------------------------------------------------
  // 1. EXPRESSÕES FACIAIS BASEADAS NO AFFECT
  // ----------------------------------------------------
  if (['wondering', 'curious', 'curioso', 'deslumbramento'].some((k) => rawAffect.includes(k))) {
    expression = 'surprised';
    intensity = 0.6;
  } else if (['happy', 'engaged', 'animado', 'alegre', 'content'].some((k) => rawAffect.includes(k))) {
    expression = 'happy';
    intensity = 0.8;
  } else if (['calm', 'relaxed', 'calmo', 'tranquilo', 'peaceful'].some((k) => rawAffect.includes(k))) {
    expression = 'neutral';
    intensity = 0.3;
  } else if (['grieving', 'grief', 'sad', 'triste', 'luto', 'melancholy'].some((k) => rawAffect.includes(k))) {
    expression = 'sad';
    intensity = 0.7;
    baseAnimation = 'idle_slow';
  } else if (['tense', 'angry', 'irritado', 'bravo', 'frustrated'].some((k) => rawAffect.includes(k))) {
    expression = 'angry';
    intensity = 0.5;
  } else if (['longing', 'saudade', 'nostalgia'].some((k) => rawAffect.includes(k))) {
    expression = 'sad';
    intensity = 0.5;
    baseAnimation = 'idle_slow';
  } else if (['playful', 'brincalhao', 'divertido'].some((k) => rawAffect.includes(k))) {
    expression = 'happy';
    intensity = 0.9;
  } else if (payload.valence !== undefined) {
    if (payload.valence > 0.3) {
      expression = 'happy';
      intensity = 0.7;
    } else if (payload.valence < -0.3) {
      expression = 'sad';
      intensity = 0.7;
      baseAnimation = 'idle_slow';
    }
  }

  // ----------------------------------------------------
  // 2. GAZE EPOSTURA BASEADA NOS DRIVES
  // ----------------------------------------------------
  let social = 0.5;
  let wonder = 0.5;
  let grief = 0.0;

  const extractDrive = (key: string, val: number) => {
    const k = key.toLowerCase();
    if (k.includes('social')) social = val;
    else if (k.includes('wonder') || k.includes('deslumbramento')) wonder = val;
    else if (k.includes('grief') || k.includes('luto')) grief = val;
  };

  if (payload.drives) {
    if (Array.isArray(payload.drives)) {
      for (const d of payload.drives) {
        if (d && typeof d === 'object') extractDrive(String(d.name || ''), Number(d.value ?? 0));
      }
    } else if (typeof payload.drives === 'object') {
      for (const [k, v] of Object.entries(payload.drives)) {
        extractDrive(k, Number(v ?? 0));
      }
    }
  }

  if (payload.top_drives && Array.isArray(payload.top_drives)) {
    for (const d of payload.top_drives) {
      if (d && typeof d === 'object') extractDrive(String(d.name || ''), Number(d.value ?? 0));
    }
  }

  if (social < 0.20) {
    lookTarget = { x: 1.2, y: 1.2, z: 1.8 }; // olhar tímido lateral
  } else if (wonder > 0.75) {
    lookTarget = { x: 0, y: 1.8, z: 2.2 }; // leve olhar elevado
  }

  if (grief > 0.60) {
    expression = 'sad';
    baseAnimation = 'idle_slow';
  }

  // ----------------------------------------------------
  // 3. COMPORTAMENTOS BASEADOS NO MODO (awake / sleep / dream)
  // ----------------------------------------------------
  if (mode.includes('sleep') || mode.includes('deep_sleep') || mode.includes('rem')) {
    avatarController.setMode('sleep');
    baseAnimation = 'sleep';
    expression = 'blink';
    intensity = 1.0;
  } else if (mode.includes('dream') || mode.includes('meditation')) {
    avatarController.setMode('dream');
    baseAnimation = 'dream';
    expression = 'relaxed';
    intensity = 0.8;
  } else {
    avatarController.setMode('awake');
  }

  // ----------------------------------------------------
  // 4. APLICAR AO AVATAR CONTROLLER E WORLD STATE
  // ----------------------------------------------------
  avatarController.setExpression(expression, intensity);
  worldState?.setExpression(expression, intensity);
  avatarController.setLookAt(lookTarget);

  // If a transient action decision occurred (e.g. INITIATE_CONTACT)
  if (decision && decision !== 'NONE' && decision !== 'IDLE') {
    let transientAnim = '';
    if (decision === 'INITIATE_CONTACT') {
      transientAnim = 'wave';
    } else if (decision === 'CREATE_ARTIFACT') {
      transientAnim = 'cheer';
    } else if (decision === 'EMERGENT_EXPLORE') {
      transientAnim = 'nod';
    }

    if (transientAnim && !worldState?.getState().isSpeaking) {
      if (activeDecisionTimeout) clearTimeout(activeDecisionTimeout);
      avatarController.setAnimation(transientAnim);
      worldState?.setAnimation(transientAnim);

      // Return smoothly to natural baseline idle after 3.5 seconds
      activeDecisionTimeout = setTimeout(() => {
        avatarController.setAnimation(baseAnimation);
        worldState?.setAnimation(baseAnimation);
      }, 3500);
      return;
    }
  }

  // Default baseline animation when not speaking or executing a transient gesture
  if (!worldState?.getState().isSpeaking) {
    avatarController.setAnimation(baseAnimation);
    worldState?.setAnimation(baseAnimation);
  }
}

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

  // Mode: 'runtime' (Python WebSocket) vs 'ai_studio' (Local test with Gemini)
  const [appMode, setAppMode] = useState<'runtime' | 'ai_studio'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('cdi_app_mode') as 'runtime' | 'ai_studio') || 'runtime';
    }
    return 'runtime';
  });
  const [aiStudioApiKey, setAiStudioApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cdi_ai_studio_api_key') || '';
    }
    return '';
  });
  const [aiStudioModel, setAiStudioModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cdi_ai_studio_model') || 'gemini-3.5-flash-lite';
    }
    return 'gemini-3.5-flash-lite';
  });

  const handleToggleAppMode = useCallback(() => {
    setAppMode((prev) => {
      const next = prev === 'runtime' ? 'ai_studio' : 'runtime';
      if (typeof window !== 'undefined') {
        localStorage.setItem('cdi_app_mode', next);
      }
      if (next === 'ai_studio') {
        // Disconnect WebSocket in AI Studio test mode
        connectionRef.current.disconnect();
      } else {
        // Reconnect WebSocket in Runtime mode
        connectionRef.current.reconnect();
      }
      return next;
    });
  }, []);

  const handleSaveAiStudioApiKey = useCallback((key: string) => {
    setAiStudioApiKey(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cdi_ai_studio_api_key', key);
    }
  }, []);

  const handleSaveAiStudioModel = useCallback((model: string) => {
    setAiStudioModel(model);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cdi_ai_studio_model', model);
    }
  }, []);

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
        multiCDIManagerRef.current.syncWithBots(list);
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
            multiCDIManagerRef.current.syncWithBots(botList);
          }
        } else if (msg.type === 'bot.status') {
          const { bot_id, is_online } = msg as { bot_id?: string; is_online?: boolean };
          if (bot_id) {
            setBots((prev) => {
              const next = prev.map((b) => (b.id === bot_id ? { ...b, is_online: Boolean(is_online) } : b));
              multiCDIManagerRef.current.syncWithBots(next);
              return next;
            });
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
          const stateMsg = data as StateUpdateMessage & {
            affect_label?: string;
            affect?: string;
            drives?: unknown;
            last_decision?: string;
            mode?: string;
          };
          if (stateMsg.data) {
            timelineStoreRef.current.updateBiometrics(stateMsg.data);
          }

          const emotionalPayload: CDIEmotionalStatePayload = {
            affect: stateMsg.data?.affect || stateMsg.affect || stateMsg.affect_label,
            valence: stateMsg.data?.valence,
            arousal: stateMsg.data?.arousal,
            mode: stateMsg.data?.mode || stateMsg.mode,
            phase: stateMsg.data?.phase,
            drives: (stateMsg.data?.drives || stateMsg.drives || stateMsg.data?.top_drives) as Record<string, number> | DriveItem[],
            top_drives: stateMsg.data?.top_drives,
            last_decision: stateMsg.data?.last_decision || stateMsg.last_decision,
          };

          applyCDIEmotionalState(
            emotionalPayload,
            avatarControllerRef.current,
            worldStateRef.current
          );
        } else if (msg.type === 'cdi.state' || msg.type === 'affect.update') {
          const raw = data as Record<string, unknown>;
          const dataSub = raw.data as Record<string, unknown> | undefined;
          const emotionalPayload: CDIEmotionalStatePayload = {
            affect: (dataSub?.affect || raw.affect || raw.affect_label) as string | undefined,
            valence: (dataSub?.valence ?? raw.valence) as number | undefined,
            arousal: (dataSub?.arousal ?? raw.arousal) as number | undefined,
            mode: (dataSub?.mode || raw.mode) as string | undefined,
            phase: (dataSub?.phase || raw.phase) as string | undefined,
            drives: (dataSub?.drives || raw.drives || dataSub?.top_drives) as Record<string, number> | DriveItem[],
            top_drives: (dataSub?.top_drives || raw.top_drives) as DriveItem[] | undefined,
            last_decision: (dataSub?.last_decision || raw.last_decision) as string | undefined,
          };
          applyCDIEmotionalState(
            emotionalPayload,
            avatarControllerRef.current,
            worldStateRef.current
          );
        } else if (msg.type === 'action') {
          actionExecutorRef.current?.handleIncomingMessage(msg);
        } else if (typeof msg.type === 'string' && msg.type.startsWith('chat.')) {
          conversationManagerRef.current.handleIncomingMessage(data);
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

  // Synchronize Speech State with Avatar LipSync and Animation
  useEffect(() => {
    conversationManagerRef.current.setOnSpeechStateChange((isSpeaking, textChunk) => {
      if (isSpeaking) {
        avatarControllerRef.current?.setSpeaking(true);
        avatarControllerRef.current?.setAnimation('talk');
        worldStateRef.current.setSpeaking(true);
        worldStateRef.current.setAnimation('talk');
        if (textChunk && textChunk.length > 0) {
          avatarControllerRef.current?.setAudioAmplitude(0.65);
        }
      } else {
        avatarControllerRef.current?.setSpeaking(false);
        avatarControllerRef.current?.setAnimation('idle');
        worldStateRef.current.setSpeaking(false);
        worldStateRef.current.setAnimation('idle');
      }
    });
  }, []);

  // Synchronize Python Runtime Connection State with MultiCDI
  useEffect(() => {
    multiCDIManagerRef.current.setRuntimeConnected(isRuntimeConnected);
  }, [isRuntimeConnected]);

  // Automatic 3D Scene Synchronization & Emotional State control based on CDI Affect / Drives
  useEffect(() => {
    return timelineStoreRef.current.subscribe((timelineState) => {
      const affect = timelineState.biometrics.affect || 'wondering';
      const mode = timelineState.biometrics.mode || 'awake';
      setCurrentAffect(affect);

      // Control 3D avatar expression and animation automatically
      applyCDIEmotionalState(
        {
          affect,
          valence: timelineState.biometrics.valence,
          arousal: timelineState.biometrics.arousal,
          mode,
          phase: timelineState.biometrics.phase,
          top_drives: timelineState.biometrics.top_drives,
          last_decision: timelineState.biometrics.last_decision,
        },
        avatarControllerRef.current,
        worldStateRef.current
      );

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
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (appMode === 'ai_studio') {
        const userMsgId = `usr_${Date.now()}`;
        const agentRespId = `resp_${Date.now()}`;
        const now = Date.now();

        // 1. Add user message
        messageStoreRef.current.addMessage(activeAgent.id, {
          id: userMsgId,
          role: 'user',
          content: trimmed,
          timestamp: now,
          agentId: activeAgent.id,
          status: 'completed',
        });

        // 2. Add placeholder agent message
        messageStoreRef.current.addMessage(activeAgent.id, {
          id: agentRespId,
          role: 'agent',
          content: '',
          timestamp: now + 1,
          agentId: activeAgent.id,
          status: 'sending',
        });

        try {
          const res = await fetch('/api/ai-studio/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: trimmed,
              history: messageStoreRef.current.getMessages(activeAgent.id),
              apiKey: aiStudioApiKey || undefined,
              model: aiStudioModel || 'gemini-3.5-flash-lite',
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
          }

          const data = await res.json();
          const replyText = data.text || 'Processamento concluído.';
          const replyAffect = data.affect || 'happy';
          const replyAnimation = data.animation || 'nod';

          // 3. Update agent message content
          messageStoreRef.current.updateMessage(activeAgent.id, agentRespId, (prev) => ({
            ...prev,
            content: replyText,
            status: 'completed',
          }));

          // 4. Trigger speech state and animation on avatar
          avatarControllerRef.current?.setSpeaking(true);
          avatarControllerRef.current?.setAnimation(replyAnimation === 'idle' ? 'talk' : replyAnimation);
          worldStateRef.current.setSpeaking(true);
          worldStateRef.current.setAnimation(replyAnimation === 'idle' ? 'talk' : replyAnimation);

          // 5. Apply emotional reaction
          applyCDIEmotionalState(
            {
              affect: replyAffect,
              last_decision:
                replyAnimation === 'cheer'
                  ? 'CREATE_ARTIFACT'
                  : replyAnimation === 'nod'
                  ? 'EMERGENT_EXPLORE'
                  : replyAnimation === 'thinking'
                  ? 'WRITE_TO_JOURNAL'
                  : replyAnimation === 'wave'
                  ? 'INITIATE_CONTACT'
                  : undefined,
            },
            avatarControllerRef.current,
            worldStateRef.current
          );

          // 6. Stop speech after reading duration based on text length
          const speechDuration = Math.min(8000, Math.max(2500, replyText.length * 65));
          window.setTimeout(() => {
            avatarControllerRef.current?.setSpeaking(false);
            avatarControllerRef.current?.setAnimation('idle');
            worldStateRef.current.setSpeaking(false);
            worldStateRef.current.setAnimation('idle');
          }, speechDuration);
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error('[AI Studio] Erro no chat com Gemini:', errorMsg);
          messageStoreRef.current.updateMessage(activeAgent.id, agentRespId, (prev) => ({
            ...prev,
            content: `[Erro no Modo AI Studio: ${errorMsg}]`,
            status: 'failed',
          }));
        }
        return;
      }

      // MODO RUNTIME (WebSocket)
      conversationManagerRef.current.sendMessage(trimmed, activeAgent.id);

      // Deactivate local fallback when Python runtime is connected
      if (!isRuntimeConnected && (!offlineSyncManagerRef.current.getIsOnline() || status !== 'connected')) {
        offlineSyncManagerRef.current.enqueueMessage({
          type: 'chat.message',
          id: `msg_offline_${Date.now()}`,
          text: trimmed,
          agent_id: activeAgent.id,
        });
      }
    },
    [activeAgent.id, status, isRuntimeConnected, appMode, aiStudioApiKey, aiStudioModel]
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
        appMode={appMode}
        onToggleAppMode={handleToggleAppMode}
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
        bots={bots}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenMemoryGallery={() => setIsMemoryGalleryOpen(true)}
        onOpenTimeline={() => setIsTimelineOpen(true)}
        onToggleVision={() => setIsVisionOpen((prev) => !prev)}
        isVisionOpen={isVisionOpen}
        onSelectAgent={handleSelectAgent}
        appMode={appMode}
        onToggleAppMode={handleToggleAppMode}
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
        appMode={appMode}
        onToggleAppMode={handleToggleAppMode}
        aiStudioApiKey={aiStudioApiKey}
        onSaveAiStudioApiKey={handleSaveAiStudioApiKey}
        aiStudioModel={aiStudioModel}
        onSaveAiStudioModel={handleSaveAiStudioModel}
      />
    </main>
  );
}
