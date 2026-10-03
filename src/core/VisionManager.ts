/**
 * VisionManager: Handles device camera capture, canvas frame extraction,
 * auto-scan interval loops, and packaging as vision.frame messages.
 */

import { VisionFrameMessage, VisionResponseMessage } from '../types/protocol';

export type VisionListener = (state: {
  isStreaming: boolean;
  isAutoScanning: boolean;
  lastCapturedUrl: string | null;
  lastResponse: VisionResponseMessage | null;
  error: string | null;
}) => void;

export class VisionManager {
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private autoScanTimer: number | null = null;

  private isStreaming = false;
  private isAutoScanning = false;
  private lastCapturedUrl: string | null = null;
  private lastResponse: VisionResponseMessage | null = null;
  private error: string | null = null;

  private listeners: Set<VisionListener> = new Set();
  private onFrameCaptured?: (frame: VisionFrameMessage) => void;

  constructor() {
    if (typeof document !== 'undefined') {
      this.canvasElement = document.createElement('canvas');
      this.videoElement = document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
    }
  }

  public setOnFrameCaptured(callback: (frame: VisionFrameMessage) => void): void {
    this.onFrameCaptured = callback;
  }

  public subscribe(listener: VisionListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = {
      isStreaming: this.isStreaming,
      isAutoScanning: this.isAutoScanning,
      lastCapturedUrl: this.lastCapturedUrl,
      lastResponse: this.lastResponse,
      error: this.error,
    };
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  /**
   * Start Camera Stream
   */
  public async startCamera(): Promise<void> {
    if (this.isStreaming && this.mediaStream) return;

    try {
      this.error = null;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      this.mediaStream = stream;
      if (this.videoElement) {
        this.videoElement.srcObject = stream;
        await this.videoElement.play();
      }

      this.isStreaming = true;
      this.notify();
    } catch (err: any) {
      console.error('[VisionManager] Erro ao iniciar câmara:', err);
      this.error = err?.message || 'Falha ao acessar a câmara do dispositivo.';
      this.isStreaming = false;
      this.notify();
      throw err;
    }
  }

  /**
   * Stop Camera Stream
   */
  public stopCamera(): void {
    this.stopAutoScan();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.isStreaming = false;
    this.notify();
  }

  /**
   * Capture a single frame as JPEG base64 and dispatch vision.frame
   */
  public captureFrame(source = 'camera_front'): VisionFrameMessage | null {
    if (!this.videoElement || !this.canvasElement || !this.isStreaming) {
      return null;
    }

    const video = this.videoElement;
    const canvas = this.canvasElement;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, width, height);

    // Convert to JPEG data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64Data = dataUrl.split(',')[1] || '';

    this.lastCapturedUrl = dataUrl;

    const frameId = `frame_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const message: VisionFrameMessage = {
      type: 'vision.frame',
      id: frameId,
      format: 'jpeg',
      data: base64Data,
      source,
    };

    if (this.onFrameCaptured) {
      this.onFrameCaptured(message);
    }

    this.notify();
    return message;
  }

  /**
   * Start periodic auto-scanning (every intervalSeconds)
   */
  public startAutoScan(intervalSeconds = 3): void {
    this.stopAutoScan();
    this.isAutoScanning = true;

    // Take initial capture immediately
    this.captureFrame();

    this.autoScanTimer = window.setInterval(() => {
      if (this.isStreaming) {
        this.captureFrame();
      }
    }, intervalSeconds * 1000);

    this.notify();
  }

  public stopAutoScan(): void {
    if (this.autoScanTimer !== null) {
      clearInterval(this.autoScanTimer);
      this.autoScanTimer = null;
    }
    this.isAutoScanning = false;
    this.notify();
  }

  public handleVisionResponse(response: VisionResponseMessage): void {
    this.lastResponse = response;
    this.notify();
  }
}
