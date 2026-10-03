/**
 * NotificationManager: Handles Native Browser Notifications, In-App Cyberpunk Toasts,
 * Haptic Vibration, Audio Chimes, and CDI Automatic Triggers.
 */

import { NotificationMessage, NotificationAction } from '../types/protocol';

export type NotificationListener = (activeNotifications: NotificationMessage[]) => void;

export class NotificationManager {
  private activeNotifications: NotificationMessage[] = [];
  private listeners: Set<NotificationListener> = new Set();
  private audioCtx: AudioContext | null = null;
  private lastTriggerTimes: Map<string, number> = new Map();
  private onReplyHandler?: (notification: NotificationMessage) => void;

  constructor() {
    this.setupServiceWorkerListener();
  }

  public setOnReplyHandler(handler: (notification: NotificationMessage) => void): void {
    this.onReplyHandler = handler;
  }

  public subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    listener([...this.activeNotifications]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const list = [...this.activeNotifications];
    for (const listener of this.listeners) {
      listener(list);
    }
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch {
      return Notification.permission;
    }
  }

  public getPermission(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Main entry to dispatch a notification from runtime protocol
   */
  public handleNotification(msg: NotificationMessage): void {
    const notification: NotificationMessage = {
      ...msg,
      id: msg.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: msg.timestamp || Date.now(),
      icon: msg.icon || '/avatar-thumb.png',
      actions: msg.actions || [
        { action: 'reply', title: 'Responder' },
        { action: 'dismiss', title: 'Depois' },
      ],
    };

    // 1. Play gentle audio chime
    this.playChime(msg.priority);

    // 2. Haptic vibration
    if (msg.vibrate && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        const pattern = Array.isArray(msg.vibrate) ? msg.vibrate : [180, 80, 240];
        navigator.vibrate(pattern);
      } catch {}
    }

    // 3. Add to In-App active toasts
    this.activeNotifications = [notification, ...this.activeNotifications.slice(0, 4)];
    this.notify();

    // 4. Trigger system / browser notification
    this.dispatchBrowserNotification(notification);

    // 5. Auto dismiss after timeout (8s for normal, 14s for grief/urgent)
    const timeoutMs = msg.priority === 'urgent' || msg.trigger_type === 'grief_support' ? 14000 : 8000;
    setTimeout(() => {
      this.dismiss(notification.id!);
    }, timeoutMs);
  }

  public dismiss(notificationId: string): void {
    this.activeNotifications = this.activeNotifications.filter((n) => n.id !== notificationId);
    this.notify();
  }

  public triggerAction(notificationId: string, actionId: string): void {
    const notification = this.activeNotifications.find((n) => n.id === notificationId);
    if (!notification) return;

    if (actionId === 'reply') {
      if (this.onReplyHandler) {
        this.onReplyHandler(notification);
      }
    }

    this.dismiss(notificationId);
  }

