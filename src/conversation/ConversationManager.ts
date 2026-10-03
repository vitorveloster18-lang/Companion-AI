/**
 * ConversationManager: Dispatches chat messages over WebSocket and processes
 * incoming streaming chat responses (chat.started, chat.delta, chat.completed, chat.failed).
 */

import { AgentConnection } from '../core/AgentConnection';
import { MessageStore } from './MessageStore';
import {
  ChatMessageOutbound,
  ChatInboundMessage,
  Message,
} from './ConversationTypes';

export class ConversationManager {
  private connection: AgentConnection;
  private messageStore: MessageStore;

  // Map of active streaming message ID to agentId
  private activeStreams: Map<string, string> = new Map();

  constructor(connection: AgentConnection, messageStore: MessageStore) {
    this.connection = connection;
    this.messageStore = messageStore;

    // Listen to WebSocket messages
    this.connection.onMessage((data) => {
      this.handleIncomingMessage(data);
    });
  }

  public getStore(): MessageStore {
    return this.messageStore;
  }

  public handleIncomingMessage(data: unknown): void {
    if (!data || typeof data !== 'object') return;

    const msg = data as Partial<ChatInboundMessage>;
    if (!msg.type || !msg.type.startsWith('chat.') || !msg.id) return;

    const msgId = msg.id;
    const activeAgentId = this.activeStreams.get(msgId) || this.messageStore.getActiveAgentId();

    switch (msg.type) {
      case 'chat.started': {
        const agentId = (msg as { agent_id?: string }).agent_id || activeAgentId;
        this.activeStreams.set(msgId, agentId);

        // Update placeholder to streaming status
        this.messageStore.updateMessage(agentId, `resp-${msgId}`, (prev) => ({
          ...prev,
          status: 'streaming',
        }));
        break;
      }

      case 'chat.delta': {
        const deltaText = (msg as { text?: string }).text || '';
        const agentId = this.activeStreams.get(msgId) || activeAgentId;

        // Ensure response message placeholder exists
        const messages = this.messageStore.getMessages(agentId);
        const exists = messages.some((m) => m.id === `resp-${msgId}`);

        if (!exists) {
          this.messageStore.addMessage(agentId, {
            id: `resp-${msgId}`,
            role: 'agent',
            content: deltaText,
            timestamp: Date.now(),
            agentId,
            status: 'streaming',
          });
          this.activeStreams.set(msgId, agentId);
        } else {
          this.messageStore.appendDelta(agentId, `resp-${msgId}`, deltaText);
        }
        break;
      }

      case 'chat.completed': {
        const agentId = this.activeStreams.get(msgId) || activeAgentId;
        this.messageStore.updateMessage(agentId, `resp-${msgId}`, (prev) => ({
          ...prev,
          status: 'completed',
        }));
        this.activeStreams.delete(msgId);
        break;
      }

      case 'chat.failed': {
        const errorMsg = (msg as { error?: string }).error || 'Erro ao processar resposta do agente.';
        const agentId = this.activeStreams.get(msgId) || activeAgentId;
        this.messageStore.updateMessage(agentId, `resp-${msgId}`, (prev) => ({
          ...prev,
          status: 'failed',
          error: errorMsg,
          content: prev.content ? `${prev.content}\n\n[Erro: ${errorMsg}]` : `[Erro: ${errorMsg}]`,
        }));
        this.activeStreams.delete(msgId);
        break;
      }
    }
  }

  public sendMessage(text: string, targetAgentId?: string): string {
    const trimmed = text.trim();
    if (!trimmed) return '';

    const agentId = targetAgentId || this.messageStore.getActiveAgentId();
    const messageId = `msg-${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    // 1. Add User Message
    const userMsg: Message = {
      id: messageId,
      role: 'user',
      content: trimmed,
      timestamp: now,
      agentId,
      status: 'completed',
    };
    this.messageStore.addMessage(agentId, userMsg);

    // 2. Pre-create Agent Placeholder Message
    const placeholderMsg: Message = {
      id: `resp-${messageId}`,
      role: 'agent',
      content: '',
      timestamp: now + 1,
      agentId,
      status: 'sending',
    };
    this.messageStore.addMessage(agentId, placeholderMsg);
    this.activeStreams.set(messageId, agentId);

    // 3. Send over WebSocket
    const outbound: ChatMessageOutbound = {
      type: 'chat.message',
      id: messageId,
      agent_id: agentId,
      text: trimmed,
      timestamp: now,
    };
    this.connection.send(outbound);

    return messageId;
  }
}
