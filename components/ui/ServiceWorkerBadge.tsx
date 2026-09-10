'use client';

import React from 'react';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { HardDrive, Wifi, WifiOff } from 'lucide-react';

export default function ServiceWorkerBadge() {
  const { isSupported, isRegistered, isOffline } = useServiceWorker();

  if (!isSupported) return null;

  return (
    <div
      className={`hidden lg:flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono border transition-all ${
        isOffline
          ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
          : isRegistered
          ? 'bg-cyan-950/50 border-cyan-500/30 text-cyan-300'
          : 'bg-slate-900/60 border-surface-border text-slate-400'
      }`}
      title={
        isOffline
          ? 'Offline Mode Active — Running from Service Worker Cache'
          : isRegistered
          ? 'PWA Service Worker Active — Cache-First & Stale-While-Revalidate Enabled'
          : 'Service Worker Initializing...'
      }
    >
      {isOffline ? (
        <>
          <WifiOff className="w-3 h-3 text-amber-400" />
          <span>SW: Offline Cache</span>
        </>
      ) : (
        <>
          <HardDrive className="w-3 h-3 text-cyan-400" />
          <span>SW: PWA Cache</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRegistered ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'
            }`}
          />
        </>
      )}
    </div>
  );
}
