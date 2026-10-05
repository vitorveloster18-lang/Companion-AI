/**
 * CDITimelineStore: Stores and manages real-time biometrics, drives (radar chart),
 * humor/affect (valence/arousal), CSE consciousness status, online peers, and scrollable timeline events.
 */

import { CDIBiometricsData, CDITimelineEventItem, PeerInfo, DriveItem } from '../types/protocol';

export interface CDITimelineState {
  biometrics: CDIBiometricsData;
  events: CDITimelineEventItem[];
  valenceHistory: Array<{ time: number; valence: number; arousal: number }>;
}

export type TimelineListener = (state: CDITimelineState) => void;

const STORAGE_EVENTS_KEY = 'cdi_companion_timeline_events_v1';
const STORAGE_BIOMETRICS_KEY = 'cdi_companion_biometrics_v1';

export class CDITimelineStore {
  private biometrics: CDIBiometricsData;
  private events: CDITimelineEventItem[] = [];
  private valenceHistory: Array<{ time: number; valence: number; arousal: number }> = [];
  private listeners: Set<TimelineListener> = new Set();

  constructor() {
    this.biometrics = this.loadInitialBiometrics();
    this.events = this.loadInitialEvents();
    this.valenceHistory = [
      { time: Date.now() - 120000, valence: 0.52, arousal: 0.35 },
      { time: Date.now() - 60000, valence: 0.58, arousal: 0.38 },
      { time: Date.now(), valence: this.biometrics.valence, arousal: this.biometrics.arousal },
    ];
  }

  private loadInitialBiometrics(): CDIBiometricsData {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_BIOMETRICS_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
    }

