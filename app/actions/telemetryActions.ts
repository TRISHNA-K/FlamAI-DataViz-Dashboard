'use server';

import { generateInitialDataset, generateStreamBatch } from '@/lib/dataGenerator';
import { DataPoint } from '@/lib/types';

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
  const headers = ['ID', 'Timestamp', 'ISO_Date', 'Category', 'Value', 'SecondaryValue', 'IsAnomaly', 'AnomalyScore', 'CPU_Load', 'Memory_MB', 'Latency_MS', 'Region'];
  
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
