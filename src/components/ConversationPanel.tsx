/**
 * ConversationPanel: Integrated conversation panel with active agent header,
 * streaming message thread, and interactive message input.
 */

import React from 'react';
import { Agent } from '../agents/AgentTypes';
import { Message } from '../conversation/ConversationTypes';
import { AgentStatusBadge } from './AgentStatusBadge';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Bot, Trash2 } from 'lucide-react';

interface ConversationPanelProps {
  activeAgent: Agent;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onClearHistory: () => void;
  isConnected: boolean;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  activeAgent,
  messages,
  onSendMessage,
  onClearHistory,
  isConnected,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-950/75 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-slate-800 overflow-hidden select-none">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-950 border border-sky-800/80 flex items-center justify-center text-sky-400 shrink-0 shadow-sm">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-white leading-tight">{activeAgent.name}</h2>
              <AgentStatusBadge status={activeAgent.status} size="sm" />
            </div>
            <p className="text-[10.5px] text-slate-400 mt-0.5">{activeAgent.role || 'Agente de Runtime'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onClearHistory}
            title="Limpar histórico da conversa"
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Message List */}
      <MessageList messages={messages} agentName={activeAgent.name} />

      {/* Message Input */}
      <MessageInput
        onSendMessage={onSendMessage}
        disabled={!isConnected}
        placeholder={`Conversar com ${activeAgent.name}...`}
        agentName={activeAgent.name}
      />
    </div>
  );
};
