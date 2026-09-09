import React from 'react';
import { ShieldCheck, Activity, Zap, Server } from 'lucide-react';
import { generateInitialDataset } from '@/lib/dataGenerator';

interface ServerInsightMetric {
  title: string;
  value: string;
  subtext: string;
  status: 'healthy' | 'warning' | 'optimal';
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Async React Server Component (RSC)
 * Executed purely on the server in Next.js 14 App Router.
 * Demonstrates streaming HTML chunks over HTTP via React Suspense.
 */
export async function DashboardServerInsights() {
  const startTime = Date.now();

  // Real computation over server-side baseline dataset (10,000 points)
  const samplePoints = generateInitialDataset(10000, 100);
  const totalValue = samplePoints.reduce((acc, p) => acc + p.value, 0);
  const avgValue = (totalValue / samplePoints.length).toFixed(1);
  const anomalyCount = samplePoints.filter((p) => p.isAnomaly).length;
  const anomalyRate = ((anomalyCount / samplePoints.length) * 100).toFixed(2);

  // Artificial non-blocking async delay (60ms) to clearly showcase Suspense chunk streaming
  await new Promise((resolve) => setTimeout(resolve, 60));
  const serverLatency = Date.now() - startTime;

  const insights: ServerInsightMetric[] = [
    {
      title: 'Server Influx Baseline',
      value: `${(samplePoints.length / 1000).toFixed(0)}k points`,
      subtext: `Computed in ${serverLatency}ms on server`,
      status: 'optimal',
      icon: Server,
    },
    {
      title: 'Cluster Health Index',
      value: '99.98%',
      subtext: '4 active edge zones (0 failovers)',
      status: 'healthy',
      icon: ShieldCheck,
    },
    {
      title: 'Baseline Voltage Mean',
      value: `${avgValue} mV`,
      subtext: 'Brownian variance ±2.4%',
      status: 'optimal',
      icon: Zap,
    },
    {
      title: 'Server Anomaly Filter',
      value: `${anomalyRate}%`,
      subtext: `${anomalyCount} baseline spikes flagged`,
      status: Number(anomalyRate) > 4 ? 'warning' : 'healthy',
      icon: Activity,
    },
  ];

  return (
    <div className="bg-surface/80 border border-surface-border rounded-xl p-4 mb-4 backdrop-blur-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-surface-border pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Server Fleet Insights
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Async Server Component • Suspense Streamed
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-500">
          SSR latency: <span className="text-slate-300 font-semibold">{serverLatency}ms</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {insights.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="bg-slate-950/40 border border-surface-border/60 rounded-lg p-3 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium truncate">{item.title}</span>
                <Icon className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-lg font-bold text-white tracking-tight font-mono">
                {item.value}
              </div>
              <div className="text-[10px] text-slate-500 truncate mt-1">
                {item.subtext}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Suspense fallback skeleton for DashboardServerInsights
 */
export function DashboardServerInsightsSkeleton() {
  return (
    <div className="bg-surface/80 border border-surface-border rounded-xl p-4 mb-4 animate-pulse">
      <div className="flex items-center justify-between mb-3 border-b border-surface-border pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-700" />
          <div className="w-32 h-3.5 bg-slate-800 rounded" />
          <div className="w-48 h-3.5 bg-slate-800/60 rounded hidden sm:block" />
        </div>
        <div className="w-24 h-3 bg-slate-800 rounded" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-slate-950/40 border border-surface-border/60 rounded-lg p-3 h-20 flex flex-col justify-between"
          >
            <div className="w-24 h-3 bg-slate-800 rounded" />
            <div className="w-16 h-5 bg-slate-800 rounded" />
            <div className="w-28 h-2.5 bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default DashboardServerInsights;
