'use client';

import React from 'react';
import { Cpu } from 'lucide-react';
import { useData } from '@/components/providers/DataProvider';

export default function WorkerStatusBadge() {
  const { isWorkerActive } = useData();

  return (
    <div
      className={`hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs font-mono transition-colors ${
        isWorkerActive
          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
          : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
      }`}
      title={
        isWorkerActive
          ? 'Dedicated Web Worker running off-thread data generation and decimation'
          : 'Web Worker inactive; falling back to main-thread execution'
      }
    >
      <Cpu className={`w-3.5 h-3.5 ${isWorkerActive ? 'text-emerald-400' : 'text-amber-400'}`} />
      <span>{isWorkerActive ? 'Worker: Active' : 'Worker: Fallback'}</span>
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isWorkerActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
        }`}
      />
    </div>
  );
}
