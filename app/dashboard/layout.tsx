import React from 'react';
import Link from 'next/link';
import { Activity, ShieldCheck, Cpu, Terminal, Gauge } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
            href="/dashboard/benchmark"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 transition-colors"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Benchmark Suite</span>
          </Link>

          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface-elevated border border-surface-border text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span>Worker: Active</span>
          </div>

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
  );
}
