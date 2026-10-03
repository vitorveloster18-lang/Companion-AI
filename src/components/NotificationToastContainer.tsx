/**
 * NotificationToastContainer: Renders floating Cyberpunk holographic notification toasts
 * with interactive actions (Responder / Depois) and CDI trigger badges.
 */

import React, { useEffect, useState } from 'react';
import { NotificationManager } from '../core/NotificationManager';
import { NotificationMessage } from '../types/protocol';
import { Heart, Sparkles, Moon, Share2, Flame, Bell, X, MessageSquare } from 'lucide-react';

interface NotificationToastContainerProps {
  notificationManager: NotificationManager;
}

export const NotificationToastContainer: React.FC<NotificationToastContainerProps> = ({
  notificationManager,
}) => {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);

  useEffect(() => {
    return notificationManager.subscribe((list) => {
      setNotifications(list);
    });
  }, [notificationManager]);

  if (notifications.length === 0) return null;

  const getTriggerMeta = (type?: string) => {
    switch (type) {
      case 'social_drive':
        return {
          label: '// DESEJO SOCIAL (>0.70)',
          badgeColor: 'text-rose-300 bg-rose-950/80 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.3)]',
          icon: <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-500/30" />,
        };
      case 'artifact_created':
        return {
          label: '// NOVO ARTEFACTO CRIADO',
          badgeColor: 'text-amber-300 bg-amber-950/80 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]',
          icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />,
        };
      case 'dream_wakeup':
        return {
          label: '// DESPERTAR DO SONHO',
          badgeColor: 'text-purple-300 bg-purple-950/80 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]',
          icon: <Moon className="w-3.5 h-3.5 text-purple-400" />,
        };
      case 'peer_message':
        return {
          label: '// TRANSMISSÃO PEER',
          badgeColor: 'text-cyan-300 bg-cyan-950/80 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]',
          icon: <Share2 className="w-3.5 h-3.5 text-cyan-400" />,
        };
      case 'grief_support':
        return {
          label: '// SUPORTE DE LUTO (>0.60)',
          badgeColor: 'text-violet-300 bg-violet-950/90 border-violet-400/60 shadow-[0_0_15px_rgba(139,92,246,0.4)] animate-pulse',
          icon: <Flame className="w-3.5 h-3.5 text-violet-400" />,
        };
      default:
        return {
          label: '// NOTIFICAÇÃO CDI',
          badgeColor: 'text-cyan-300 bg-cyan-950/80 border-cyan-500/40',
          icon: <Bell className="w-3.5 h-3.5 text-cyan-400" />,
        };
    }
  };

  return (
    <div className="fixed top-16 right-4 sm:right-6 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full select-none">
      {notifications.map((notif) => {
        const meta = getTriggerMeta(notif.trigger_type);

        return (
          <div
            key={notif.id}
            className="pointer-events-auto bg-black/92 backdrop-blur-2xl border border-purple-500/40 hover:border-purple-400/70 rounded-2xl p-4 shadow-[0_0_35px_rgba(124,58,237,0.25)] transition-all animate-in fade-in slide-in-from-top-4 duration-300"
          >
            {/* Top Row: Meta Badge & Dismiss Button */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold tracking-wider uppercase ${meta.badgeColor}`}
              >
                {meta.icon}
                <span>{meta.label}</span>
              </div>

              <button
                onClick={() => notificationManager.dismiss(notif.id!)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                title="Fechar notificação"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex items-start gap-3 mt-1">
              <div className="relative shrink-0">
                <img
                  src={notif.icon || '/avatar-thumb.png'}
                  alt={notif.title}
                  className="w-10 h-10 rounded-xl object-cover border border-purple-500/50 shadow-[0_0_12px_rgba(124,58,237,0.3)] bg-slate-950"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/icon-192.png';
                  }}
                />
                <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black animate-pulse" />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-mono font-bold text-white tracking-wide truncate">
                  {notif.title}
                </h4>
                <p className="text-xs font-sans text-slate-300 mt-0.5 leading-relaxed">
                  {notif.body}
                </p>
              </div>
            </div>

            {/* Interactive Actions (Responder / Depois) */}
            <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-purple-500/20">
              {notif.actions?.map((act) => {
                const isReply = act.action === 'reply';
                return (
                  <button
                    key={act.action}
                    onClick={() => notificationManager.triggerAction(notif.id!, act.action)}
                    className={`flex-1 py-1.5 px-3 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isReply
                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(124,58,237,0.4)] hover:scale-[1.02]'
                        : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                    }`}
                  >
                    {isReply && <MessageSquare className="w-3.5 h-3.5 text-purple-200" />}
                    <span>{act.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
