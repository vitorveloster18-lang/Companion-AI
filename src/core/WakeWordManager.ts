/**
 * WakeWordManager: Local, client-side Wake Word Detection using Web Speech API (no cloud).
 * Supports "Ei Kairós", agent names, continuous background audio keep-alive for screen-off execution,
 * and emits the "wake.detected" protocol event to the runtime.
 */

import { WakeDetectedMessage } from '../types/protocol';

export interface WakeWordState {
  isActive: boolean;
  isListening: boolean;
  isSupported: boolean;
  lastDetectedWord: string | null;
  lastDetectedTime: number | null;
  targetWords: string[];
}

export type WakeWordListener = (state: WakeWordState) => void;

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: () => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEventLike) => void;
  onresult: (event: SpeechRecognitionEventLike) => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export class WakeWordManager {
  private recognition: SpeechRecognitionInstance | null = null;
  private isActive: boolean = false;
  private isListening: boolean = false;
  private isSupported: boolean = false;
  private targetWords: string[] = ['ei kairos', 'kairos', 'hey kairos', 'ola kairos', 'ok kairos'];
  private currentAgentName: string = 'Kairós';
  private lastDetectedWord: string | null = null;
  private lastDetectedTime: number | null = null;
  private listeners: Set<WakeWordListener> = new Set();

  // Background Audio Keep-Alive (keeps mic and timers active when screen is turned off)
  private silentAudioContext: AudioContext | null = null;
  private silentGainNode: GainNode | null = null;
  private backgroundKeepAliveInterval: number | null = null;

  // Callback when wake word is detected
  private onWakeCallback?: (msg: WakeDetectedMessage) => void;

  constructor() {
    this.checkSupport();
    this.initSpeechRecognition();
  }

  public setOnWakeCallback(cb: (msg: WakeDetectedMessage) => void): void {
    this.onWakeCallback = cb;
  }

  public setAgentName(name: string): void {
    this.currentAgentName = name;
    const normalized = this.normalize(name);
    this.targetWords = Array.from(
      new Set([
        'ei kairos',
        'kairos',
        'hey kairos',
        'ola kairos',
        'ok kairos',
        `ei ${normalized}`,
        `hey ${normalized}`,
        `ola ${normalized}`,
        `ok ${normalized}`,
        normalized,
      ])
    );
    this.notify();
  }

  public subscribe(listener: WakeWordListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): WakeWordState {
    return {
      isActive: this.isActive,
      isListening: this.isListening,
      isSupported: this.isSupported,
      lastDetectedWord: this.lastDetectedWord,
      lastDetectedTime: this.lastDetectedTime,
      targetWords: this.targetWords,
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private checkSupport(): void {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionClass =
        (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
      this.isSupported = !!SpeechRecognitionClass;
    }
  }

  private initSpeechRecognition(): void {
    if (typeof window === 'undefined' || !this.isSupported) return;

    try {
      const SpeechClass =
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

      if (!SpeechClass) return;

      const recognition = new SpeechClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      recognition.lang = 'pt-PT';

      recognition.onstart = () => {
        this.isListening = true;
        this.notify();
      };

      recognition.onend = () => {
        this.isListening = false;
        this.notify();
        // Automatically restart if user enabled wake word detection
        if (this.isActive) {
          setTimeout(() => {
            if (this.isActive && !this.isListening) {
              try {
                this.recognition?.start();
              } catch {}
            }
          }, 250);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        if (event.error === 'no-speech') {
          // Standard timeout without speech, restart gracefully
          return;
        }
        if (event.error === 'not-allowed') {
          console.warn('[WakeWordManager] Permissão de microfone negada para Wake Word.');
          this.isActive = false;
          this.stopBackgroundAudioKeepAlive();
          this.notify();
          return;
        }
        console.warn('[WakeWordManager] Erro no SpeechRecognition:', event.error);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = res[0]?.transcript || '';
          this.evaluateTranscript(transcript);
        }
      };

      this.recognition = recognition;
    } catch (err) {
      console.warn('[WakeWordManager] Falha ao instanciar Web Speech Recognition:', err);
    }
  }

  private normalize(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  private evaluateTranscript(rawTranscript: string): void {
    if (!rawTranscript) return;
    const text = this.normalize(rawTranscript);

    // Cooldown check: avoid multiple wake triggers in quick succession (min 3.5s)
    const now = Date.now();
    if (this.lastDetectedTime && now - this.lastDetectedTime < 3500) {
      return;
    }

    for (const target of this.targetWords) {
      // Check for whole word / phrase match
      const regex = new RegExp(`\\b${target}\\b`, 'i');
      if (regex.test(text) || text.includes(target)) {
        this.handleWakeDetected(target);
        break;
      }
    }
  }

  private handleWakeDetected(matchedPhrase: string): void {
    this.lastDetectedWord = this.currentAgentName;
    this.lastDetectedTime = Date.now();
    this.notify();

    console.log(`[WakeWordManager] ⚡ Wake word detetada: "${matchedPhrase}" (Agente: ${this.currentAgentName})`);

    // 1. Play futuristic wake chime
    this.playWakeChime();

    // 2. Haptic vibration
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([150, 70, 220]);
      } catch {}
    }

    // 3. Dispatch protocol message
    const wakeMsg: WakeDetectedMessage = {
      type: 'wake.detected',
      word: this.currentAgentName,
      timestamp: Math.floor(Date.now() / 1000),
      agent_id: this.currentAgentName.toLowerCase(),
    };

    if (this.onWakeCallback) {
      this.onWakeCallback(wakeMsg);
    }
  }

  public simulateWakeWord(word?: string): void {
    this.handleWakeDetected(word || this.targetWords[0] || `ei ${this.currentAgentName.toLowerCase()}`);
  }

  public async start(): Promise<boolean> {
    if (!this.isSupported || !this.recognition) return false;

    this.isActive = true;
    this.startBackgroundAudioKeepAlive();

    try {
      this.recognition.start();
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  public stop(): void {
    this.isActive = false;
    this.stopBackgroundAudioKeepAlive();

    try {
      this.recognition?.stop();
    } catch {}

    this.isListening = false;
    this.notify();
  }

  public toggle(): boolean {
    if (this.isActive) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  /**
   * Background Audio & MediaSession Keep-Alive for Screen-Off listening:
   * Keeps the browser process, microphone input, and JavaScript event loop alive
   * when mobile screen is turned off or device enters sleep.
   */
  private startBackgroundAudioKeepAlive(): void {
    if (typeof window === 'undefined') return;

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtxClass && !this.silentAudioContext) {
        const ctx = new AudioCtxClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Sub-audible constant carrier at 0 amplitude
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.00001, ctx.currentTime);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        this.silentAudioContext = ctx;
        this.silentGainNode = gain;
      }

      // Configure MediaSession for screen-off playback continuity
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `CDI Companion • Escuta Ativa`,
          artist: this.currentAgentName,
          album: 'Local Wake Word Engine',
          artwork: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        });
        navigator.mediaSession.playbackState = 'playing';
      }

      // Periodically ping Service Worker to prevent worker suspension
      if ('serviceWorker' in navigator && !this.backgroundKeepAliveInterval) {
        this.backgroundKeepAliveInterval = window.setInterval(() => {
          navigator.serviceWorker.controller?.postMessage({
            type: 'KEEP_ALIVE_PING',
            timestamp: Date.now(),
          });
        }, 15000);
      }
    } catch (err) {
      console.warn('[WakeWordManager] Falha ao iniciar Background Audio Keep-Alive:', err);
    }
  }

  private stopBackgroundAudioKeepAlive(): void {
    try {
      if (this.silentAudioContext) {
        this.silentAudioContext.close().catch(() => {});
        this.silentAudioContext = null;
      }
      if (this.backgroundKeepAliveInterval) {
        clearInterval(this.backgroundKeepAliveInterval);
        this.backgroundKeepAliveInterval = null;
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
    } catch {}
  }

  /**
   * Synthesize clean futuristic double-tone wake chime
   */
  private playWakeChime(): void {
    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      const ctx = new AudioCtxClass();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.16); // C6

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch {}
  }
}
