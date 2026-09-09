'use client';

import React, { useEffect } from 'react';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log exception to telemetry monitoring or error tracker
    console.error('Dashboard runtime exception caught by App Router boundary:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center font-mono">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-950/30">
        <AlertOctagon className="w-8 h-8" />
      </div>

      <h2 className="text-lg font-bold text-slate-100 mb-1">
        TELEMETRY ENGINE EXCEPTION
      </h2>
      <p className="text-xs text-slate-400 max-w-md mb-6">
        An error was captured by the Next.js App Router Error Boundary. High-frequency streaming was suspended to preserve state integrity.
      </p>

      {error.message && (
        <div className="p-3 bg-slate-900 border border-rose-500/30 rounded-lg text-rose-300 text-xs max-w-lg mb-6 text-left break-all">
          <span className="text-slate-500 font-bold block mb-1">Stack Summary:</span>
          {error.message}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-md"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restart Engine (Reset Boundary)</span>
        </button>

        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-slate-800 text-slate-300 border border-surface-border text-xs rounded-lg transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Reload Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
