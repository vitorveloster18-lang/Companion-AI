/**
 * AgentConnection: Native browser WebSocket communication manager for the Python runtime.
 */

import { ConnectionStatus, LogEntry, OutgoingMessage } from '../types/protocol';

export type MessageHandler = (data: unknown, rawText: string) => void;
export type StatusHandler = (status: ConnectionStatus, url: string) => void;
export type LogHandler = (entry: LogEntry) => void;

function getDefaultWsUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/ws?type=ui`;
  }
  return 'ws://localhost:3000/api/ws?type=ui';
}

export class AgentConnection {
  private ws: WebSocket | null = null;
  private url: string;
  private status: ConnectionStatus = 'disconnected';
  private shouldReconnect = true;
  private reconnectTimer: number | null = null;
  private reconnectIntervalMs = 3000;

  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private logHandlers: Set<LogHandler> = new Set();
  private logHistory: LogEntry[] = [];
  private maxLogs = 200;

  constructor(defaultUrl?: string) {
    this.url = defaultUrl || getDefaultWsUrl();
  }

  public getUrl(): string {
    return this.url;
  }

  public setUrl(newUrl: string): void {
    if (this.url !== newUrl) {
      this.url = newUrl;
      if (this.status === 'connected' || this.status === 'connecting') {
        this.reconnect();
      }
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getLogs(): LogEntry[] {
    return [...this.logHistory];
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  public onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status, this.url);
    return () => this.statusHandlers.delete(handler);
  }

  public onLog(handler: LogHandler): () => void {
    this.logHandlers.add(handler);
    return () => this.logHandlers.delete(handler);
  }

  public connect(): void {
    this.shouldReconnect = true;
    this.clearReconnectTimer();

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');
    this.logSystem(`Iniciando conexão com ${this.url}...`);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.setStatus('connected');
        this.logSystem(`Conectado com sucesso em ${this.url}`);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        const rawText = typeof event.data === 'string' ? event.data : '';
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = rawText;
        }

        this.addLog({
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          direction: 'in',
          payload: parsed,
          rawText,
        });

        for (const handler of this.messageHandlers) {
          try {
            handler(parsed, rawText);
          } catch (err) {
            console.error('Erro ao processar mensagem recebida:', err);
          }
        }
      };

      this.ws.onerror = (event: Event) => {
        console.warn('WebSocket connection error:', event);
        this.setStatus('error');
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.setStatus('disconnected');
        this.ws = null;
        this.logSystem(`Conexão fechada (${event.code} ${event.reason || 'Normal'}).`);
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.warn('Erro ao instanciar WebSocket:', err);
      this.setStatus('error');
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
    this.logSystem('Desconectado manualmente.');
  }

  public reconnect(): void {
    this.disconnect();
    this.connect();
  }

  public send(message: OutgoingMessage | object | string): boolean {
    const raw = typeof message === 'string' ? message : JSON.stringify(message);
    const parsed = typeof message === 'string' ? JSON.parse(message) : message;

    this.addLog({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      direction: 'out',
      payload: parsed,
      rawText: raw,
    });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(raw);
      return true;
    } else {
      console.warn('WebSocket não conectado. Mensagem não enviada:', raw);
      return false;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectTimer = window.setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, this.reconnectIntervalMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const handler of this.statusHandlers) {
      handler(this.status, this.url);
    }
  }

  private logSystem(message: string): void {
    this.addLog({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      direction: 'system',
      payload: { message },
      rawText: message,
    });
  }

  private addLog(entry: LogEntry): void {
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxLogs) {
      this.logHistory.shift();
    }
    for (const handler of this.logHandlers) {
      handler(entry);
    }
  }
}
