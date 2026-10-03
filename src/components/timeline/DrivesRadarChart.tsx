/**
 * DrivesRadarChart: High-precision SVG polygon radar chart rendering CDI drives
 * (wonder, meaning, curiosity, social, expression, autonomy) with cyberpunk aesthetic.
 */

import React from 'react';
import { DriveItem } from '../../types/protocol';

interface DrivesRadarChartProps {
  drives: DriveItem[];
  size?: number;
}

export const DrivesRadarChart: React.FC<DrivesRadarChartProps> = ({ drives, size = 260 }) => {
  if (!drives || drives.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 font-mono text-xs">
        Nenhum drive biológico registado.
      </div>
    );
  }

  const center = size / 2;
  const radius = center - 38;
  const total = drives.length;

  // Concentric levels (25%, 50%, 75%, 100%)
  const levels = [0.25, 0.5, 0.75, 1.0];

  const getCoordinates = (index: number, value: number) => {
    const angle = (Math.PI * 2 / total) * index - Math.PI / 2;
    const x = center + radius * value * Math.cos(angle);
    const y = center + radius * value * Math.sin(angle);
    return { x, y };
  };

  // Build polygon points for the data
  const dataPoints = drives
    .map((drive, i) => {
      const { x, y } = getCoordinates(i, Math.min(1.0, Math.max(0.1, drive.value)));
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="overflow-visible select-none">
        <defs>
          <radialGradient id="radarFillGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.65" />
            <stop offset="60%" stopColor="#00f0ff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.1" />
          </radialGradient>
          <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Concentric grid rings */}
        {levels.map((level) => {
          const ringPoints = drives
            .map((_, i) => {
              const { x, y } = getCoordinates(i, level);
              return `${x},${y}`;
            })
            .join(' ');
          return (
            <polygon
              key={level}
              points={ringPoints}
              fill="none"
              stroke="#334155"
              strokeWidth={level === 1.0 ? '1.5' : '1'}
              strokeDasharray={level === 1.0 ? 'none' : '3,3'}
              opacity="0.45"
            />
          );
        })}

        {/* Radial Axis Lines */}
        {drives.map((_, i) => {
          const { x, y } = getCoordinates(i, 1.0);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#334155"
              strokeWidth="1"
              opacity="0.5"
            />
          );
        })}

        {/* Main Drives Polygon */}
        <polygon
          points={dataPoints}
          fill="url(#radarFillGrad)"
          stroke="#00f0ff"
          strokeWidth="2"
          filter="url(#radarGlow)"
          className="transition-all duration-500 ease-out"
        />

        {/* Vertex nodes & values */}
        {drives.map((drive, i) => {
          const { x, y } = getCoordinates(i, Math.min(1.0, Math.max(0.1, drive.value)));
          const labelCoord = getCoordinates(i, 1.24);

          return (
            <g key={drive.name} className="group">
              {/* Vertex glow dot */}
              <circle
                cx={x}
                cy={y}
                r="4.5"
                fill="#00f0ff"
                stroke="#020617"
                strokeWidth="2"
                className="transition-all duration-500 hover:scale-125"
              />

              {/* Text Label */}
              <text
                x={labelCoord.x}
                y={labelCoord.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[10px] font-mono font-bold fill-slate-300 tracking-wider uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
              >
                {drive.name}
              </text>

              {/* Value Percentage text */}
              <text
                x={labelCoord.x}
                y={labelCoord.y + 11}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[9px] font-mono fill-cyan-400 font-bold"
              >
                {Math.round(drive.value * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