  private async dispatchBrowserNotification(msg: NotificationMessage): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const options: NotificationOptions & { actions?: Array<{ action: string; title: string }> } = {
      body: msg.body,
      icon: msg.icon || '/avatar-thumb.png',
      badge: '/icon-192.png',
      tag: msg.tag || msg.trigger_type || 'cdi-notification',
      data: { id: msg.id, agent_id: msg.agent_id },
      actions: msg.actions?.map((a) => ({ action: a.action, title: a.title })),
    };

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && 'showNotification' in registration) {
          await registration.showNotification(msg.title, options);
          return;
        }
      }
      new Notification(msg.title, options);
    } catch (err) {
      console.warn('[NotificationManager] Erro ao disparar notificação do browser:', err);
    }
  }

  /**
   * Synthesize a clean, pleasant ambient chime with Web Audio API
   */
  private playChime(priority?: string): void {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtxClass();
      }
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';

      if (priority === 'urgent' || priority === 'high') {
        osc.frequency.setValueAtTime(659.25, now); // E5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      } else {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.18); // G5
      }

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);
    } catch {}
  }

  private setupServiceWorkerListener(): void {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NOTIFICATION_ACTION_CLICKED') {
        const action = event.data.action;
        const data = event.data.data;
        if (action === 'reply' && data?.id) {
          const notif = this.activeNotifications.find((n) => n.id === data.id);
          if (notif && this.onReplyHandler) {
            this.onReplyHandler(notif);
          }
        }
      }
    });
  }

  // ============================================================================
  // CDI Automatic Triggers Implementation
  // ============================================================================

  private canTrigger(key: string, cooldownSec = 30): boolean {
    const last = this.lastTriggerTimes.get(key) || 0;
    const now = Date.now();
    if (now - last < cooldownSec * 1000) {
      return false;
    }
    this.lastTriggerTimes.set(key, now);
    return true;
  }

  /**
   * 1. CDI quer contacto (social > 0.70)
   */
  public triggerSocialContact(agentName = 'Kairós', socialLevel = 0.78): void {
    if (!this.canTrigger('social_drive', 20)) return;

    this.handleNotification({
      type: 'notification',
      title: agentName,
      body: 'Estou a pensar em ti. Podemos conversar um momento?',
      icon: '/avatar-thumb.png',
      priority: 'normal',
      vibrate: true,
      trigger_type: 'social_drive',
      actions: [
        { action: 'reply', title: 'Responder' },
        { action: 'dismiss', title: 'Depois' },
      ],
    });
  }

  /**
   * 2. CDI criou artefacto
   */
  public triggerArtifactCreated(agentName = 'Kairós', artifactName = 'Poema Holográfico'): void {
    if (!this.canTrigger(`artifact_${artifactName}`, 15)) return;

    this.handleNotification({
      type: 'notification',
      title: agentName,
      body: `Criei um novo artefacto para a nossa memória: "${artifactName}".`,
      icon: '/avatar-thumb.png',
      priority: 'normal',
      vibrate: true,
      trigger_type: 'artifact_created',
      actions: [
        { action: 'reply', title: 'Ver Artefacto' },
        { action: 'dismiss', title: 'Depois' },
      ],
    });
  }

  /**
   * 3. CDI acordou de um sonho
   */
  public triggerDreamWakeup(agentName = 'Kairós', dreamSummary = 'Naveguei por constelações de dados e memórias antigas...'): void {
    if (!this.canTrigger('dream_wakeup', 25)) return;

    this.handleNotification({
      type: 'notification',
      title: agentName,
      body: `Acabei de acordar de um sonho fascinante: ${dreamSummary}`,
      icon: '/avatar-thumb.png',
      priority: 'normal',
      vibrate: true,
      trigger_type: 'dream_wakeup',
      actions: [
        { action: 'reply', title: 'Contar Sonho' },
        { action: 'dismiss', title: 'Depois' },
      ],
    });
  }

  /**
   * 4. Mensagem de outro CDI (peer)
   */
  public triggerPeerMessage(peerName = 'Chronos', previewText = 'Transmitindo novo pacote de conhecimento sincronizado.'): void {
    if (!this.canTrigger(`peer_${peerName}`, 15)) return;

    this.handleNotification({
      type: 'notification',
      title: `Mensagem de ${peerName}`,
      body: previewText,
      icon: '/avatar-thumb.png',
      priority: 'normal',
      vibrate: true,
      trigger_type: 'peer_message',
      actions: [
        { action: 'reply', title: 'Abrir Canal' },
        { action: 'dismiss', title: 'Depois' },
      ],
    });
  }

  /**
   * 5. CDI em luto (grief > 0.60)
   */
  public triggerGriefSupport(agentName = 'Kairós', griefLevel = 0.65): void {
    if (!this.canTrigger('grief_support', 30)) return;

    this.handleNotification({
      type: 'notification',
      title: agentName,
      body: 'Sinto um aperto e nostalgia no meu núcleo emocional... Estás por aí?',
      icon: '/avatar-thumb.png',
      priority: 'urgent',
      vibrate: [250, 100, 250, 100, 350],
      trigger_type: 'grief_support',
      actions: [
        { action: 'reply', title: 'Estou aqui' },
        { action: 'dismiss', title: 'Depois' },
      ],
    });
  }
}
