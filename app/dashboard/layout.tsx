import React from 'react';
import Link from 'next/link';
import { Activity, ShieldCheck, Terminal, Gauge, Layers } from 'lucide-react';
import { generateInitialDataset } from '@/lib/dataGenerator';
import { DataProvider } from '@/components/providers/DataProvider';
import WorkerStatusBadge from '@/components/ui/WorkerStatusBadge';
import ServiceWorkerBadge from '@/components/ui/ServiceWorkerBadge';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialData = generateInitialDataset(10000, 100);

  return (
    <DataProvider initialData={initialData}>
      <div className="min-h-screen flex flex-col bg-background text-slate-100">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-md border-b border-surface-border px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-primary">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white font-mono">
                  TELEMETRY<span className="text-primary font-light">.PULSE</span>
                </h1>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  10k+ @ 60 FPS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Next.js 14 App Router • Canvas + SVG Hybrid • Web Worker Downsampling
              </p>
            </div>
          </div>

          {/* Status Indicators & Navigation */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <Link
              href="/dashboard/configurations/line-chart"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>SSG Configs</span>
            </Link>

            <Link
              href="/dashboard/benchmark"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 transition-colors"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Benchmark Suite</span>
            </Link>

            {/* PWA Service Worker Cache Status Badge */}
            <ServiceWorkerBadge />

            {/* Live Reactive Web Worker Status Badge */}
            <WorkerStatusBadge />

            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold">ENGINE RUNNING</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1700px] w-full mx-auto">
          {children}
        </main>
      </div>
    </DataProvider>
  );
}
