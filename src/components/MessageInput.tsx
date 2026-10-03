/**
 * MessageInput: Cyberpunk HUD multi-line chat input with ON/OFF status indicator,
 * live microphone voice recording (audio.input WebM), and glowing neon accents.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Square, X, Radio } from 'lucide-react';
import { VoiceLipSyncManager } from '../core/VoiceLipSyncManager';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  onSendAudio?: (audio: { format: string; data: string; duration: number }) => void;
  voiceManager?: VoiceLipSyncManager;
  disabled?: boolean;
  placeholder?: string;
  agentName?: string;
  isRuntimeConnected?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onSendAudio,
  voiceManager,
  disabled = false,
  placeholder = 'Digite uma mensagem...',
  agentName = 'o agente',
  isRuntimeConnected = false,
}) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<number | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

  // Toggle voice recording
  const handleToggleVoice = async () => {
    if (!voiceManager) {
      alert('Gerenciador de áudio não inicializado.');
      return;
    }

    if (isRecording) {
      // Stop and send audio.input
      try {
        if (timerRef.current) clearInterval(timerRef.current);
        const result = await voiceManager.stopRecording();
        setIsRecording(false);
        setRecordSeconds(0);
        setAudioLevel(0);

        if (onSendAudio && result.data) {
          onSendAudio({
            format: result.format,
            data: result.data,
            duration: result.duration,
          });
        }
      } catch (err) {
        console.error('Erro ao finalizar gravação:', err);
        setIsRecording(false);
      }
    } else {
      // Start recording
      try {
        setRecordSeconds(0);
        await voiceManager.startRecording((level) => {
          setAudioLevel(level);
        });
        setIsRecording(true);

        timerRef.current = window.setInterval(() => {
          setRecordSeconds((s) => s + 1);
        }, 1000);
      } catch (err) {
        console.error('Erro ao acessar microfone:', err);
        alert('Permissão de microfone negada ou dispositivo não encontrado.');
      }
    }
  };

  const handleCancelVoice = async () => {
    if (!voiceManager || !isRecording) return;
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      await voiceManager.stopRecording();
    } catch {}
    setIsRecording(false);
    setRecordSeconds(0);
    setAudioLevel(0);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative p-2.5 bg-black/85 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-[0_0_30px_rgba(0,240,255,0.08)] transition-all">
      {/* Corner Cyberpunk Decorative Accent Lines */}
      <div className="absolute top-0 left-3 w-4 h-[2px] bg-cyan-400/80 shadow-[0_0_8px_#00f0ff]" />
      <div className="absolute top-0 right-3 w-4 h-[2px] bg-cyan-400/80 shadow-[0_0_8px_#00f0ff]" />

      {isRecording ? (
        /* Cyberpunk Voice Recording HUD Bar */
        <div className="flex items-center justify-between gap-3 bg-rose-950/40 border border-rose-500/60 rounded-xl p-2.5 shadow-[0_0_20px_rgba(244,63,94,0.25)] animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-ping" />
            <span className="text-xs font-mono font-bold text-rose-300 uppercase tracking-wider">
              REC // {formatTime(recordSeconds)}
            </span>

            {/* Live Audio Visualizer Bars */}
            <div className="flex items-center gap-0.5 h-4 ml-1">
              {[0.4, 0.8, 1.0, 0.6, 0.9, 0.5, 0.7].map((h, i) => {
                const dynamicHeight = Math.max(3, Math.min(18, h * audioLevel * 25));
                return (
                  <span
                    key={i}
                    style={{ height: `${dynamicHeight}px` }}
                    className="w-1 bg-cyan-400 rounded-full transition-all duration-75 shadow-[0_0_6px_#00f0ff]"
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancelVoice}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
              title="Cancelar gravação"
            >
              <X className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToggleVoice}
              className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white text-xs font-mono font-bold rounded-lg shadow-[0_0_15px_rgba(244,63,94,0.5)] flex items-center gap-1.5 transition-all cursor-pointer"
              title="Finalizar e enviar áudio para o CDI / Runtime"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>ENVIAR VOZ</span>
            </button>
          </div>
        </div>
      ) : (
        /* Normal Text & Mic Input */
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 bg-slate-950/90 border border-slate-800/90 focus-within:border-cyan-500/80 focus-within:shadow-[0_0_15px_rgba(0,240,255,0.2)] rounded-xl p-1.5 transition-all"
        >
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

          {/* Microphone Action Button */}
          <button
            type="button"
            onClick={handleToggleVoice}
            disabled={disabled}
            className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/40 rounded-lg transition-all shrink-0 cursor-pointer disabled:opacity-40"
            title="Gravar áudio com microfone (audio.input)"
          >
            <Mic className="w-4 h-4" />
          </button>

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
            title="Enviar texto (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
};
