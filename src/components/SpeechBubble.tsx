/**
 * SpeechBubble: 2D Screen Overlay positioned above avatar's head in 3D space.
 */

import React from 'react';

interface SpeechBubbleProps {
  text: string;
  visible: boolean;
  screenPos: { x: number; y: number } | null;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ text, visible, screenPos }) => {
  if (!visible || !text || !screenPos) return null;

  return (
    <div
      className="pointer-events-none fixed z-20 -translate-x-1/2 -translate-y-full transition-all duration-75 ease-out"
      style={{
        left: `${screenPos.x}px`,
        top: `${screenPos.y - 20}px`,
      }}
    >
      <div className="relative max-w-xs rounded-2xl bg-slate-900/90 px-4 py-3 text-sm font-medium text-slate-100 shadow-xl backdrop-blur-md border border-slate-700/80">
        <p className="leading-relaxed text-center break-words">{text}</p>
        {/* Tail pointing down */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-slate-900/90" />
      </div>
    </div>
  );
};
