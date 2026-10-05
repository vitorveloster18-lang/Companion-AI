/**
 * MultiCDIManager: Coordinates dynamic bot instances and CDIs created in the interface.
 * Manages Group View vs Focus View, handles "cdi.switch", "cdi.list" and "peer_bus.event"
 * protocols, and drives real-time peer-to-peer dialogues between actually existing bots.
 */

import { CDIListItem, CDISwitchMessage, PeerBusEventMessage, BotConfig } from '../types/protocol';
import { AgentConnection } from './AgentConnection';

export type ViewMode = 'focus' | 'group';
export type MultiCDIListener = (state: {
  cdis: CDIListItem[];
  activeId: string;
  viewMode: ViewMode;
  recentPeerEvents: PeerBusEventMessage[];
  currentPeerDialogue: PeerBusEventMessage | null;
}) => void;

const BOT_PALETTE_COLORS = [
  '#06b6d4', // Cyan
  '#a855f7', // Purple
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#f43f5e', // Rose
  '#8b5cf6', // Violet
];

export class MultiCDIManager {
  private connection?: AgentConnection;
  private viewMode: ViewMode = 'focus';
  private activeId: string = '';
  private isRuntimeConnected: boolean = false;
  private cdis: CDIListItem[] = [];
  private peerEvents: PeerBusEventMessage[] = [];
  private currentPeerDialogue: PeerBusEventMessage | null = null;
  private listeners: Set<MultiCDIListener> = new Set();
  private dialogueInterval: number | null = null;

  constructor(connection?: AgentConnection) {
    this.connection = connection;
    this.startPeerDialogueSimulation();
  }

  public setConnection(connection: AgentConnection): void {
    this.connection = connection;
  }

  public subscribe(listener: MultiCDIListener): () => void {
    this.listeners.add(listener);
    this.emitChange();
    return () => this.listeners.delete(listener);
  }

  private emitChange(): void {
    const payload = {
      cdis: [...this.cdis],
      activeId: this.activeId,
      viewMode: this.viewMode,
      recentPeerEvents: [...this.peerEvents],
      currentPeerDialogue: this.currentPeerDialogue,
    };
    for (const l of this.listeners) {
      l(payload);
    }
  }

  /**
   * Synchronizes CDI list dynamically with real bots created in the interface or loaded from backend.
   */
  public syncWithBots(bots: BotConfig[]): void {
    if (!Array.isArray(bots)) return;

    if (bots.length === 0) {
      this.cdis = [];
      this.activeId = '';
      this.emitChange();
      return;
    }

    const updatedCDIs: CDIListItem[] = bots.map((bot, index) => {
      const existing = this.cdis.find((c) => c.id === bot.id);
      const color = BOT_PALETTE_COLORS[index % BOT_PALETTE_COLORS.length];

      return {
        id: bot.id,
        name: bot.name,
        status: bot.is_online ? (existing?.status || 'awake') : 'sleeping',
        affect: existing?.affect || 'wondering',
        avatar_color: existing?.avatar_color || color,
        role: bot.role || 'Instância de Agente Python',
        bio: existing?.bio || `Bot configurado: @${bot.username || bot.name.toLowerCase()}`,
        current_topic: existing?.current_topic || (bot.is_online ? 'Pronto para interagir' : 'Aguardando conexão do script'),
      };
    });

    this.cdis = updatedCDIs;

    // Ensure activeId is valid
    if (!this.cdis.some((c) => c.id === this.activeId)) {
      this.activeId = this.cdis[0]?.id || '';
    }

    this.emitChange();
  }

  public getCDIs(): CDIListItem[] {
    return [...this.cdis];
  }

  public getActiveId(): string {
    return this.activeId;
  }

  public setRuntimeConnected(connected: boolean): void {
    this.isRuntimeConnected = connected;
  }

  public getActiveCDI(): CDIListItem | null {
    if (this.cdis.length === 0) return null;
    return this.cdis.find((c) => c.id === this.activeId) || this.cdis[0];
  }

  public getViewMode(): ViewMode {
    return this.viewMode;
  }

  public setViewMode(mode: ViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.emitChange();
  }

  public toggleViewMode(): ViewMode {
    this.viewMode = this.viewMode === 'focus' ? 'group' : 'focus';
    this.emitChange();
    return this.viewMode;
  }

  /**
   * Switch active CDI ("cdi.switch")
   */
  public switchCDI(agentId: string): void {
    if (!agentId || this.activeId === agentId) return;
    this.activeId = agentId;

    // Send cdi.switch over WebSocket
    if (this.connection) {
      const msg: CDISwitchMessage = {
        type: 'cdi.switch',
        agent_id: agentId,
      };
      this.connection.send(msg);
    }

    this.emitChange();
  }

  /**
   * Handle incoming "cdi.list" message from Gateway / Runtime
   */
  public handleIncomingCDIList(newCdis: CDIListItem[]): void {
    if (!Array.isArray(newCdis)) return;

    if (newCdis.length === 0) {
      this.cdis = [];
      this.activeId = '';
      this.emitChange();
      return;
    }

    // Merge incoming CDIs with existing colors/roles
    const merged = newCdis.map((item, index) => {
      const existing = this.cdis.find((c) => c.id === item.id);
      return {
        ...item,
        avatar_color: item.avatar_color || existing?.avatar_color || BOT_PALETTE_COLORS[index % BOT_PALETTE_COLORS.length],
      };
    });

    this.cdis = merged;
    if (!this.cdis.some((c) => c.id === this.activeId)) {
      this.activeId = this.cdis[0].id;
    }
    this.emitChange();
  }

  /**
   * Handle incoming "peer_bus.event"
   */
  public handleIncomingPeerBusEvent(event: PeerBusEventMessage): void {
    this.peerEvents = [event, ...this.peerEvents.slice(0, 30)];
    this.currentPeerDialogue = event;
    this.emitChange();

    // Auto-clear active speech bubble after 6 seconds
    setTimeout(() => {
      if (this.currentPeerDialogue === event) {
        this.currentPeerDialogue = null;
        this.emitChange();
      }
    }, 6000);
  }

  /**
   * Background simulated peer bus conversations in group view ONLY if at least 2 real bots exist
   */
  private startPeerDialogueSimulation(): void {
    let index = 0;
    this.dialogueInterval = window.setInterval(() => {
      // Only generate dialogues if in group mode, runtime is not connected, and there are AT LEAST 2 real bots
      if (this.viewMode === 'group' && !this.isRuntimeConnected && this.cdis.length >= 2) {
        const botA = this.cdis[index % this.cdis.length];
        const botB = this.cdis[(index + 1) % this.cdis.length];

        if (botA && botB && botA.id !== botB.id) {
          const sampleTemplates = [
            `Olá ${botB.name}! Sincronizando estado cognitivo e matriz de atenção.`,
            `Detetei uma convergência interessante no tensor de aprendizado.`,
            `Os parâmetros ambientais estão estabilizados para o nosso grupo.`,
            `Processando novos dados de contexto com prioridade alta.`,
            `Confirmando recebimento de sinal no barramento peer.`,
          ];

          const msg = sampleTemplates[index % sampleTemplates.length];

          this.handleIncomingPeerBusEvent({
            type: 'peer_bus.event',
            from_id: botA.id,
            to_id: botB.id,
            from_name: botA.name,
            to_name: botB.name,
            message: msg,
            timestamp: Date.now(),
            affect: botA.affect || 'wondering',
          });

          index++;
        }
      }
    }, 10000);
  }
}
