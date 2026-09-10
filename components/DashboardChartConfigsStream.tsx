import React from 'react';
import Link from 'next/link';
import { Layers, Sliders, ExternalLink, Activity } from 'lucide-react';
import { STATIC_CHART_CONFIGS, getAllStaticChartIds } from '@/lib/staticChartConfigs';

/**
 * Async Server Component: Streams pre-computed static chart configurations
 * and hardware acceleration parameters over HTTP chunking via React Suspense.
 */
export async function DashboardChartConfigsStream() {
  // Artificial non-blocking async delay (35ms) to showcase granular Suspense streaming
  await new Promise((resolve) => setTimeout(resolve, 35));

  const chartIds = getAllStaticChartIds();

  return (
    <div className="bg-surface/80 border border-surface-border rounded-xl p-3 mb-4 backdrop-blur-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-semibold font-mono text-slate-200">
            Static Chart Configurations (SSG Pre-Rendered):
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
            generateStaticParams
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chartIds.map((id) => {
            const config = STATIC_CHART_CONFIGS[id];
            return (
              <Link
                key={id}
                href={`/dashboard/configurations/${id}`}
                className="group flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900/80 hover:bg-slate-800 border border-surface-border text-xs font-mono text-slate-300 hover:text-white transition-all shadow-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.colorPalette.primary }} />
                <span>{config.name.split(' ')[0]} Config</span>
                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-sky-400 transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DashboardChartConfigsSkeleton() {
  return (
    <div className="bg-surface/80 border border-surface-border rounded-xl p-3 mb-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-slate-800" />
          <div className="w-48 h-3.5 bg-slate-800 rounded" />
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-24 h-6 bg-slate-800 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default DashboardChartConfigsStream;
