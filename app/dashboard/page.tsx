import React, { Suspense } from 'react';
import Dashboard from '@/components/Dashboard';
import DashboardServerInsights, {
  DashboardServerInsightsSkeleton,
} from '@/components/DashboardServerInsights';
import DashboardChartConfigsStream, {
  DashboardChartConfigsSkeleton,
} from '@/components/DashboardChartConfigsStream';
import DashboardClusterEdgeStream, {
  DashboardClusterEdgeSkeleton,
} from '@/components/DashboardClusterEdgeStream';

/**
 * Next.js Server Component (App Router)
 * Demonstrates advanced streaming UI with independent React Suspense boundaries:
 * 1. Fleet Insights Stream (Async RSC)
 * 2. Static Chart Configuration Stream (Async RSC)
 * 3. Edge Cluster Latency Stream (Async RSC)
 * 4. High-Performance Client Dashboard
 */
export default async function DashboardPage() {
  return (
    <>
      {/* Boundary 1: Fleet Insights Streamed via HTTP Chunking */}
      <Suspense fallback={<DashboardServerInsightsSkeleton />}>
        <DashboardServerInsights />
      </Suspense>

      {/* Boundary 2: Static Chart Configs Streamed via HTTP Chunking */}
      <Suspense fallback={<DashboardChartConfigsSkeleton />}>
        <DashboardChartConfigsStream />
      </Suspense>

      {/* Boundary 3: Edge Route Latencies Streamed via HTTP Chunking */}
      <Suspense fallback={<DashboardClusterEdgeSkeleton />}>
        <DashboardClusterEdgeStream />
      </Suspense>

      {/* Boundary 4: Live Telemetry Dashboard & Interactive Charts */}
      <Dashboard />
    </>
  );
}
