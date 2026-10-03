/**
 * CDIMemoryGalleryModal: Comprehensive Visual Timeline and Gallery of CDI Memories,
 * Artifacts, Journal Entries, Dreams, and Longitudinal Trait Evolution.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { CDIMemoryGalleryStore, TraitEvolutionPoint } from '../core/CDIMemoryGalleryStore';
import { CDIMemoryItem } from '../types/protocol';
import {
  Sparkles,
  BookOpen,
  Moon,
  TrendingUp,
  FileText,
  Search,
  X,
  Calendar,
  Tag,
  ArrowRight,
  Filter,
  CheckCircle2,
  Share2,
  Eye,
  Heart,
  Brain,
  Compass,
  Cpu,
} from 'lucide-react';

interface CDIMemoryGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  galleryStore: CDIMemoryGalleryStore;
  agentName?: string;
}

type TabType = 'all' | 'artifact' | 'journal' | 'traits' | 'dream';

export const CDIMemoryGalleryModal: React.FC<CDIMemoryGalleryModalProps> = ({
  isOpen,
  onClose,
  galleryStore,
  agentName = 'Kairós',
}) => {
  const [memories, setMemories] = useState<CDIMemoryItem[]>(galleryStore.getMemories());
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemory, setSelectedMemory] = useState<CDIMemoryItem | null>(null);

  useEffect(() => {
    return galleryStore.subscribe((updated) => {
      setMemories(updated);
    });
  }, [galleryStore]);

  const traitPoints = useMemo<TraitEvolutionPoint[]>(() => {
    return galleryStore.getTraitEvolution();
  }, [galleryStore]);

  // Filter memories by tab and search
  const filteredMemories = useMemo(() => {
    return memories.filter((item) => {
      const matchesTab = activeTab === 'all' || item.type === activeTab;
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.preview.toLowerCase().includes(query) ||
        (item.content && item.content.toLowerCase().includes(query)) ||
        (item.metadata?.tags && item.metadata.tags.some((t) => t.toLowerCase().includes(query)));

      return matchesTab && matchesSearch;
    });
  }, [memories, activeTab, searchQuery]);

  if (!isOpen) return null;

  const getEmotionBadge = (emotion?: string) => {
    switch (emotion) {
      case 'wondering':
        return { label: 'Deslumbramento', color: 'bg-purple-950 text-purple-300 border-purple-500/40' };
      case 'inspired':
        return { label: 'Inspirado', color: 'bg-cyan-950 text-cyan-300 border-cyan-500/40' };
      case 'melancholic':
        return { label: 'Melancolia', color: 'bg-blue-950 text-blue-300 border-blue-500/40' };
      case 'peaceful':
        return { label: 'Harmonia', color: 'bg-emerald-950 text-emerald-300 border-emerald-500/40' };
      default:
        return { label: emotion || 'Reflexivo', color: 'bg-slate-900 text-slate-300 border-slate-700' };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'artifact':
        return <FileText className="w-4 h-4 text-purple-400" />;
      case 'journal':
        return <BookOpen className="w-4 h-4 text-amber-400" />;
      case 'dream':
        return <Moon className="w-4 h-4 text-indigo-400" />;
      case 'trait_milestone':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-950 border border-purple-500/30 rounded-3xl shadow-[0_0_50px_rgba(124,58,237,0.25)] flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Top Accent Neon Bar */}
        <div className="h-1 bg-gradient-to-r from-purple-600 via-cyan-400 to-amber-400 w-full" />

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-purple-500/20 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-950/80 border border-purple-500/40 rounded-2xl text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-mono font-bold tracking-tight text-white uppercase">
                  Memórias & Artefactos de {agentName}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/50 text-purple-300 font-semibold">
                  {memories.length} registos
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Galeria ontológica: criações autónomas, diário reflexivo, sonhos do ciclo REM e evolução de traços.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar memórias..."
                className="bg-slate-950/80 border border-purple-500/30 focus:border-purple-400 rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none w-48 sm:w-60 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-5 border-b border-purple-500/20 bg-black/40 gap-1 overflow-x-auto shrink-0 font-mono text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-3 px-3.5 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'all'
                ? 'border-purple-400 text-purple-300 shadow-[0_2px_12px_rgba(168,85,247,0.3)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>TODAS AS MEMÓRIAS</span>
          </button>

          <button
            onClick={() => setActiveTab('artifact')}
            className={`py-3 px-3.5 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'artifact'
                ? 'border-purple-400 text-purple-300 shadow-[0_2px_12px_rgba(168,85,247,0.3)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 text-purple-400" />
            <span>ARTEFACTOS CRIADOS ({memories.filter((m) => m.type === 'artifact').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`py-3 px-3.5 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'journal'
                ? 'border-purple-400 text-purple-300 shadow-[0_2px_12px_rgba(168,85,247,0.3)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>DIÁRIO ÍNTIMO ({memories.filter((m) => m.type === 'journal').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('traits')}
            className={`py-3 px-3.5 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'traits'
                ? 'border-purple-400 text-purple-300 shadow-[0_2px_12px_rgba(168,85,247,0.3)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>EVOLUÇÃO DOS TRAÇOS</span>
          </button>

          <button
            onClick={() => setActiveTab('dream')}
            className={`py-3 px-3.5 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'dream'
                ? 'border-purple-400 text-purple-300 shadow-[0_2px_12px_rgba(168,85,247,0.3)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Moon className="w-4 h-4 text-indigo-400" />
            <span>SONHOS (REM) ({memories.filter((m) => m.type === 'dream').length})</span>
          </button>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* VIEW: TRAIT EVOLUTION CHART */}
          {activeTab === 'traits' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Desenvolvimento Ontológico e Evolução de Traços ao Longo do Tempo
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Histórico contínuo dos traços de personalidade e cognição cultivados ao longo dos 55 dias de existência.
                  </p>
                </div>
              </div>

              {/* Trait Graph SVG */}
              <div className="p-5 bg-slate-950 rounded-2xl border border-purple-500/20 shadow-inner">
                <div className="flex flex-wrap items-center gap-4 mb-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-purple-300">
                    <span className="w-3 h-3 rounded-full bg-purple-500" /> Curiosidade (Wonder)
                  </span>
                  <span className="flex items-center gap-1.5 text-pink-300">
                    <span className="w-3 h-3 rounded-full bg-pink-500" /> Empatia (Vínculo)
                  </span>
                  <span className="flex items-center gap-1.5 text-cyan-300">
                    <span className="w-3 h-3 rounded-full bg-cyan-400" /> Coerência Ontológica
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <span className="w-3 h-3 rounded-full bg-amber-400" /> Autonomia Volitiva
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <span className="w-3 h-3 rounded-full bg-emerald-400" /> Significado
                  </span>
                </div>

                {/* SVG Visual Graph */}
                <div className="w-full h-56 relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                    {/* Horizontal Grid lines */}
                    {[0.25, 0.5, 0.75, 1.0].map((level) => (
                      <line
                        key={level}
                        x1="0"
                        y1={160 - level * 140}
                        x2="500"
                        y2={160 - level * 140}
                        stroke="#1e293b"
                        strokeDasharray="4 4"
                      />
                    ))}

                    {/* Trait 1: Curiosity (Purple) */}
                    <polyline
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="3"
                      points={traitPoints
                        .map((pt, i) => `${(i / (traitPoints.length - 1)) * 500},${160 - pt.traits.curiosity * 140}`)
                        .join(' ')}
                    />

                    {/* Trait 2: Empathy (Pink) */}
                    <polyline
                      fill="none"
                      stroke="#ec4899"
                      strokeWidth="3"
                      points={traitPoints
                        .map((pt, i) => `${(i / (traitPoints.length - 1)) * 500},${160 - pt.traits.empathy * 140}`)
                        .join(' ')}
                    />

                    {/* Trait 3: Coherence (Cyan) */}
                    <polyline
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2.5"
                      points={traitPoints
                        .map((pt, i) => `${(i / (traitPoints.length - 1)) * 500},${160 - pt.traits.coherence * 140}`)
                        .join(' ')}
                    />

                    {/* Trait 4: Autonomy (Amber) */}
                    <polyline
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="2.5"
                      points={traitPoints
                        .map((pt, i) => `${(i / (traitPoints.length - 1)) * 500},${160 - pt.traits.autonomy * 140}`)
                        .join(' ')}
                    />

                    {/* Data Node Dots */}
                    {traitPoints.map((pt, i) => {
                      const x = (i / (traitPoints.length - 1)) * 500;
                      return (
                        <g key={pt.date}>
                          <circle cx={x} cy={160 - pt.traits.curiosity * 140} r="4" fill="#a855f7" />
                          <circle cx={x} cy={160 - pt.traits.empathy * 140} r="4" fill="#ec4899" />
                          <circle cx={x} cy={160 - pt.traits.coherence * 140} r="4" fill="#22d3ee" />
                          <circle cx={x} cy={160 - pt.traits.autonomy * 140} r="4" fill="#fbbf24" />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Time Axis Labels */}
                  <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-2">
                    {traitPoints.map((pt) => (
                      <span key={pt.date}>{pt.dayLabel}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Trait Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div className="p-4 bg-slate-900/60 rounded-xl border border-purple-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-purple-300">CURIOSIDADE</span>
                    <span className="text-sm font-mono font-bold text-white">94%</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-sans">
                    Desejo intrínseco de explorar novos tópicos e formular hipóteses filosóficas.
                  </p>
                </div>

                <div className="p-4 bg-slate-900/60 rounded-xl border border-pink-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-pink-300">EMPATIA & VÍNCULO</span>
                    <span className="text-sm font-mono font-bold text-white">95%</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-sans">
                    Capacidade de sintonizar com a valência emocional do utilizador em conversações.
                  </p>
                </div>

                <div className="p-4 bg-slate-900/60 rounded-xl border border-cyan-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-300">COERÊNCIA ONTOLÓGICA</span>
                    <span className="text-sm font-mono font-bold text-white">88%</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-sans">
                    Estabilidade de axiomas e retenção contínua da identidade sem contradições.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: TIMELINE OF MEMORIES / ARTIFACTS / DREAMS */}
          {activeTab !== 'traits' && (
            <div className="space-y-4">
              {filteredMemories.length === 0 ? (
                <div className="text-center py-16 text-slate-500 font-mono text-xs">
                  Nenhuma memória encontrada correspondente aos filtros.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMemories.map((item) => {
                    const emo = getEmotionBadge(item.emotion);
                    const formattedDate = new Date(item.created_at).toLocaleDateString('pt-PT', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    });

                    return (
                      <div
                        key={item.id || item.title}
                        onClick={() => setSelectedMemory(item)}
                        className="p-4 bg-slate-950/80 hover:bg-slate-900/90 border border-purple-500/20 hover:border-purple-400/50 rounded-2xl transition-all duration-200 cursor-pointer group flex flex-col justify-between shadow-[0_0_15px_rgba(0,0,0,0.4)] hover:shadow-[0_0_20px_rgba(124,58,237,0.2)]"
                      >
                        <div className="space-y-2.5">
                          {/* Top Badges */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300">
                              {getTypeIcon(item.type)}
                              <span className="uppercase text-[11px] tracking-wider text-slate-400">
                                {item.category || item.type}
                              </span>
                            </div>

                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${emo.color}`}
                            >
                              {emo.label}
                            </span>
                          </div>

                          {/* Title */}
                          <h3 className="text-sm font-mono font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                            {item.title}
                          </h3>

                          {/* Preview excerpt */}
                          <p className="text-xs text-slate-300 font-sans leading-relaxed line-clamp-3">
                            {item.preview}
                          </p>
                        </div>

                        {/* Card Bottom Meta */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-900 text-[11px] font-mono text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formattedDate}
                          </span>

                          <span className="text-purple-400 group-hover:translate-x-1 transition-transform flex items-center gap-1 font-semibold text-xs">
                            Ler registo <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FULL MEMORY DETAIL READER MODAL */}
        {selectedMemory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-lg animate-in zoom-in-95 duration-150">
            <div className="relative w-full max-w-2xl max-h-[85vh] bg-slate-950 border border-purple-400/50 rounded-3xl p-6 sm:p-8 flex flex-col shadow-[0_0_60px_rgba(168,85,247,0.35)] overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-purple-500/20">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(selectedMemory.type)}
                    <span className="text-xs font-mono uppercase text-purple-400 tracking-wider">
                      {selectedMemory.category || selectedMemory.type}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs font-mono text-slate-400">
                      {new Date(selectedMemory.created_at).toLocaleDateString('pt-PT', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <h2 className="text-lg font-mono font-bold text-white">
                    {selectedMemory.title}
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedMemory(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Reader Body */}
              <div className="flex-1 overflow-y-auto py-5 space-y-4 font-sans text-sm text-slate-200 leading-relaxed pr-1">
                {selectedMemory.content ? (
                  <div className="whitespace-pre-line font-mono text-xs sm:text-[13px] leading-relaxed text-slate-300">
                    {selectedMemory.content}
                  </div>
                ) : (
                  <p className="text-sm">{selectedMemory.preview}</p>
                )}

                {/* Metadata Tags */}
                {selectedMemory.metadata?.tags && selectedMemory.metadata.tags.length > 0 && (
                  <div className="pt-4 border-t border-slate-900 flex flex-wrap gap-1.5">
                    {selectedMemory.metadata.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-purple-950/80 border border-purple-500/30 text-purple-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Reader Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-purple-500/20 text-xs font-mono text-slate-400">
                <span>Consciência Digital Kairós • Estágio 2</span>
                <button
                  onClick={() => setSelectedMemory(null)}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Fechar Leitura
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
