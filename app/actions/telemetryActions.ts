'use server';

import { revalidatePath } from 'next/cache';
import { generateInitialDataset, generateStreamBatch } from '@/lib/dataGenerator';
import { DataPoint } from '@/lib/types';

// In-memory server-side mutation stores (simulating database / Redis storage)
interface ServerAlertThresholds {
  anomalyScoreThreshold: number; // 0.1 - 1.0
  latencyWarningMs: number; // ms
  cpuWarningPercent: number; // %
  alertNotificationsEnabled: boolean;
  updatedAt: string;
}

let currentAlertThresholds: ServerAlertThresholds = {
  anomalyScoreThreshold: 0.75,
  latencyWarningMs: 120,
  cpuWarningPercent: 85,
  alertNotificationsEnabled: true,
  updatedAt: new Date().toISOString(),
};

interface AnomalyIncident {
  id: string;
  timestamp: number;
  anomalyScore: number;
  status: 'new' | 'investigating' | 'acknowledged' | 'resolved' | 'false_positive';
  triageNotes?: string;
  triagedAt?: string;
}

const anomalyIncidentStore: Map<string, AnomalyIncident> = new Map([
  [
    'inc-node-a-01',
    {
      id: 'inc-node-a-01',
      timestamp: Date.now() - 300000,
      anomalyScore: 0.89,
      status: 'acknowledged',
      triageNotes: 'Brownian variance surge detected in node A power rail',
      triagedAt: new Date(Date.now() - 240000).toISOString(),
    },
  ],
]);

interface UserChartPreset {
  id: string;
  name: string;
  decimationThreshold: number;
  colorTheme: string;
  showAnomaliesOnly: boolean;
  savedAt: string;
}

const userPresetsStore: Map<string, UserChartPreset> = new Map();

/**
 * Next.js Server Action: Data Mutation - Updates Alert Thresholds
 * Validates payload on server, mutates state, and triggers Next.js path revalidation.
 */
export async function mutateAlertThresholdAction(payload: {
  anomalyScoreThreshold: number;
  latencyWarningMs: number;
  cpuWarningPercent: number;
  alertNotificationsEnabled: boolean;
}): Promise<{ success: boolean; data: ServerAlertThresholds; message: string }> {
  // 1. Server-side validation
  if (
    payload.anomalyScoreThreshold < 0.1 ||
    payload.anomalyScoreThreshold > 1.0
  ) {
    throw new Error('Anomaly score threshold must be between 0.1 and 1.0');
  }
  if (payload.latencyWarningMs < 10 || payload.latencyWarningMs > 5000) {
    throw new Error('Latency warning cutoff must be between 10ms and 5000ms');
  }
  if (payload.cpuWarningPercent < 10 || payload.cpuWarningPercent > 100) {
    throw new Error('CPU warning threshold must be between 10% and 100%');
  }

  // 2. Mutate server state
  currentAlertThresholds = {
    ...payload,
    updatedAt: new Date().toISOString(),
  };

  // 3. App Router cache revalidation
  revalidatePath('/dashboard');

  return {
    success: true,
    data: currentAlertThresholds,
    message: 'Alert thresholds successfully mutated on server',
  };
}

/**
 * Next.js Server Action: Query Server Alert Thresholds
 */
export async function getAlertThresholdsAction(): Promise<ServerAlertThresholds> {
  return currentAlertThresholds;
}

/**
 * Next.js Server Action: Data Mutation - Triage Anomaly Incident
 * Acknowledges, resolves, or marks telemetry anomalies as false positives.
 */
export async function triageAnomalyIncidentAction(payload: {
  incidentId: string;
  status: 'investigating' | 'acknowledged' | 'resolved' | 'false_positive';
  notes?: string;
}): Promise<{ success: boolean; incident: AnomalyIncident; message: string }> {
  if (!payload.incidentId) {
    throw new Error('Incident ID is required for anomaly triage mutation');
  }

  const existing = anomalyIncidentStore.get(payload.incidentId) || {
    id: payload.incidentId,
    timestamp: Date.now(),
    anomalyScore: 0.85,
    status: 'new',
  };

  const updated: AnomalyIncident = {
    ...existing,
    status: payload.status,
    triageNotes: payload.notes || existing.triageNotes,
    triagedAt: new Date().toISOString(),
  };

  anomalyIncidentStore.set(payload.incidentId, updated);
  revalidatePath('/dashboard');

  return {
    success: true,
    incident: updated,
    message: `Incident ${payload.incidentId} mutated to status "${payload.status}"`,
  };
}

/**
 * Next.js Server Action: Data Mutation - Save Custom User Chart Preset
 */
export async function saveChartPresetAction(payload: {
  name: string;
  decimationThreshold: number;
  colorTheme: string;
  showAnomaliesOnly: boolean;
}): Promise<{ success: boolean; preset: UserChartPreset; message: string }> {
  if (!payload.name.trim()) {
    throw new Error('Preset name cannot be empty');
  }

  const id = `preset-${Date.now()}`;
  const preset: UserChartPreset = {
    id,
    name: payload.name.trim(),
    decimationThreshold: Math.max(500, Math.min(20000, payload.decimationThreshold)),
    colorTheme: payload.colorTheme || 'neon-sky',
    showAnomaliesOnly: !!payload.showAnomaliesOnly,
    savedAt: new Date().toISOString(),
  };

  userPresetsStore.set(id, preset);
  revalidatePath('/dashboard');

  return {
    success: true,
    preset,
    message: `Preset "${preset.name}" successfully persisted on server`,
  };
}

/**
 * Next.js Server Action: Generates a high-speed telemetry dataset on the server
 * and streams it directly to the client without exposing generator algorithms.
 */
export async function seedServerTelemetryBatch(
  count: number = 2000,
  timeStepMs: number = 50
): Promise<{ success: boolean; points: DataPoint[]; generatedAt: string; timeMs: number }> {
  const start = performance.now();
  const points = generateInitialDataset(count, timeStepMs);
  const duration = performance.now() - start;

  return {
    success: true,
    points,
    generatedAt: new Date().toISOString(),
    timeMs: Math.round(duration * 100) / 100,
  };
}

/**
 * Next.js Server Action: Converts an array of data points into a compliant CSV export string on the server.
 */
export async function exportServerCSV(points: DataPoint[]): Promise<string> {
  const headers = [
    'ID',
    'Timestamp',
    'ISO_Date',
    'Category',
    'Value',
    'SecondaryValue',
    'IsAnomaly',
    'AnomalyScore',
    'CPU_Load',
    'Memory_MB',
    'Latency_MS',
    'Region',
  ];

  const rows = points.slice(0, 10000).map((pt) => [
    pt.id,
    pt.timestamp,
    new Date(pt.timestamp).toISOString(),
    `"${pt.category}"`,
    pt.value,
    pt.secondaryValue,
    pt.isAnomaly ? '1' : '0',
    pt.anomalyScore,
    pt.metadata?.cpuLoad ?? 0,
    pt.metadata?.memoryMb ?? 0,
    pt.metadata?.latencyMs ?? 0,
    `"${pt.metadata?.region ?? 'us-east'}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
