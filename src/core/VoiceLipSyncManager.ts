/**
 * VoiceLipSyncManager: Web Audio API playback, real-time AnalyserNode amplitude analysis,
 * accurate VRM viseme lip-sync scheduling, and Microphone WebM recording.
 */

import { AudioOutputMessage, AudioInputMessage, VisemeFrame } from '../types/protocol';
import { AvatarController } from './AvatarController';

export interface AudioRecordingResult {
  id: string;
  format: string;
  data: string; // base64
  duration: number;
}

export class VoiceLipSyncManager {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentAnalyser: AnalyserNode | null = null;
  private analyserAnimationId: number | null = null;
  private avatarController: AvatarController | null = null;

  // Recording State
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStartTime = 0;
  private isRecordingActive = false;
  private recordingAnalyser: AnalyserNode | null = null;
  private recordingRafId: number | null = null;

  constructor(avatarController?: AvatarController) {
    if (avatarController) {
      this.avatarController = avatarController;
    }
  }

  public setAvatarController(controller: AvatarController): void {
    this.avatarController = controller;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  /**
   * Convert base64 string to ArrayBuffer safely in browser
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const cleanBase64 = base64.replace(/^data:audio\/[^;]+;base64,/, '').trim();
    const binaryString = window.atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Play received audio output and synchronize avatar mouth/visemes
   */
  public async playAudioOutput(message: AudioOutputMessage): Promise<void> {
    if (!message.data) return;

    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Stop any ongoing playback
      this.stopPlayback();

      const arrayBuffer = this.base64ToArrayBuffer(message.data);
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Create Source & Analyser
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;

      source.connect(analyser);
      analyser.connect(ctx.destination);

      this.currentSource = source;
      this.currentAnalyser = analyser;

      // Start lip-sync in AvatarController
      if (this.avatarController) {
        this.avatarController.startLipSyncAudio(audioBuffer.duration, message.visemes);
        this.avatarController.setAnimation('talk');
      }

      // Monitor live audio amplitude
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateAmplitude = () => {
        if (!this.currentAnalyser || !this.avatarController) return;

        this.currentAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalizedAmp = Math.min(1.0, average / 85.0);

        this.avatarController.setAudioAmplitude(normalizedAmp);
        this.analyserAnimationId = requestAnimationFrame(updateAmplitude);
      };

      this.analyserAnimationId = requestAnimationFrame(updateAmplitude);

      source.onended = () => {
        this.stopPlayback();
      };

      source.start(0);
    } catch (err) {
      console.error('[VoiceLipSyncManager] Erro ao reproduzir audio.output:', err);
      this.stopPlayback();
    }
  }

  public stopPlayback(): void {
    if (this.analyserAnimationId !== null) {
      cancelAnimationFrame(this.analyserAnimationId);
      this.analyserAnimationId = null;
    }

    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {}
      this.currentSource = null;
    }

    this.currentAnalyser = null;

    if (this.avatarController) {
      this.avatarController.stopLipSyncAudio();
      this.avatarController.setAnimation('idle');
    }
  }

  // =========================================================================
  // MICROPHONE RECORDING (audio.input)
  // =========================================================================

  /**
   * Start recording microphone audio
   * @param onLevelChange Callback for live recording waveform (0.0 to 1.0)
   */
  public async startRecording(onLevelChange?: (level: number) => void): Promise<void> {
    if (this.isRecordingActive) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.mediaStream = stream;
    this.recordedChunks = [];
    this.recordingStartTime = performance.now();
    this.isRecordingActive = true;

    // Optional audio analysis for live waveform HUD
    const ctx = this.getAudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    this.recordingAnalyser = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkLevel = () => {
      if (!this.isRecordingActive || !this.recordingAnalyser) return;
      this.recordingAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / bufferLength;
      if (onLevelChange) {
        onLevelChange(Math.min(1, avg / 80));
      }
      this.recordingRafId = requestAnimationFrame(checkLevel);
    };

    this.recordingRafId = requestAnimationFrame(checkLevel);

    // Pick best supported MIME type
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
      else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
      else mimeType = '';
    }

    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder = recorder;
    recorder.start(100); // 100ms timeslices
  }

  /**
   * Stop recording and package as AudioRecordingResult (webm base64)
   */
  public async stopRecording(): Promise<AudioRecordingResult> {
    if (!this.isRecordingActive || !this.mediaRecorder) {
      throw new Error('Nenhuma gravação ativa.');
    }

    if (this.recordingRafId !== null) {
      cancelAnimationFrame(this.recordingRafId);
      this.recordingRafId = null;
    }

    const duration = (performance.now() - this.recordingStartTime) / 1000;
    this.isRecordingActive = false;

    return new Promise((resolve, reject) => {
      const recorder = this.mediaRecorder!;

      recorder.onstop = async () => {
        try {
          // Cleanup tracks
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = null;
          }

          const blob = new Blob(this.recordedChunks, { type: recorder.mimeType || 'audio/webm' });
          const base64 = await this.blobToBase64(blob);

          const result: AudioRecordingResult = {
            id: `audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            format: 'webm',
            data: base64,
            duration,
          };

          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.mediaRecorder = null;
          this.recordingAnalyser = null;
        }
      };

      try {
        recorder.stop();
      } catch (err) {
        reject(err);
      }
    });
  }

  public isRecording(): boolean {
    return this.isRecordingActive;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        // Strip data:audio/xxx;base64,
        const base64 = res.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
