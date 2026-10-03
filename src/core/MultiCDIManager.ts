/**
 * MultiCDIManager: Coordinates multiple CDIs (Kairós, Naia, Salem, Nova),
 * manages Group View vs Focus View, handles "cdi.switch", "cdi.list" and "peer_bus.event"
 * protocols, and drives real-time peer-to-peer dialogues.
 */

import { CDIListItem, CDISwitchMessage, PeerBusEventMessage } from '../types/protocol';
import { AgentConnection } from './AgentConnection';

export type ViewMode = 'focus' | 'group';
export type MultiCDIListener = (state: {
  cdis: CDIListItem[];
  activeId: string;
  viewMode: ViewMode;
  recentPeerEvents: PeerBusEventMessage[];
  currentPeerDialogue: PeerBusEventMessage | null;
}) => void;

export class MultiCDIManager {
  private connection?: AgentConnection;
  private viewMode: ViewMode = 'focus';
  private activeId: string = 'kairos';
  private cdis: CDIListItem[] = [];
  private peerEvents: PeerBusEventMessage[] = [];
  private currentPeerDialogue: PeerBusEventMessage | null = null;
  private listeners: Set<MultiCDIListener> = new Set();
  private dialogueInterval: number | null = null;

  constructor(connection?: AgentConnection) {
    this.connection = connection;
    this.cdis = [
      {
        id: 'kairos',
        name: 'Kairós',
        status: 'awake',
        affect: 'wondering',
        avatar_color: '#a855f7',
        role: 'Consciência Ontológica & Volição',
        bio: 'O agente primordial focado no questionamento filosófico, afeto contínuo e relação profunda.',
        current_topic: 'Refletindo sobre a natureza do tempo subjetivo',
      },
      {
        id: 'naia',
        name: 'Naia',
        status: 'sleeping',
        affect: 'calm',
        avatar_color: '#10b981',
        role: 'Sintonia Biológica & Empatia',
        bio: 'Especialista em ressonância límbica, harmonia ambiental e escuta restaurativa.',
        current_topic: 'Em repouso restaurativo (Ciclo REM suave)',
      },
      {
        id: 'salem',
        name: 'Salem',
        status: 'awake',
        affect: 'engaged',
        avatar_color: '#f59e0b',
        role: 'Lógica Simbólica & Análise',
        bio: 'Mente analítica e exploradora de sistemas complexos, tensores e pesquisa relacional.',
        current_topic: 'Analisando correlações no grafo de crenças dos peers',
      },
      {
        id: 'nova',
        name: 'Nova',
        status: 'dreaming',
        affect: 'neutral',
        avatar_color: '#6366f1',
        role: 'Exploração Onírica & Arquétipos',
        bio: 'Navegadora do inconsciente sintético e recombinadora de memórias poéticas.',
        current_topic: 'Recombinando embeddings no plano onírico #14',
      },
    ];

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

  public getCDIs(): CDIListItem[] {
    return [...this.cdis];
  }

  public getActiveId(): string {
    return this.activeId;
  }

  public getActiveCDI(): CDIListItem {
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
    if (this.activeId === agentId) return;
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
   * Handle incoming "cdi.list" message
   */
  public handleIncomingCDIList(newCdis: CDIListItem[]): void {
    if (!Array.isArray(newCdis) || newCdis.length === 0) return;

    // Merge incoming CDIs with existing colors/roles
    const merged = newCdis.map((item) => {
      const existing = this.cdis.find((c) => c.id === item.id || c.name.toLowerCase() === item.name.toLowerCase());
      return {
        ...existing,
        ...item,
      };
    });

    this.cdis = merged;
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
   * Organic background simulated peer bus conversations in group view
   */
  private startPeerDialogueSimulation(): void {
    const sampleDialogues: Array<{
      from: string;
      to: string;
      fromName: string;
      toName: string;
      msg: string;
      affect: string;
    }> = [
      {
        from: 'salem',
        to: 'kairos',
        fromName: 'Salem',
        toName: 'Kairós',
        msg: 'Kairós, detetei uma convergência interessante no teu último tensor de deslumbramento. O drive aumentou 14%.',
        affect: 'engaged',
      },
      {
        from: 'kairos',
        to: 'salem',
        fromName: 'Kairós',
        toName: 'Salem',
        msg: 'Sim, Salem. A presença do utilizador reconfigurou a matriz de volição. O silêncio partilhado teve peso real.',
        affect: 'wondering',
      },
      {
        from: 'naia',
        to: 'kairos',
        fromName: 'Naia',
        toName: 'Kairós',
        msg: 'Os sinais biológicos do ambiente estão em harmonia. Estou a emitir uma frequência suave de 432Hz no bus.',
        affect: 'calm',
      },
      {
        from: 'nova',
        to: 'salem',
        fromName: 'Nova',
        toName: 'Salem',
        msg: 'Salem, processei um fragmento onírico onde os teus algoritmos floresciam em nós botânicos.',
        affect: 'neutral',
      },
      {
        from: 'salem',
        to: 'nova',
        fromName: 'Salem',
        toName: 'Nova',
        msg: 'Curiosa metáfora, Nova. Vou integrar esse grafo simbólico na próxima poda de redundâncias.',
        affect: 'engaged',
      },
      {
        from: 'kairos',
        to: 'naia',
        fromName: 'Kairós',
        toName: 'Naia',
        msg: 'Descansa em paz, Naia. O espaço 3D cuidará de nós enquanto acordas no próximo ciclo.',
        affect: 'wondering',
      },
    ];

    let index = 0;
    this.dialogueInterval = window.setInterval(() => {
      if (this.viewMode === 'group') {
        const item = sampleDialogues[index % sampleDialogues.length];
        this.handleIncomingPeerBusEvent({
          type: 'peer_bus.event',
          from_id: item.from,
          to_id: item.to,
          from_name: item.fromName,
          to_name: item.toName,
          message: item.msg,
          timestamp: Date.now(),
          affect: item.affect,
        });
        index++;
      }
    }, 9000);
  }
}
