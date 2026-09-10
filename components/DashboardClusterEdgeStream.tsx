import React from 'react';
import { Globe, Radio, Server, CheckCircle2 } from 'lucide-react';

interface EdgeNodeStatus {
  region: string;
  name: string;
  latencyMs: number;
  status: 'optimal' | 'stable';
  runtime: 'edge-v8';
}

/**
 * Async Server Component: Streams live global edge cluster topology and
 * regional health metrics chunked via React Suspense.
 */
export async function DashboardClusterEdgeStream() {
  // Non-blocking async delay (80ms) to clearly show independent Suspense chunk streaming
  await new Promise((resolve) => setTimeout(resolve, 80));

  const edgeNodes: EdgeNodeStatus[] = [
    { region: 'iad1', name: 'US East (N. Virginia)', latencyMs: 12, status: 'optimal', runtime: 'edge-v8' },
    { region: 'sfo1', name: 'US West (Oregon)', latencyMs: 38, status: 'optimal', runtime: 'edge-v8' },
    { region: 'fra1', name: 'EU Central (Frankfurt)', latencyMs: 74, status: 'stable', runtime: 'edge-v8' },
    { region: 'sin1', name: 'AP Southeast (Singapore)', latencyMs: 118, status: 'stable', runtime: 'edge-v8' },
  ];

  return (
    <div className="bg-surface/80 border border-surface-border rounded-xl p-3 mb-4 backdrop-blur-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-surface-border/60">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold font-mono text-slate-200 uppercase tracking-wider">
            Global Edge Route Telemetry
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Edge Runtime &bull; Suspense Streamed
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
          <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span>4 Edge PoPs Active</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {edgeNodes.map((node) => (
          <div
            key={node.region}
            className="p-2 bg-slate-950/40 rounded border border-surface-border/50 flex items-center justify-between text-xs font-mono"
          >
            <div>
              <div className="text-slate-300 font-medium truncate">{node.name.split(' ')[0]}</div>
              <div className="text-[10px] text-slate-500">{node.region}</div>
            </div>
            <div className="text-right">
              <span className="text-emerald-400 font-bold">{node.latencyMs}ms</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardClusterEdgeSkeleton() {
  return (
    <div className="bg-surface/80 border border-surface-border rounded-xl p-3 mb-4 animate-pulse">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-surface-border/60">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-slate-800" />
          <div className="w-40 h-3.5 bg-slate-800 rounded" />
        </div>
        <div className="w-24 h-3 bg-slate-800 rounded" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-2 bg-slate-950/40 rounded border border-surface-border/50 h-10 flex items-center justify-between">
            <div className="w-16 h-3 bg-slate-800 rounded" />
            <div className="w-8 h-3 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default DashboardClusterEdgeStream;
