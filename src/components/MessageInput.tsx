/**
 * MessageInput: Cyberpunk HUD multi-line chat input with ON/OFF status indicator,
 * glowing neon accents, and smooth interaction.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Radio, Zap } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  agentName?: string;
  isRuntimeConnected?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = 'Digite uma mensagem...',
  agentName = 'o agente',
  isRuntimeConnected = false,
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || disabled) return;

    onSendMessage(text);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative p-2.5 bg-black/85 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-[0_0_30px_rgba(0,240,255,0.08)] transition-all">
      {/* Corner Cyberpunk Decorative Accent Lines */}
      <div className="absolute top-0 left-3 w-4 h-[2px] bg-cyan-400/80 shadow-[0_0_8px_#00f0ff]" />
      <div className="absolute top-0 right-3 w-4 h-[2px] bg-cyan-400/80 shadow-[0_0_8px_#00f0ff]" />

      <form onSubmit={handleSubmit} className="flex items-end gap-2 bg-slate-950/90 border border-slate-800/90 focus-within:border-cyan-500/80 focus-within:shadow-[0_0_15px_rgba(0,240,255,0.2)] rounded-xl p-1.5 transition-all">
        {/* Cyberpunk ON / OFF Indicator Icon */}
        <div
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold tracking-wider uppercase select-none shrink-0 transition-all ${
            isRuntimeConnected
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
              : 'bg-rose-950/40 text-rose-400 border border-rose-800/40'
          }`}
          title={isRuntimeConnected ? 'Python Runtime Conectado [ON]' : 'Python Runtime Desconectado [OFF]'}
        >
          <span
            className={`w-2 h-2 rounded-full transition-all ${
              isRuntimeConnected
                ? 'bg-emerald-400 shadow-[0_0_8px_#00ff9d] animate-pulse'
                : 'bg-rose-500/80'
            }`}
          />
          <span>{isRuntimeConnected ? 'ON' : 'OFF'}</span>
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none py-1.5 px-1 max-h-36 leading-relaxed font-sans disabled:opacity-50"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!text.trim() || disabled}
          className={`p-2 rounded-lg flex items-center justify-center transition-all shrink-0 cursor-pointer ${
            text.trim() && !disabled
              ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-[0_0_15px_rgba(0,240,255,0.4)] hover:scale-105'
              : 'bg-slate-900 text-slate-600 cursor-not-allowed opacity-50'
          }`}
          title="Enviar (Enter)"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
