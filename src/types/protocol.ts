/**
 * Protocol type definitions for Agent Body and Agent Runtime Interface communication
 */

import { ChatMessageOutbound, ChatInboundMessage } from '../conversation/ConversationTypes';
import { AgentInboundMessage, AgentSelectOutbound } from '../agents/AgentTypes';

export interface Vector3D {
  x: number;
  y?: number;
  z: number;
}

export interface MoveToAction {
  type: 'action';
  id: string;
  action: 'move_to';
  target: Vector3D;
  speed?: number; // units per second (default: 2.0)
}

export interface RotateAction {
  type: 'action';
  id: string;
  action: 'rotate';
  target: { x?: number; y: number; z?: number } | number; // radians or degrees or {y: rad}
  speed?: number; // rad per second
}

export interface LookAtAction {
  type: 'action';
  id: string;
  action: 'look_at';
  target: Vector3D;
  duration?: number;
}

export interface PlayAnimationAction {
  type: 'action';
  id: string;
  action: 'play_animation';
  animation?: 'idle' | 'walk' | 'wave' | 'talk' | string;
  name?: 'idle' | 'walk' | 'wave' | 'talk' | string;
  duration?: number;
}

export interface SetExpressionAction {
  type: 'action';
  id: string;
  action: 'set_expression';
  expression: 'neutral' | 'happy' | 'angry' | 'sad' | 'surprised' | 'blink' | 'relaxed' | 'aa' | 'ih' | 'ou' | 'ee' | 'oh' | string;
  intensity?: number; // 0.0 to 1.0 (default 1.0)
}

export interface SpeakAction {
  type: 'action';
  id: string;
  action: 'speak';
  text: string;
  duration?: number; // seconds
}

export interface StopAction {
  type: 'action';
  id: string;
  action: 'stop';
}

export type AgentAction =
  | MoveToAction
  | RotateAction
  | LookAtAction
  | PlayAnimationAction
  | SetExpressionAction
  | SpeakAction
  | StopAction;

export interface ActionStartedResponse {
  type: 'action.started';
  id: string;
}

export interface ActionCompletedResponse {
  type: 'action.completed';
  id: string;
}

export interface ActionFailedResponse {
  type: 'action.failed';
  id: string;
  error: string;
}

export interface DriveItem {
  name: string;
  value: number;
}

export interface PeerInfo {
  name: string;
  emotional_state?: string;
  valence?: number;
  online?: boolean;
}

export interface CDIBiometricsData {
  mode?: 'awake' | 'sleep' | 'dream' | string;
  phase?: 'AWAKE' | 'REM' | 'DEEP_SLEEP' | 'MEDITATION' | string;
  affect?: string;
  valence: number;
  arousal: number;
  top_drives: DriveItem[];
  last_decision?: string;
  stagnation?: number;
  cse_units?: number;
  cse_signal?: number;
  peers_online?: string[] | PeerInfo[];
  tick_total?: number;
  days_alive?: number;
  timestamp?: number;
}

export interface StateUpdateMessage {
  type: 'state.update';
  agent_id?: string;
  state?: {
    position: { x: number; y: number; z: number };
    rotation: { y: number };
    animation: string;
    expression: string;
    isSpeaking: boolean;
    isMoving: boolean;
  };
  data?: CDIBiometricsData;
}

