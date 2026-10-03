/**
 * MessageList: Renders scrollable message thread with streaming indicator and auto-scroll.
 */

import React, { useEffect, useRef } from 'react';
import { Message } from '../conversation/ConversationTypes';
import { Bot, User, Loader2, AlertCircle } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  agentName: string;
  isStreaming?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, agentName }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm font-sans">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 py-12">
          <Bot className="w-10 h-10 mb-2 text-slate-600" />
          <p className="text-xs font-medium">Nenhuma mensagem nesta conversa.</p>
          <p className="text-[11px] text-slate-600 mt-1">Envie uma mensagem para iniciar o diálogo com {agentName}.</p>
        </div>
      ) : (
        messages.map((msg) => {
          if (msg.role === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="text-[11px] text-slate-400 bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800 text-center max-w-md">
                  {msg.content}
                </span>
              </div>
            );
          }

          const isUser = msg.role === 'user';
          const isStreaming = msg.status === 'streaming';
          const isSending = msg.status === 'sending';
          const isFailed = msg.status === 'failed';

          // Format timestamp
          const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-sky-950 border border-sky-800/80 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-4 h-4 text-sky-400" />
                </div>
              )}

              <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[82%]`}>
                {/* Name & Time */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-500 font-medium">
                  <span>{isUser ? 'Você' : agentName}</span>
                  <span className="text-slate-700">·</span>
                  <span>{timeStr}</span>
                </div>

                {/* Bubble Container */}
                <div
                  className={`relative px-4 py-2.5 rounded-2xl leading-relaxed whitespace-pre-wrap break-words ${
                    isUser
                      ? 'bg-sky-600 text-white rounded-tr-sm shadow-md'
                      : 'bg-slate-900/90 text-slate-100 border border-slate-800/80 rounded-tl-sm shadow-sm backdrop-blur-sm'
                  } ${isFailed ? 'border-rose-800/80 bg-rose-950/30 text-rose-200' : ''}`}
                >
                  {isSending && !msg.content ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-0.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                      <span>{agentName} está pensando...</span>
                    </div>
                  ) : (
                    <>
                      <span>{msg.content}</span>
                      {isStreaming && (
                        <span className="inline-block w-2 h-4 bg-sky-400 ml-1 translate-y-0.5 animate-pulse rounded-sm" />
                      )}
                    </>
                  )}

                  {isFailed && msg.error && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-400 mt-2 pt-2 border-t border-rose-900/50">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{msg.error}</span>
                    </div>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
};
