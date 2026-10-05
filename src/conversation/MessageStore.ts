/**
 * MessageStore: In-memory store for conversation histories grouped by agentId.
 * Supports reactive subscription and streaming text accumulation.
 */

import { Message } from './ConversationTypes';

export type MessageStoreListener = (messages: Message[], activeAgentId: string) => void;

export class MessageStore {
  private messagesByAgent: Map<string, Message[]> = new Map();
  private listeners: Set<MessageStoreListener> = new Set();
  private activeAgentId = 'agent-01';

  constructor() {
    // Initialize default welcome message for the primary agent
    this.messagesByAgent.set('agent-01', [
      {
        id: 'welcome-01',
        role: 'system',
        content: 'Conectado ao Agent Runtime. Digite uma mensagem para conversar com o agente.',
        timestamp: Date.now(),
        agentId: 'agent-01',
        status: 'completed',
      },
    ]);
  }

  public setActiveAgentId(agentId: string): void {
    if (this.activeAgentId !== agentId) {
      this.activeAgentId = agentId;
      if (!this.messagesByAgent.has(agentId)) {
        this.messagesByAgent.set(agentId, []);
      }
      this.notify();
    }
  }

  public getActiveAgentId(): string {
    return this.activeAgentId;
  }

  public getMessages(agentId?: string): Message[] {
    const id = agentId || this.activeAgentId;
    return this.messagesByAgent.get(id) || [];
  }

  public subscribe(listener: MessageStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.getMessages(), this.activeAgentId);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public addMessage(agentId: string, message: Message): void {
    const list = this.messagesByAgent.get(agentId) || [];
    this.messagesByAgent.set(agentId, [...list, message]);
    this.notify();
  }

  public updateMessage(agentId: string, messageId: string, updater: (prev: Message) => Message): void {
    let targetAgent = agentId;
    let list = this.messagesByAgent.get(targetAgent) || [];
    let index = list.findIndex(
      (m) => m.id === messageId || m.id === `resp-${messageId}` || m.id.replace(/^resp-/, '') === messageId
    );

    // If not found in requested agent, search other agent lists (e.g. kairos vs bot_01)
    if (index === -1) {
      for (const [otherAgent, otherList] of this.messagesByAgent.entries()) {
        const otherIndex = otherList.findIndex(
          (m) => m.id === messageId || m.id === `resp-${messageId}` || m.id.replace(/^resp-/, '') === messageId
        );
        if (otherIndex !== -1) {
          targetAgent = otherAgent;
          list = otherList;
          index = otherIndex;
          break;
        }
      }
    }

    if (index !== -1) {
      const updated = updater(list[index]);
      const newList = [...list];
      newList[index] = updated;
      this.messagesByAgent.set(targetAgent, newList);
      this.notify();
    }
  }

  public appendDelta(agentId: string, messageId: string, deltaText: string): void {
    let targetAgent = agentId;
    let list = this.messagesByAgent.get(targetAgent) || [];
    let index = list.findIndex(
      (m) => m.id === messageId || m.id === `resp-${messageId}` || m.id.replace(/^resp-/, '') === messageId
    );

    if (index === -1) {
      for (const [otherAgent, otherList] of this.messagesByAgent.entries()) {
        const otherIndex = otherList.findIndex(
          (m) => m.id === messageId || m.id === `resp-${messageId}` || m.id.replace(/^resp-/, '') === messageId
        );
        if (otherIndex !== -1) {
          targetAgent = otherAgent;
          list = otherList;
          index = otherIndex;
          break;
        }
      }
    }

    if (index !== -1) {
      const current = list[index];
      const updated: Message = {
        ...current,
        content: current.content + deltaText,
        status: 'streaming',
      };
      const newList = [...list];
      newList[index] = updated;
      this.messagesByAgent.set(targetAgent, newList);
      this.notify();
    }
  }

  public clearHistory(agentId?: string): void {
    const id = agentId || this.activeAgentId;
    this.messagesByAgent.set(id, []);
    this.notify();
  }

  private notify(): void {
    const currentMessages = this.getMessages(this.activeAgentId);
    for (const listener of this.listeners) {
      listener(currentMessages, this.activeAgentId);
    }
  }
}