export interface CDITimelineEventItem {
  type: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface CDITimelineEventMessage {
  type: 'timeline.event';
  agent_id?: string;
  event: CDITimelineEventItem;
}

export interface BotConfig {
  id: string;
  name: string;
  username: string;
  role: string;
  token: string;
  created_at: string;
  is_online: boolean;
}

export interface BotStatusMessage {
  type: 'bot.status';
  bot_id: string;
  is_online: boolean;
  timestamp?: number;
}

export interface BotListMessage {
  type: 'bot.list';
  bots: BotConfig[];
}

export interface RuntimeStatusMessage {
  type: 'runtime.status';
  connected: boolean;
  client_id?: string;
  bot_id?: string;
  gateway_status?: 'ready' | 'initializing';
  timestamp?: number;
}

export interface VisemeFrame {
  time: number; // seconds
  shape: 'aa' | 'ih' | 'ou' | 'ee' | 'oh' | string;
  weight: number; // 0.0 to 1.0
}

export interface AudioInputMessage {
  type: 'audio.input';
  id: string;
  format: 'webm' | 'wav' | string;
  data: string; // base64 encoded audio
  agent_id?: string;
}

export interface AudioOutputMessage {
  type: 'audio.output';
  id: string;
  format: 'mp3' | 'wav' | 'webm' | string;
  data: string; // base64 encoded audio
  visemes?: VisemeFrame[];
  text?: string;
  agent_id?: string;
}

export interface VisionFrameMessage {
  type: 'vision.frame';
  id: string;
  format: 'jpeg' | 'png' | 'webp' | string;
  data: string; // base64 encoded image
  source?: 'camera_front' | 'camera_back' | 'screen' | string;
  agent_id?: string;
}

export interface VisionResponseMessage {
  type: 'vision.response';
  id: string;
  description?: string;
  emotion_detected?: 'happy' | 'neutral' | 'sad' | 'surprised' | 'angry' | string;
  reaction_expression?: string;
  reaction_animation?: string;
  agent_id?: string;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface NotificationMessage {
  type: 'notification';
  id?: string;
  title: string;
  body: string;
  icon?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  vibrate?: boolean | number[];
  actions?: NotificationAction[];
  tag?: string;
  trigger_type?: 'social_drive' | 'artifact_created' | 'dream_wakeup' | 'peer_message' | 'grief_support' | 'custom' | string;
  agent_id?: string;
  timestamp?: number;
}

export interface WakeDetectedMessage {
  type: 'wake.detected';
  word: string;
  timestamp: number;
  agent_id?: string;
}

export interface ConfigGetMessage {
  type: 'config.get';
  sections?: string[];
  agent_id?: string;
}

export interface ConfigUpdateMessage {
  type: 'config.update';
  section: string;
  key: string;
  value: unknown;
  agent_id?: string;
}

export interface PeerSendMessage {
  type: 'peer.send';
  peer_name: string;
  message: string;
  agent_id?: string;
}

export interface ProposalActionMessage {
  type: 'proposal.action';
  proposal_id: string;
  action: 'approve' | 'reject';
  agent_id?: string;
}

export interface CDIBelief {
  id: string;
  statement: string;
  confidence: number;
}

export interface CDIGoal {
  id: string;
  title: string;
  priority: 'low' | 'normal' | 'high';
  progress: number;
  completed: boolean;
}

export interface CDIProposal {
  id: string;
  title: string;
  description: string;
  impact: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface MCPExtension {
  id: string;
  name: string;
  url?: string;
  command?: string;
  enabled: boolean;
  type?: string;
}

export interface ConfigDataMessage {
  type: 'config.data';
  agent_id?: string;
  drives?: Record<string, number>;
  models?: {
    principal: string;
    fallbacks: string[];
  };
  cse?: {
    enabled: boolean;
    stage: number;
    units: number;
    signal: number;
  };
  peers?: {
    online: string[];
    bus_status: { messages_pending: number };
  };
  extensions?: MCPExtension[];
  tick_interval_ms?: number;
  anti_spam?: {
    rate_limit_per_minute: number;
    cooldown_seconds: number;
    enabled: boolean;
  };
  core_txt?: string;
  beliefs?: CDIBelief[];
  goals?: CDIGoal[];
  proposals?: CDIProposal[];
}

export interface SceneSetMessage {
  type: 'scene.set';
  environment: 'cozy_room' | 'bright_room' | 'dark_grief_room' | 'bedroom_night' | 'creative_studio' | string;
  lighting: 'warm_evening' | 'bright_day' | 'dim_somber' | 'moonlight_night' | 'fireplace_glow' | 'studio_bright' | string;
  weather: 'clear' | 'rain' | 'snow' | 'storm' | 'gentle_breeze' | string;
  music?: 'ambient_calm' | 'gentle_lullaby' | 'melancholic_piano' | 'creative_pulse' | 'fireplace_crackle' | string;
  affect_trigger?: string;
}

export interface CDIMemoryItem {
  id?: string;
  type: 'artifact' | 'journal' | 'dream' | 'trait_milestone' | 'reflection';
  title: string;
  preview: string;
  content?: string;
  created_at: string;
  emotion?: string;
  category?: string;
  metadata?: {
    stage?: number;
    traits?: Record<string, number>;
    dream_lucidity?: number;
    tags?: string[];
    author?: string;
  };
}

export interface MemoryGalleryMessage {
  type: 'memory.gallery';
  agent_id?: string;
  memories: CDIMemoryItem[];
}

export interface MemoryGetMessage {
  type: 'memory.get';
  agent_id?: string;
  filter_type?: string;
}

export interface CDIListItem {
  id: string;
  name: string;
  status: 'awake' | 'sleeping' | 'dreaming' | 'offline' | string;
  affect: 'wondering' | 'calm' | 'engaged' | 'neutral' | 'curious' | 'grief' | string;
  avatar_color?: string;
  role?: string;
  bio?: string;
  current_topic?: string;
  last_active?: number;
}

export interface CDISwitchMessage {
  type: 'cdi.switch';
  agent_id: string;
}

export interface CDIListMessage {
  type: 'cdi.list';
  cdis: CDIListItem[];
}

export interface PeerBusEventMessage {
  type: 'peer_bus.event';
  from_id: string;
  to_id: string;
  from_name: string;
  to_name: string;
  message: string;
  timestamp: number;
  affect?: string;
}

export type ActionResponse = ActionStartedResponse | ActionCompletedResponse | ActionFailedResponse;

export type OutgoingMessage =
  | ActionResponse
  | StateUpdateMessage
  | ChatMessageOutbound
  | AgentSelectOutbound
  | AudioInputMessage
  | VisionFrameMessage
  | WakeDetectedMessage
  | ConfigGetMessage
  | ConfigUpdateMessage
  | PeerSendMessage
  | ProposalActionMessage
  | SceneSetMessage
  | MemoryGetMessage
  | CDISwitchMessage;

export type InboundProtocolMessage =
  | AgentAction
  | ChatInboundMessage
  | AgentInboundMessage
  | RuntimeStatusMessage
  | BotStatusMessage
  | BotListMessage
  | AudioOutputMessage
  | VisionResponseMessage
  | NotificationMessage
  | StateUpdateMessage
  | CDITimelineEventMessage
  | ConfigDataMessage
  | SceneSetMessage
  | MemoryGalleryMessage
  | CDIListMessage
  | PeerBusEventMessage;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  direction: 'in' | 'out' | 'system';
  payload: unknown;
  rawText?: string;
}

