/**
 * SceneSoundtrackManager: Synthesizes real-time procedural ambient music & soundscapes
 * (rain, fireplace, sleep lullaby, calm ambient, creative pulse) using Web Audio API.
 * 100% offline, procedural, zero external audio asset dependencies.
 */

export class SceneSoundtrackManager {
  private ctx: AudioContext | null = null;
  private currentTrack: string | null = null;
  private isMuted: boolean = true; // Default muted until user interacts/toggles
  private volume: number = 0.4;
  private masterGain: GainNode | null = null;
  private activeNodes: { stop?: () => void; disconnect?: () => void }[] = [];
  private rainNoiseNode: AudioNode | null = null;
  private timerId: number | null = null;

  constructor() {}

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioClass) {
        this.ctx = new AudioClass();
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
        gain.connect(this.ctx.destination);
        this.masterGain = gain;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.initContext();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.2);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getCurrentTrack(): string | null {
    return this.currentTrack;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.1);
    }
  }

  public playTrack(track: string): void {
    if (this.currentTrack === track) return;
    this.stopCurrent();
    this.currentTrack = track;

    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    switch (track) {
      case 'rain':
      case 'melancholic_piano':
        this.startRainSoundscape(ctx);
        break;
      case 'fireplace_crackle':
        this.startFireplaceSoundscape(ctx);
        break;
      case 'gentle_lullaby':
        this.startLullabySoundscape(ctx);
        break;
      case 'creative_pulse':
        this.startCreativeSoundscape(ctx);
        break;
      case 'ambient_calm':
      default:
        this.startCalmAmbientSoundscape(ctx);
        break;
    }
  }

  public stop(): void {
    this.stopCurrent();
    this.currentTrack = null;
  }

  private stopCurrent(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    for (const node of this.activeNodes) {
      try {
        node.stop?.();
        node.disconnect?.();
      } catch {}
    }
    this.activeNodes = [];
  }

  /**
   * 1. Rain Soundscape: Filtered pink noise + occasional soft thunder roll
   */
  private startRainSoundscape(ctx: AudioContext): void {
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    const rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0.35, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(rainGain);
    rainGain.connect(this.masterGain!);

    whiteNoise.start();
    this.activeNodes.push(whiteNoise, filter, rainGain);
  }

  /**
   * 2. Fireplace Crackle: Low frequency rumble + intermittent bursts of micro-crackle
   */
  private startFireplaceSoundscape(ctx: AudioContext): void {
    // Low rumble
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(55, ctx.currentTime);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.08, ctx.currentTime);

    osc.connect(rumbleGain);
    rumbleGain.connect(this.masterGain!);
    osc.start();
    this.activeNodes.push(osc, rumbleGain);

    // Crackle noise generator
    this.timerId = window.setInterval(() => {
      if (!ctx || this.isMuted) return;
      if (Math.random() < 0.4) {
        const snap = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snap.type = 'square';
        snap.frequency.setValueAtTime(1200 + Math.random() * 2400, ctx.currentTime);
        snapGain.gain.setValueAtTime(0.02 + Math.random() * 0.04, ctx.currentTime);
        snapGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);

        snap.connect(snapGain);
        snapGain.connect(this.masterGain!);
        snap.start();
        snap.stop(ctx.currentTime + 0.04);
      }
    }, 120);
  }

  /**
   * 3. Gentle Lullaby (Sleep mode): Warm binaural 432Hz sine tone with alpha wave pulsing
   */
  private startLullabySoundscape(ctx: AudioContext): void {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(216, ctx.currentTime); // A3 (432/2)

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(220, ctx.currentTime); // 4Hz delta beat

    gain.gain.setValueAtTime(0.06, ctx.currentTime);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain!);

    osc1.start();
    osc2.start();
    this.activeNodes.push(osc1, osc2, gain);
  }

  /**
   * 4. Creative Pulse: Soft rhythmic ambient focus pulse (A minor triad arpeggiation)
   */
  private startCreativeSoundscape(ctx: AudioContext): void {
    const baseFreqs = [220, 261.63, 329.63, 440];
    let noteIndex = 0;

    this.timerId = window.setInterval(() => {
      if (!ctx || this.isMuted) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreqs[noteIndex % baseFreqs.length], ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start();
      osc.stop(ctx.currentTime + 1.3);

      noteIndex++;
    }, 800);
  }

  /**
   * 5. Calm Ambient (Happy/Daylight): Warm chords with gentle harmonic shimmer
   */
  private startCalmAmbientSoundscape(ctx: AudioContext): void {
    const freqs = [174.61, 261.63, 329.63]; // Fmaj7 feel
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.035, ctx.currentTime);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start();
      this.activeNodes.push(osc, gain);
    }
  }
}