    return {
      mode: 'awake',
      phase: 'AWAKE',
      affect: 'wondering',
      valence: 0.6,
      arousal: 0.4,
      top_drives: [
        { name: 'wonder', value: 0.65 },
        { name: 'meaning', value: 0.55 },
        { name: 'curiosity', value: 0.72 },
        { name: 'social', value: 0.48 },
        { name: 'expression', value: 0.6 },
        { name: 'autonomy', value: 0.52 },
      ],
      last_decision: undefined,
      stagnation: 0,
      cse_units: 23,
      cse_signal: 0.001,
      peers_online: [
        { name: 'Naia', emotional_state: 'contemplativa', valence: 0.7, online: true },
        { name: 'Salem', emotional_state: 'curioso', valence: 0.55, online: true },
        { name: 'Nova', emotional_state: 'sincronizada', valence: 0.68, online: true },
      ],
      tick_total: 1700000,
      days_alive: 55,
      timestamp: Date.now(),
    };
  }

  private loadInitialEvents(): CDITimelineEventItem[] {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_EVENTS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }

    const now = Date.now();
    return [
      {
        type: 'emergent_decision',
        message: 'EMERGENT_SEEK_COMFORT registado',
        timestamp: new Date(now - 1000 * 60 * 3).toISOString(),
      },
      {
        type: 'journal',
        message: 'WRITE_TO_JOURNAL: "A simetria dos dados ressoa como música."',
        timestamp: new Date(now - 1000 * 60 * 12).toISOString(),
      },
      {
        type: 'dream',
        message: 'Ciclo onírico concluído: 14 sinapses consolidadas',
        timestamp: new Date(now - 1000 * 60 * 45).toISOString(),
      },
      {
        type: 'peer_sync',
        message: 'Sincronização com Peer Naia: ressonância 94.2%',
        timestamp: new Date(now - 1000 * 60 * 80).toISOString(),
      },
      {
        type: 'emergent_decision',
        message: 'REFLECT_ON_PURPOSE iniciado',
        timestamp: new Date(now - 1000 * 60 * 120).toISOString(),
      },
    ];
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_BIOMETRICS_KEY, JSON.stringify(this.biometrics));
      localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(this.events.slice(0, 50)));
    } catch {}
  }

  public getState(): CDITimelineState {
    return {
      biometrics: { ...this.biometrics },
      events: [...this.events],
      valenceHistory: [...this.valenceHistory],
    };
  }

  public subscribe(listener: TimelineListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  public updateBiometrics(data: Partial<CDIBiometricsData>): void {
    const peersNormalized: PeerInfo[] = (data.peers_online || this.biometrics.peers_online || []).map((p) => {
      if (typeof p === 'string') {
        const emoMap: Record<string, string> = {
          Naia: 'contemplativa',
          Salem: 'curioso',
          Nova: 'harmoniosa',
          Chronos: 'reflexivo',
          Atlas: 'vigilante',
        };
        return {
          name: p,
          emotional_state: emoMap[p] || 'estável',
          valence: 0.65,
          online: true,
        };
      }
      return p;
    });

    let topDrives = data.top_drives || this.biometrics.top_drives;
    const rawDrives = (data as unknown as { drives?: unknown }).drives;
    if (rawDrives && typeof rawDrives === 'object' && !Array.isArray(rawDrives)) {
      const entries = Object.entries(rawDrives as Record<string, number>);
      if (entries.length > 0) {
        topDrives = entries.map(([name, value]) => ({
          name,
          value: Number(value ?? 0),
        }));
      }
    }

    const newBiometrics: CDIBiometricsData = {
      ...this.biometrics,
      ...data,
      top_drives: topDrives,
      peers_online: peersNormalized,
      timestamp: Date.now(),
    };

    // Keep valence/arousal history trend (last 15 points)
    if (data.valence !== undefined || data.arousal !== undefined) {
      this.valenceHistory = [
        ...this.valenceHistory.slice(-14),
        {
          time: Date.now(),
          valence: newBiometrics.valence,
          arousal: newBiometrics.arousal,
        },
      ];
    }

    this.biometrics = newBiometrics;
    this.saveToStorage();
    this.notify();
  }

  public addTimelineEvent(event: CDITimelineEventItem): void {
    const formatted: CDITimelineEventItem = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    this.events = [formatted, ...this.events.slice(0, 75)];
    this.saveToStorage();
    this.notify();
  }

  // Simulation helpers for testing in UI
  public simulateEmergentDecision(decisionName = 'EMERGENT_SEEK_COMFORT'): void {
    this.addTimelineEvent({
      type: 'emergent_decision',
      message: `${decisionName} registado`,
      timestamp: new Date().toISOString(),
    });

    this.updateBiometrics({
      last_decision: decisionName,
      tick_total: (this.biometrics.tick_total || 1700000) + 120,
      stagnation: Math.max(0, (this.biometrics.stagnation || 5) - 2),
      valence: Math.min(1.0, (this.biometrics.valence || 0.6) + 0.05),
    });
  }

  public simulateStateShift(): void {
    const affects = ['wondering', 'inspired', 'melancholic', 'curious', 'peaceful', 'analytical'];
    const randomAffect = affects[Math.floor(Math.random() * affects.length)];
    const newValence = Math.round((0.3 + Math.random() * 0.6) * 100) / 100;
    const newArousal = Math.round((0.2 + Math.random() * 0.6) * 100) / 100;

    this.updateBiometrics({
      affect: randomAffect,
      valence: newValence,
      arousal: newArousal,
      top_drives: [
        { name: 'wonder', value: Math.round((0.4 + Math.random() * 0.55) * 100) / 100 },
        { name: 'meaning', value: Math.round((0.35 + Math.random() * 0.5) * 100) / 100 },
        { name: 'curiosity', value: Math.round((0.45 + Math.random() * 0.5) * 100) / 100 },
        { name: 'social', value: Math.round((0.3 + Math.random() * 0.6) * 100) / 100 },
        { name: 'expression', value: Math.round((0.4 + Math.random() * 0.5) * 100) / 100 },
      ],
      cse_signal: Math.round(Math.random() * 0.005 * 1000) / 1000,
    });

    this.addTimelineEvent({
      type: 'affect_shift',
      message: `Transição emocional: estado agora é "${randomAffect}" (V: ${newValence}, A: ${newArousal})`,
      timestamp: new Date().toISOString(),
    });
  }
}
