/**
 * VisionOverlay: Cyberpunk HUD camera viewfinder with biometric scan lines,
 * emotion detection telemetry, and auto-scan controls.
 */

import React, { useEffect, useRef, useState } from 'react';
import { VisionManager } from '../core/VisionManager';
import { VisionResponseMessage } from '../types/protocol';
import { Camera, CameraOff, Scan, RefreshCw, X, Eye, Zap, Smile, Frown, Meh, AlertCircle } from 'lucide-react';

interface VisionOverlayProps {
  visionManager: VisionManager;
  isOpen: boolean;
  onClose: () => void;
  onSnapshot: () => void;
}

export const VisionOverlay: React.FC<VisionOverlayProps> = ({
  visionManager,
  isOpen,
  onClose,
  onSnapshot,
}) => {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [visionState, setVisionState] = useState({
    isStreaming: false,
    isAutoScanning: false,
    lastCapturedUrl: null as string | null,
    lastResponse: null as VisionResponseMessage | null,
    error: null as string | null,
  });

  useEffect(() => {
    return visionManager.subscribe((state) => {
      setVisionState(state);
    });
  }, [visionManager]);

  // Attach video stream element to DOM container
  useEffect(() => {
    if (!videoContainerRef.current) return;
    const video = visionManager.getVideoElement();
    if (video) {
      video.className = 'w-full h-full object-cover rounded-xl';
      videoContainerRef.current.innerHTML = '';
      videoContainerRef.current.appendChild(video);
    }
  }, [visionState.isStreaming, visionManager]);

  if (!isOpen) return null;

  const getEmotionIcon = (emotion?: string) => {
    switch (emotion?.toLowerCase()) {
      case 'happy':
        return <Smile className="w-4 h-4 text-emerald-400" />;
      case 'sad':
        return <Frown className="w-4 h-4 text-rose-400" />;
      case 'surprised':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      default:
        return <Meh className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="absolute top-16 right-4 z-40 w-72 sm:w-80 bg-black/90 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl shadow-[0_0_35px_rgba(0,240,255,0.15)] overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/90 border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-cyan-300 tracking-wider">
            // OPTIC.FEED • CDI VISION
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
            title="Minimizar câmara"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Viewport with Cyberpunk HUD Overlay */}
      <div className="relative w-full aspect-video bg-slate-950 overflow-hidden flex items-center justify-center border-b border-cyan-500/20">
        <div ref={videoContainerRef} className="w-full h-full" />

        {!visionState.isStreaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950/90 text-slate-400 gap-2">
            <CameraOff className="w-8 h-8 text-cyan-500/50" />
            <p className="text-xs font-mono">Câmara desligada</p>
            <button
              onClick={() => visionManager.startCamera()}
              className="mt-1 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold rounded-lg shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all cursor-pointer"
            >
              ATIVAR CÂMARA
            </button>
          </div>
        )}

        {visionState.isStreaming && (
          <>
            {/* Viewfinder Corner HUD Elements */}
            <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
            <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
            <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

            {/* Scanning Laser Line (when auto-scanning) */}
            {visionState.isAutoScanning && (
              <div className="absolute inset-x-0 h-0.5 bg-cyan-400 shadow-[0_0_10px_#00f0ff] animate-bounce pointer-events-none" />
            )}

            {/* Target Crosshair */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
              <div className="w-16 h-16 border border-cyan-400/50 rounded-full border-dashed animate-spin" />
            </div>

            {/* Live Indicator */}
            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 rounded text-[9px] font-mono text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE</span>
            </div>
          </>
        )}
      </div>

      {/* Real-Time Vision Response / Emotion HUD */}
      {visionState.lastResponse && (
        <div className="p-2.5 bg-cyan-950/40 border-b border-cyan-500/20 text-xs font-mono">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
              // RECONHECIMENTO CDI:
            </span>
            {visionState.lastResponse.emotion_detected && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/50 border border-cyan-500/30 text-[10px] text-cyan-300">
                {getEmotionIcon(visionState.lastResponse.emotion_detected)}
                <span className="capitalize">{visionState.lastResponse.emotion_detected}</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-200 leading-snug line-clamp-2">
            "{visionState.lastResponse.description}"
          </p>
        </div>
      )}

      {/* Control Buttons */}
      <div className="p-2.5 bg-slate-950/80 flex items-center gap-2">
        <button
          onClick={onSnapshot}
          disabled={!visionState.isStreaming}
          className="flex-1 py-1.5 px-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-900 disabled:text-slate-600 text-slate-950 text-xs font-mono font-bold rounded-lg shadow-[0_0_12px_rgba(0,240,255,0.25)] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          title="Captura 1 frame e envia ao CDI (vision.frame)"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>SNAPSHOT</span>
        </button>

        <button
          onClick={() => {
            if (visionState.isAutoScanning) visionManager.stopAutoScan();
            else visionManager.startAutoScan(3);
          }}
          disabled={!visionState.isStreaming}
          className={`py-1.5 px-2.5 text-xs font-mono font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
            visionState.isAutoScanning
              ? 'bg-rose-950/60 border-rose-500/50 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)] animate-pulse'
              : 'bg-slate-900 hover:bg-slate-800 border-cyan-500/30 text-cyan-300'
          }`}
          title={visionState.isAutoScanning ? 'Parar escaneamento contínuo' : 'Escanear a cada 3 segundos'}
        >
          <Scan className="w-3.5 h-3.5" />
          <span>{visionState.isAutoScanning ? 'PARAR' : 'AUTO-SCAN'}</span>
        </button>
      </div>
    </div>
  );
};
