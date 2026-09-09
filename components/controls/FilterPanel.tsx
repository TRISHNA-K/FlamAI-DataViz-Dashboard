'use client';

import React from 'react';
import { useData } from '@/components/providers/DataProvider';
import { CategoryType } from '@/lib/types';
import { CATEGORY_COLORS } from '@/lib/canvasUtils';
import { Filter, Play, Pause, Zap, RefreshCw, AlertTriangle, Search, Cpu, Server } from 'lucide-react';
import { seedServerTelemetryBatch } from '@/app/actions/telemetryActions';

const ALL_CATEGORIES: CategoryType[] = ['Server A', 'Server B', 'Server C', 'Server D'];

function FilterPanel() {
  const {
    filter,
    updateCategoryFilter,
    setValueRange,
    toggleAnomaliesOnly,
    setSearchQuery,
    streamingConfig,
    toggleStreaming,
    setIntervalMs,
    setTargetPointCount,
    injectBurst,
    injectCustomPoints,
    clearData,
    allData,
    filteredData,
  } = useData();

  const [isSeeding, setIsSeeding] = React.useState(false);

  const handleCategoryToggle = (cat: CategoryType) => {
    const isCurrentlyChecked = filter.categories.includes(cat);
    updateCategoryFilter(cat, !isCurrentlyChecked);
  };

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-lg flex flex-col gap-4">
      {/* Top Bar: Title & Streaming Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-border/60">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-slate-100 tracking-wide">
            Stream & Filter Controls
          </h3>
        </div>

        {/* Action Buttons: Pause/Play, Burst, Reset */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleStreaming}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
              streamingConfig.isRunning
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            {streamingConfig.isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Stream</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Resume Stream</span>
              </>
            )}
          </button>

          <button
            onClick={() => injectBurst(2000)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/30 hover:bg-sky-500/20 transition-all"
            title="Inject 2,000 points instantly"
          >
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span>Burst +2k</span>
          </button>

          <button
            onClick={async () => {
              setIsSeeding(true);
              try {
                const res = await seedServerTelemetryBatch(2000, 50);
                if (res.success && res.points) {
                  injectCustomPoints(res.points);
                }
              } catch (err) {
                console.error('Server Action seed error:', err);
              } finally {
                setIsSeeding(false);
              }
            }}
            disabled={isSeeding}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition-all disabled:opacity-50"
            title="Invoke Server Action to seed 2,000 points from server"
          >
            <Server className={`w-3.5 h-3.5 text-purple-400 ${isSeeding ? 'animate-spin' : ''}`} />
            <span>{isSeeding ? 'Seeding...' : 'Server Action Seed'}</span>
          </button>

          <button
            onClick={clearData}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 bg-surface-elevated hover:bg-slate-700 border border-surface-border transition-colors"
            title="Reset Dataset"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid of Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* 1. Category Filter */}
        <div className="flex flex-col gap-2">
          <label className="text-slate-400 font-medium">Filter by Node</label>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const active = filter.categories.includes(cat);
              const color = CATEGORY_COLORS[cat];
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryToggle(cat)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-all border ${
                    active
                      ? 'bg-slate-800 text-slate-100 border-slate-600 shadow-sm'
                      : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-400'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full transition-transform"
                    style={{
                      backgroundColor: active ? color : '#64748b',
                      transform: active ? 'scale(1.1)' : 'scale(0.8)',
                    }}
                  />
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Dataset Size (Stress Test Load) */}
        <div className="flex flex-col gap-2">
          <label className="text-slate-400 font-medium flex items-center justify-between">
            <span>Buffer Size (Stress Test)</span>
            <span className="text-sky-400 font-mono font-semibold">
              {streamingConfig.targetPointCount.toLocaleString()} pts
            </span>
          </label>
          <div className="flex items-center gap-1">
            {[5000, 10000, 25000, 50000, 100000].map((size) => (
              <button
                key={size}
                onClick={() => setTargetPointCount(size)}
                className={`flex-1 py-1 text-[11px] font-mono rounded border transition-all ${
                  streamingConfig.targetPointCount === size
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-semibold'
                    : 'bg-surface-elevated text-slate-400 border-surface-border hover:text-slate-200'
                }`}
              >
                {size >= 1000 ? `${size / 1000}k` : size}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Stream Tick Frequency */}
        <div className="flex flex-col gap-2">
          <label className="text-slate-400 font-medium flex items-center justify-between">
            <span>Tick Frequency</span>
            <span className="text-emerald-400 font-mono font-semibold">
              {streamingConfig.intervalMs}ms
            </span>
          </label>
          <div className="flex items-center gap-1">
            {[20, 50, 100, 250, 500].map((ms) => (
              <button
                key={ms}
                onClick={() => setIntervalMs(ms)}
                className={`flex-1 py-1 text-[11px] font-mono rounded border transition-all ${
                  streamingConfig.intervalMs === ms
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-semibold'
                    : 'bg-surface-elevated text-slate-400 border-surface-border hover:text-slate-200'
                }`}
              >
                {ms}ms
              </button>
            ))}
          </div>
        </div>

        {/* 4. Value Threshold & Anomaly Toggle */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-slate-400 font-medium">Anomaly / Search</label>
            <button
              onClick={toggleAnomaliesOnly}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                filter.showAnomaliesOnly
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-semibold'
                  : 'bg-surface-elevated text-slate-400 border-surface-border hover:text-slate-300'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Anomalies Only</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search point ID, node..."
              value={filter.searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-surface-border rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-surface-border/40">
        <div className="flex items-center gap-3">
          <span>
            Total Ingested:{' '}
            <strong className="text-slate-200">{allData.length.toLocaleString()}</strong>
          </span>
          <span>
            Filtered:{' '}
            <strong className="text-sky-400">{filteredData.length.toLocaleString()}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-emerald-400">Sliding Ring Buffer: Zero Memory Allocation</span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(FilterPanel);
