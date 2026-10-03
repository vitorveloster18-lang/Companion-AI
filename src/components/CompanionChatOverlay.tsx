/**
 * CompanionChatOverlay: Cyberpunk HUD companion chat overlay rendered directly over the 3D scene.
 * Clean, distraction-free speech bubbles with glowing neon accents and no intrusive status banners.
 */

import React, { useState } from 'react';
import { Agent } from '../agents/AgentTypes';
import { Message } from '../conversation/ConversationTypes';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { Bot, History, X, Trash2, Sparkles, Terminal } from 'lucide-react';

interface CompanionChatOverlayProps {
  activeAgent: Agent;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onClearHistory: () => void;
  isGatewayConnected: boolean;
  isRuntimeConnected: boolean;
  onOpenSettings?: () => void;
}

export const CompanionChatOverlay: React.FC<CompanionChatOverlayProps> = ({
  activeAgent,
  messages,
  onSendMessage,
  onClearHistory,
  isGatewayConnected,
  isRuntimeConnected,
  onOpenSettings,
}) => {
  const [showHistory, setShowHistory] = useState(false);

  // Get the most recent agent or user message to display as active speech bubble
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');
  const latestMessage = nonSystemMessages.length > 0 ? nonSystemMessages[nonSystemMessages.length - 1] : null;

  return (
    <>
      {/* Full Conversation History Modal / Drawer (Cyberpunk Obsidian Glass) */}
      {showHistory && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl h-[70vh] bg-slate-950/95 border border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(0,240,255,0.15)] overflow-hidden flex flex-col backdrop-blur-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-cyan-500/20 bg-black/80">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                  // HISTÓRICO • {activeAgent.name}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onClearHistory}
                  title="Limpar histórico"
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-950/60">
              <MessageList messages={messages} agentName={activeAgent.name} />
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Companion Overlay (Centered on Desktop, Full Width on Mobile) */}
      <div className="absolute bottom-4 inset-x-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[620px] z-30 pointer-events-auto flex flex-col gap-2 select-none">
        {/* Floating Active Speech Bubble */}
        {latestMessage && (
          <div className="relative bg-black/80 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl p-3.5 shadow-[0_0_30px_rgba(0,240,255,0.1)] animate-in slide-in-from-bottom-2 duration-200">
            {/* Corner Accent */}
            <div className="absolute top-0 left-4 w-6 h-[1.5px] bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />

            <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_8px_rgba(0,240,255,0.3)]">
                  <Bot className="w-3 h-3" />
                </div>
                <span className="text-xs font-mono font-bold text-slate-200">{activeAgent.name}</span>
              </div>

              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 font-medium px-2 py-0.5 rounded-md hover:bg-cyan-950/40 transition-colors cursor-pointer"
                title="Abrir histórico completo"
              >
                <History className="w-3 h-3" />
                <span>Logs ({messages.length})</span>
              </button>
            </div>

            <div className="text-xs sm:text-sm text-slate-100 max-h-28 overflow-y-auto leading-relaxed whitespace-pre-wrap font-sans">
              {latestMessage.status === 'sending' && !latestMessage.content ? (
                <div className="flex items-center justify-between text-slate-400 py-1">
                  <div className="flex items-center gap-2 font-mono text-xs text-cyan-300">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span>Processando via Python Runtime...</span>
                  </div>
                </div>
              ) : (
                <span>{latestMessage.content}</span>
              )}
              {latestMessage.status === 'streaming' && (
                <span className="inline-block w-2 h-3.5 bg-cyan-400 ml-1 translate-y-0.5 animate-pulse rounded-sm shadow-[0_0_8px_#00f0ff]" />
              )}
            </div>
          </div>
        )}

        {/* Floating Input Card with ON/OFF Indicator */}
        <MessageInput
          onSendMessage={onSendMessage}
          disabled={!isGatewayConnected}
          placeholder={
            !isGatewayConnected
              ? 'Conectando ao Gateway...'
              : `Comando para ${activeAgent.name}...`
          }
          agentName={activeAgent.name}
          isRuntimeConnected={isRuntimeConnected}
        />
      </div>
    </>
  );
};
