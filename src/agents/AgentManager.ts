/**
 * AgentManager: Manages the list of available agents and bots, active selection,
 * and synchronizes statuses received from the Python runtime and Gateway.
 */

import { AgentConnection } from '../core/AgentConnection';
import { Agent, AgentStatus, AgentInboundMessage, AgentSelectOutbound } from './AgentTypes';
import { BotConfig, BotListMessage, BotStatusMessage } from '../types/protocol';

export type AgentManagerListener = (agents: Agent[], activeAgent: Agent) => void;

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'bot_01',
    name: 'Assistente Python',
    username: 'assistente_bot',
    role: 'Agente Conectado via chat.py',
    status: 'idle',
  },
];

export class AgentManager {
  private connection: AgentConnection;
  private agents: Agent[] = DEFAULT_AGENTS;
  private activeAgentId = 'bot_01';
  private listeners: Set<AgentManagerListener> = new Set();

  constructor(connection: AgentConnection) {
    this.connection = connection;

    // Listen for agent and bot protocol messages
    this.connection.onMessage((data) => {
      this.handleIncomingMessage(data);
    });

    // Fetch initial bots from REST API
    this.fetchBots();
  }

  public async fetchBots(): Promise<void> {
    try {
      const res = await fetch('/api/bots');
      if (res.ok) {
        const bots: BotConfig[] = await res.json();
        if (Array.isArray(bots) && bots.length > 0) {
          this.setBots(bots);
        }
      }
    } catch (err) {
      console.warn('[AgentManager] Falha ao carregar bots iniciais:', err);
    }
  }

  public setBots(bots: BotConfig[]): void {
    if (!Array.isArray(bots) || bots.length === 0) return;

    this.agents = bots.map((b) => ({
      id: b.id,
      name: b.name,
      username: b.username,
      role: b.role,
      token: b.token,
      status: b.is_online ? 'online' : 'idle',
    }));

    if (!this.agents.some((a) => a.id === this.activeAgentId)) {
      this.activeAgentId = this.agents[0].id;
    }

    this.notify();
  }

  public getAgents(): Agent[] {
    return [...this.agents];
  }

  public getActiveAgent(): Agent {
    const found = this.agents.find((a) => a.id === this.activeAgentId);
    return found || this.agents[0] || { id: 'bot_01', name: 'Assistente Python', status: 'idle' };
  }

  public getActiveAgentId(): string {
    return this.activeAgentId;
  }

  public subscribe(listener: AgentManagerListener): () => void {
    this.listeners.add(listener);
    listener(this.agents, this.getActiveAgent());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public selectAgent(agentId: string): void {
    if (this.activeAgentId !== agentId) {
      const exists = this.agents.some((a) => a.id === agentId);
      if (exists) {
        this.activeAgentId = agentId;
        this.notify();

        // Notify Python runtime of selection
        const outbound: AgentSelectOutbound = {
          type: 'agent.select',
          agent_id: agentId,
        };
        this.connection.send(outbound);
      }
    }
  }

  public setAgentStatus(agentId: string, status: AgentStatus): void {
    let updated = false;
    this.agents = this.agents.map((a) => {
      if (a.id === agentId) {
        updated = true;
        return { ...a, status };
      }
      return a;
    });

    if (updated) {
      this.notify();
    }
  }

  public handleIncomingMessage(data: unknown): void {
    if (!data || typeof data !== 'object') return;

    const msg = data as Record<string, unknown>;

    // Handle bot.list from Gateway
    if (msg.type === 'bot.list') {
      const bots = msg.bots as BotConfig[];
      if (Array.isArray(bots)) {
        this.setBots(bots);
      }
      return;
    }

    // Handle bot.status from Gateway
    if (msg.type === 'bot.status') {
      const { bot_id, is_online } = msg as { bot_id?: string; is_online?: boolean };
      if (bot_id) {
        this.setAgentStatus(bot_id, is_online ? 'online' : 'idle');
      }
      return;
    }

    // Handle agent.list from Python runtime
    if (msg.type === 'agent.list') {
      const list = msg.agents as Agent[];
      if (Array.isArray(list) && list.length > 0) {
        this.agents = list;
        if (!this.agents.some((a) => a.id === this.activeAgentId)) {
          this.activeAgentId = this.agents[0].id;
        }
        this.notify();
      }
      return;
    }

    // Handle agent.status from Python runtime
    if (msg.type === 'agent.status') {
      const { agent_id, status } = msg as { agent_id?: string; status?: AgentStatus };
      if (agent_id && status) {
        this.setAgentStatus(agent_id, status);
      }
      return;
    }
  }

  private notify(): void {
    const active = this.getActiveAgent();
    for (const listener of this.listeners) {
      listener(this.agents, active);
    }
  }
}
