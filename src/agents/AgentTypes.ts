/**
 * Agent definitions, status states, and protocol events for Agent Runtime Interface.
 */

export type AgentStatus =
  | 'offline'
  | 'connecting'
  | 'online'
  | 'idle'
  | 'thinking'
  | 'speaking'
  | 'working'
  | 'moving'
  | 'error';

export interface Agent {
  id: string;
  name: string;
  username?: string;
  role?: string;
  avatarModel?: string;
  status: AgentStatus;
  token?: string;
}

export interface AgentListInbound {
  type: 'agent.list';
  agents: Agent[];
}

export interface AgentStatusInbound {
  type: 'agent.status';
  agent_id: string;
  status: AgentStatus;
}

export interface AgentSelectOutbound {
  type: 'agent.select';
  agent_id: string;
}

export type AgentInboundMessage = AgentListInbound | AgentStatusInbound;
