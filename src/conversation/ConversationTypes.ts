/**
 * Conversation types and chat protocol messages for Agent Runtime Interface.
 */

export interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  agentId: string;
  status: 'sending' | 'streaming' | 'completed' | 'failed';
  error?: string;
}

export interface ChatMessageOutbound {
  type: 'chat.message';
  id: string;
  agent_id: string;
  text: string;
  timestamp?: number;
}

export interface ChatStartedInbound {
  type: 'chat.started';
  id: string;
  agent_id?: string;
}

export interface ChatDeltaInbound {
  type: 'chat.delta';
  id: string;
  text: string;
}

export interface ChatCompletedInbound {
  type: 'chat.completed';
  id: string;
}

export interface ChatFailedInbound {
  type: 'chat.failed';
  id: string;
  error: string;
}

export type ChatInboundMessage =
  | ChatStartedInbound
  | ChatDeltaInbound
  | ChatCompletedInbound
  | ChatFailedInbound;
