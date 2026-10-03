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

export interface StateUpdateMessage {
  type: 'state.update';
  state: {
    position: { x: number; y: number; z: number };
    rotation: { y: number };
    animation: string;
    expression: string;
    isSpeaking: boolean;
    isMoving: boolean;
  };
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

export type ActionResponse = ActionStartedResponse | ActionCompletedResponse | ActionFailedResponse;

export type OutgoingMessage =
  | ActionResponse
  | StateUpdateMessage
  | ChatMessageOutbound
  | AgentSelectOutbound;

export type InboundProtocolMessage =
  | AgentAction
  | ChatInboundMessage
  | AgentInboundMessage
  | RuntimeStatusMessage
  | BotStatusMessage
  | BotListMessage;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  direction: 'in' | 'out' | 'system';
  payload: unknown;
  rawText?: string;
}
