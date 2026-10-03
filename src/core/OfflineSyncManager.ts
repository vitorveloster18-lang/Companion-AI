/**
 * OfflineSyncManager: Registers Service Worker, saves last known CDI state,
 * manages offline message queue, and synchronizes automatically on reconnection.
 */

import { OutgoingMessage } from '../types/protocol';

export interface QueuedMessage {
  id: string;
  payload: OutgoingMessage;
  timestamp: number;
}

export interface OfflineSyncListener {
  (state: {
    isOnline: boolean;
    queuedCount: number;
    lastSavedStateTime: number | null;
  }): void;
}

const STORAGE_QUEUE_KEY = 'cdi_offline_message_queue';
const STORAGE_LAST_STATE_KEY = 'cdi_last_known_state';

export class OfflineSyncManager {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private queuedMessages: QueuedMessage[] = [];
  private lastSavedStateTime: number | null = null;
  private listeners: Set<OfflineSyncListener> = new Set();
  private swRegistration: ServiceWorkerRegistration | null = null;
  private onFlushQueue?: (messages: OutgoingMessage[]) => Promise<boolean>;

  constructor() {
    this.loadQueueFromStorage();
    this.setupNetworkListeners();
    this.registerServiceWorker();
  }

  public setFlushHandler(handler: (messages: OutgoingMessage[]) => Promise<boolean>): void {
    this.onFlushHandler = handler;
  }

  private onFlushHandler?: (messages: OutgoingMessage[]) => Promise<boolean>;

  public subscribe(listener: OfflineSyncListener): () => void {
    this.listeners.add(listener);
    listener({
      isOnline: this.isOnline,
      queuedCount: this.queuedMessages.length,
      lastSavedStateTime: this.lastSavedStateTime,
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = {
      isOnline: this.isOnline,
      queuedCount: this.queuedMessages.length,
      lastSavedStateTime: this.lastSavedStateTime,
    };
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notify();
      this.flushQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notify();
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'CDI_SYNC_TRIGGERED') {
          console.log('[OfflineSyncManager] Recebido CDI_SYNC_TRIGGERED do Service Worker.');
          this.flushQueue();
        }
      });
    }
  }

  private async registerServiceWorker(): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.swRegistration = registration;
      console.log('[OfflineSyncManager] Service Worker registrado com sucesso:', registration.scope);
    } catch (err) {
      console.warn('[OfflineSyncManager] Falha ao registrar Service Worker:', err);
    }
  }

  /**
   * Persists the latest CDI state (agent name, model, last position, chat summary)
   */
  public saveLastCDIState(state: {
    agentId: string;
    agentName: string;
    modelName: string;
    expression: string;
    animation: string;
    messageCount: number;
    lastActive: number;
  }): void {
    try {
      localStorage.setItem(STORAGE_LAST_STATE_KEY, JSON.stringify(state));
      this.lastSavedStateTime = state.lastActive;
      this.notify();
    } catch (err) {
      console.warn('Erro ao salvar último estado do CDI:', err);
    }
  }

  /**
   * Retrieves the last saved CDI state when offline
   */
  public getLastCDIState(): {
    agentId: string;
    agentName: string;
    modelName: string;
    expression: string;
    animation: string;
    messageCount: number;
    lastActive: number;
  } | null {
    try {
      const raw = localStorage.getItem(STORAGE_LAST_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Enqueues an outbound message when offline
   */
  public enqueueMessage(payload: OutgoingMessage): void {
    const item: QueuedMessage = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      payload,
      timestamp: Date.now(),
    };

    this.queuedMessages.push(item);
    this.persistQueue();
    this.notify();

    // Request Background Sync from Service Worker if supported
    if (this.swRegistration && 'sync' in this.swRegistration) {
      try {
        (this.swRegistration as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync
          .register('sync-messages')
          .catch(() => {});
      } catch {}
    }
  }

  /**
   * Flushes queued messages to the WebSocket gateway
   */
  public async flushQueue(): Promise<void> {
    if (this.queuedMessages.length === 0 || !this.isOnline) return;

    console.log(`[OfflineSyncManager] Sincronizando ${this.queuedMessages.length} mensagens em fila...`);

    if (this.onFlushHandler) {
      const payloads = this.queuedMessages.map((q) => q.payload);
      try {
        const success = await this.onFlushHandler(payloads);
        if (success) {
          this.queuedMessages = [];
          this.persistQueue();
          this.notify();
          console.log('[OfflineSyncManager] Fila sincronizada com sucesso!');
        }
      } catch (err) {
        console.warn('[OfflineSyncManager] Falha ao sincronizar mensagens:', err);
      }
    }
  }

  private persistQueue(): void {
    try {
      localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(this.queuedMessages));
    } catch {}
  }

  private loadQueueFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_QUEUE_KEY);
      if (raw) {
        this.queuedMessages = JSON.parse(raw);
      }
    } catch {}
  }

  public getQueuedCount(): number {
    return this.queuedMessages.length;
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }
}
