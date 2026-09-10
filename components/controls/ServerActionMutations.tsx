'use client';

import React, { useState, useTransition } from 'react';
import {
  mutateAlertThresholdAction,
  triageAnomalyIncidentAction,
  saveChartPresetAction,
  seedServerTelemetryBatch,
} from '@/app/actions/telemetryActions';
import { useData } from '@/components/providers/DataProvider';
import {
  Server,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  Zap,
  RefreshCw,
} from 'lucide-react';

export default function ServerActionMutations() {
  const { injectCustomPoints } = useData();
  const [isPending, startTransition] = useTransition();
  const [activeMutation, setActiveMutation] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form states for mutations
  const [anomalyThreshold, setAnomalyThreshold] = useState(0.8);
  const [latencyWarning, setLatencyWarning] = useState(150);
  const [presetName, setPresetName] = useState('High-Density Production');

  const handleMutateThresholds = () => {
    setActiveMutation('threshold');
    startTransition(async () => {
      try {
        const res = await mutateAlertThresholdAction({
          anomalyScoreThreshold: anomalyThreshold,
          latencyWarningMs: latencyWarning,
          cpuWarningPercent: 90,
          alertNotificationsEnabled: true,
        });
        setStatusMessage(`✅ Mutated: Anomaly Cutoff ${res.data.anomalyScoreThreshold}, Latency ${res.data.latencyWarningMs}ms`);
      } catch (err: any) {
        setStatusMessage(`❌ Error: ${err.message || 'Mutation failed'}`);
      } finally {
        setActiveMutation(null);
      }
    });
  };

  const handleTriageIncident = (status: 'acknowledged' | 'resolved' | 'false_positive') => {
    setActiveMutation(`triage-${status}`);
    startTransition(async () => {
      try {
        const res = await triageAnomalyIncidentAction({
          incidentId: 'inc-node-a-01',
          status,
          notes: `Triaged via Next.js Server Action at ${new Date().toLocaleTimeString()}`,
        });
        setStatusMessage(`✅ Mutated Incident: Status "${res.incident.status}"`);
      } catch (err: any) {
        setStatusMessage(`❌ Error: ${err.message || 'Triage failed'}`);
      } finally {
        setActiveMutation(null);
      }
    });
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    setActiveMutation('preset');
    startTransition(async () => {
      try {
        const res = await saveChartPresetAction({
          name: presetName,
          decimationThreshold: 1500,
          colorTheme: 'neon-sky',
          showAnomaliesOnly: false,
        });
        setStatusMessage(`✅ Saved Preset "${res.preset.name}" [ID: ${res.preset.id}]`);
      } catch (err: any) {
        setStatusMessage(`❌ Error: ${err.message || 'Preset save failed'}`);
      } finally {
        setActiveMutation(null);
      }
    });
  };

  const handleSeedBatch = () => {
    setActiveMutation('seed');
    startTransition(async () => {
      try {
        const res = await seedServerTelemetryBatch(2000, 50);
        if (res.success && res.points) {
          injectCustomPoints(res.points);
          setStatusMessage(`✅ Seeded ${res.points.length.toLocaleString()} points in ${res.timeMs}ms via Server Action`);
        }
      } catch (err: any) {
        setStatusMessage(`❌ Error: ${err.message || 'Batch seed failed'}`);
      } finally {
        setActiveMutation(null);
      }
    });
  };

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-lg flex flex-col gap-3">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-surface-border/60">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-purple-400" />
          <h4 className="text-xs font-semibold text-slate-100 uppercase tracking-wider font-mono">
            Next.js Server Actions • Real Data Mutations
          </h4>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
            &apos;use server&apos; Mutations
          </span>
        </div>

        {statusMessage && (
          <div className="text-[11px] font-mono text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded animate-fade-in">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Grid of 3 Mutation Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
        {/* 1. Threshold Mutation */}
        <div className="p-3 bg-slate-950/40 border border-surface-border/60 rounded-lg flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-1">
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Mutate Alert Thresholds</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Validates and persists anomaly cutoff and latency ceiling on server.
            </p>
          </div>

          <div className="space-y-2 my-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Anomaly Cutoff:</span>
              <span className="text-sky-400 font-bold">{anomalyThreshold}</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="0.95"
              step="0.05"
              value={anomalyThreshold}
              onChange={(e) => setAnomalyThreshold(parseFloat(e.target.value))}
              className="w-full accent-sky-400 h-1 bg-slate-800 rounded"
            />
          </div>

          <button
            onClick={handleMutateThresholds}
            disabled={isPending && activeMutation === 'threshold'}
            className="w-full py-1.5 px-2.5 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Zap className="w-3 h-3" />
            <span>
              {isPending && activeMutation === 'threshold'
                ? 'Mutating Server...'
                : 'Mutate Thresholds'}
            </span>
          </button>
        </div>

        {/* 2. Anomaly Incident Triage Mutation */}
        <div className="p-3 bg-slate-950/40 border border-surface-border/60 rounded-lg flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Triage Anomaly Incidents</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Mutates incident status in server audit log via server action.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 my-1 text-[11px]">
            <div className="flex items-center justify-between text-slate-400">
              <span>Incident:</span>
              <span className="text-rose-400 font-bold">inc-node-a-01 (0.89)</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleTriageIncident('acknowledged')}
              disabled={isPending}
              className="flex-1 py-1.5 text-[10px] rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 transition-all"
            >
              Acknowledge
            </button>
            <button
              onClick={() => handleTriageIncident('resolved')}
              disabled={isPending}
              className="flex-1 py-1.5 text-[10px] rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 transition-all"
            >
              Resolve
            </button>
            <button
              onClick={() => handleTriageIncident('false_positive')}
              disabled={isPending}
              className="flex-1 py-1.5 text-[10px] rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-all"
            >
              False +
            </button>
          </div>
        </div>

        {/* 3. Save Chart Preset Mutation & Seed */}
        <div className="p-3 bg-slate-950/40 border border-surface-border/60 rounded-lg flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-1">
              <Bookmark className="w-3.5 h-3.5 text-purple-400" />
              <span>Persist Chart Preset</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Mutates server user preferences with custom visualization configuration.
            </p>
          </div>

          <div className="my-1">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="w-full bg-slate-900 border border-surface-border rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-400"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSavePreset}
              disabled={isPending && activeMutation === 'preset'}
              className="flex-1 py-1.5 px-2 rounded bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 font-semibold transition-all disabled:opacity-50"
            >
              Save Preset
            </button>
            <button
              onClick={handleSeedBatch}
              disabled={isPending && activeMutation === 'seed'}
              className="py-1.5 px-2.5 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 transition-all"
              title="Seed 2,000 points from server"
            >
              <Zap className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
