'use client';

import React, { useState } from 'react';
import { useData } from '@/components/providers/DataProvider';
import {
  Activity,
  Cpu,
  Database,
  Gauge,
  Zap,
  Minimize2,
  Maximize2,
  CheckCircle2,
  AlertOctagon,
} from 'lucide-react';

function PerformanceMonitor() {
  const { metrics, streamingConfig, setTargetPointCount, setIntervalMs, injectBurst } = useData();
  const [isMinimized, setIsMinimized] = useState(false);

  const getFpsColor = (fps: number) => {
    if (fps >= 55) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40';
    if (fps >= 35) return 'text-amber-400 bg-amber-500/15 border-amber-500/40';
    return 'text-rose-400 bg-rose-500/15 border-rose-500/40';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 transition-all font-mono">
      <div className="bg-slate-950/95 border border-sky-500/40 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden min-w-[320px] max-w-[420px]">
        {/* Top Title Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-elevated border-b border-surface-border select-none">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-slate-100 tracking-wider">
              PERFORMANCE TELEMETRY HUD
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getFpsColor(metrics.fps)}`}>
              {metrics.fps} FPS
            </div>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-slate-400 hover:text-white p-1 rounded transition-colors"
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Detailed Metrics Panel */}
        {!isMinimized && (
          <div className="p-4 flex flex-col gap-3 text-xs">
            {/* Grid of Key Stats */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* FPS & Target */}
              <div className="p-2.5 rounded-xl bg-surface border border-surface-border flex flex-col">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>FRAME RATE</span>
                  <span className="text-emerald-400 font-bold">Target 60</span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-white">{metrics.fps}</span>
                  <span className="text-[10px] text-slate-400">fps</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                  <span>Avg: {metrics.avgFps}</span>
                  <span>Min: {metrics.minFps}</span>
                  <span>Max: {metrics.maxFps}</span>
                </div>
              </div>

              {/* Frame Timing */}
              <div className="p-2.5 rounded-xl bg-surface border border-surface-border flex flex-col">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>FRAME TIME</span>
                  <span className="text-sky-400 font-bold">&lt; 16.7ms</span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-white">{metrics.frameTime}</span>
                  <span className="text-[10px] text-slate-400">ms</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                  <span>Render: {metrics.renderTime}ms</span>
                  <span>Drop: {metrics.droppedFrames}</span>
                </div>
              </div>

              {/* Heap Memory */}
              <div className="p-2.5 rounded-xl bg-surface border border-surface-border flex flex-col">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>JS HEAP USAGE</span>
                  <Database className="w-3 h-3 text-purple-400" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-purple-300">
                    {metrics.memoryUsage}
                  </span>
                  <span className="text-[10px] text-slate-400">MB</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Memory leak-free buffer</span>
                </div>
              </div>

              {/* Dataset Load */}
              <div className="p-2.5 rounded-xl bg-surface border border-surface-border flex flex-col">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>ACTIVE DATASET</span>
                  <Activity className="w-3 h-3 text-sky-400" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-bold text-sky-300">
                    {metrics.totalPoints.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">pts</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Rendered: <strong className="text-white">{metrics.renderedPoints}</strong> (LOD)
                </div>
              </div>
            </div>

            {/* Quick Stress Test Launchers */}
            <div className="pt-2 border-t border-surface-border flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-semibold text-slate-300">BENCHMARK STRESS MODES</span>
                <span>Click to stress test:</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => {
                    setTargetPointCount(10000);
                    setIntervalMs(100);
                  }}
                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                    streamingConfig.targetPointCount === 10000 && streamingConfig.intervalMs === 100
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500'
                      : 'bg-surface hover:bg-slate-800 text-slate-300 border-surface-border'
                  }`}
                >
                  Standard (10k)
                </button>

                <button
                  onClick={() => {
                    setTargetPointCount(50000);
                    setIntervalMs(50);
                  }}
                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                    streamingConfig.targetPointCount === 50000
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                      : 'bg-surface hover:bg-slate-800 text-slate-300 border-surface-border'
                  }`}
                >
                  Heavy (50k)
                </button>

                <button
                  onClick={() => {
                    setTargetPointCount(100000);
                    setIntervalMs(20);
                  }}
                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                    streamingConfig.targetPointCount === 100000
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500'
                      : 'bg-surface hover:bg-slate-800 text-slate-300 border-surface-border'
                  }`}
                >
                  Extreme (100k)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(PerformanceMonitor);
