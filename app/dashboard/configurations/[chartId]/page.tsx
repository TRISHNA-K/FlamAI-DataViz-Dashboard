import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  STATIC_CHART_CONFIGS,
  getAllStaticChartIds,
  getStaticChartConfig,
} from '@/lib/staticChartConfigs';
import {
  ArrowLeft,
  Activity,
  Layers,
  Cpu,
  Gauge,
  CheckCircle2,
  Sliders,
  Palette,
  Sparkles,
} from 'lucide-react';

/**
 * Next.js Static Site Generation (SSG) with generateStaticParams.
 * Statically pre-renders all 4 chart configurations at build time.
 */
export async function generateStaticParams() {
  const ids = getAllStaticChartIds();
  return ids.map((id) => ({
    chartId: id,
  }));
}

export default async function ChartConfigStaticPage({
  params,
}: {
  params: { chartId: string };
}) {
  const config = getStaticChartConfig(params.chartId);

  if (!config) {
    notFound();
  }

  const allChartIds = getAllStaticChartIds();

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 flex flex-col gap-6">
      {/* Top Breadcrumb / Nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-mono text-sky-400 hover:text-sky-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Live Dashboard</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Next.js Static Generation (SSG) • Pre-Rendered
          </span>
        </div>
      </div>

      {/* Main Header Card */}
      <div className="bg-surface border border-surface-border rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              Chart Specification / {config.type}
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight font-mono">
              {config.name}
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-2xl">
              {config.description}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className="text-xs font-mono text-slate-400">Target Refresh</span>
            <span className="px-3 py-1 rounded-lg text-sm font-mono font-bold bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
              {config.targetFPS} FPS Sustained
            </span>
          </div>
        </div>

        {/* Other Config Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-surface-border/60">
          <span className="text-xs font-mono text-slate-400 mr-2">Preset Charts:</span>
          {allChartIds.map((id) => (
            <Link
              key={id}
              href={`/dashboard/configurations/${id}`}
              className={`px-3 py-1 text-xs font-mono rounded-lg transition-all border ${
                id === config.id
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-semibold'
                  : 'bg-surface-elevated text-slate-400 border-surface-border hover:text-slate-200'
              }`}
            >
              {STATIC_CHART_CONFIGS[id].name.split(' ')[0]}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid of Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Performance Budget Card */}
        <div className="bg-surface border border-surface-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm mb-4">
              <Gauge className="w-4 h-4 text-sky-400" />
              <span>Performance Budget & Decimation</span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between pb-2 border-b border-surface-border/40">
                <span className="text-slate-400">Max Point Capacity:</span>
                <span className="text-white font-bold">{config.maxPointCapacity.toLocaleString()} points</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-surface-border/40">
                <span className="text-slate-400">LOD Decimation Threshold:</span>
                <span className="text-sky-400 font-semibold">{config.recommendedLODThreshold.toLocaleString()} points</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-surface-border/40">
                <span className="text-slate-400">Decimation Algorithm:</span>
                <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                  {config.decimationAlgorithm}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-surface-border/40">
                <span className="text-slate-400">Render Engine:</span>
                <span className="text-emerald-400 font-semibold">{config.renderEngine}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Frame Budget (Budget: &lt;16.7ms):</span>
                <span className="text-white">{config.performanceBudget.maxFrameTimeMs} ms</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-surface-border/40 text-[11px] font-mono text-slate-500">
            Sub-millisecond hit test: <strong className="text-slate-300">{config.performanceBudget.subMillisecondHitTest ? 'Enabled (O(1))' : 'Standard'}</strong>
          </div>
        </div>

        {/* Color Palette & Styling Card */}
        <div className="bg-surface border border-surface-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm mb-4">
              <Palette className="w-4 h-4 text-purple-400" />
              <span>Static Color Palette Specification</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-surface-border flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-md shadow-sm border border-white/20"
                  style={{ backgroundColor: config.colorPalette.primary }}
                />
                <div>
                  <div className="text-[10px] text-slate-400">Primary Series</div>
                  <div className="text-slate-200 font-semibold">{config.colorPalette.primary}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-surface-border flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-md shadow-sm border border-white/20"
                  style={{ backgroundColor: config.colorPalette.secondary }}
                />
                <div>
                  <div className="text-[10px] text-slate-400">Secondary Metric</div>
                  <div className="text-slate-200 font-semibold">{config.colorPalette.secondary}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-surface-border flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-md shadow-sm border border-white/20"
                  style={{ backgroundColor: config.colorPalette.accent }}
                />
                <div>
                  <div className="text-[10px] text-slate-400">Anomaly Pulse</div>
                  <div className="text-slate-200 font-semibold">{config.colorPalette.accent}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-surface-border flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-md shadow-sm border border-white/20"
                  style={{ backgroundColor: config.colorPalette.background }}
                />
                <div>
                  <div className="text-[10px] text-slate-400">Surface Canvas</div>
                  <div className="text-slate-200 font-semibold">{config.colorPalette.background}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-surface-border/40 text-[11px] font-mono text-slate-500">
            Grid line style: <span className="text-slate-300">{config.colorPalette.gridLine}</span>
          </div>
        </div>
      </div>

      {/* Feature Checkpoints */}
      <div className="bg-surface border border-surface-border rounded-xl p-5 shadow-lg">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Architectural Features Included in Build</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-slate-300">
          {config.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-slate-950/40 rounded-lg border border-surface-border/50">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
