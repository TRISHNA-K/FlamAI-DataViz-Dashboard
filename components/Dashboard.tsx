'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const LineChart = dynamic(() => import('@/components/charts/LineChart'), { ssr: false });
const ScatterPlot = dynamic(() => import('@/components/charts/ScatterPlot'), { ssr: false });
const BarChart = dynamic(() => import('@/components/charts/BarChart'), { ssr: false });
const Heatmap = dynamic(() => import('@/components/charts/Heatmap'), { ssr: false });

import FilterPanel from '@/components/controls/FilterPanel';
import TimeRangeSelector from '@/components/controls/TimeRangeSelector';
import DataTable from '@/components/ui/DataTable';
import PerformanceMonitor from '@/components/ui/PerformanceMonitor';
import ChartErrorBoundary from '@/components/ui/ChartErrorBoundary';
import { useData } from '@/components/providers/DataProvider';
import { Activity, Keyboard } from 'lucide-react';

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const {
    renderedData,
    filteredData,
    aggregation,
    aggregatedData,
    toggleStreaming,
    injectBurst,
    clearData,
  } = useData();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Global Keyboard Shortcuts for Senior-Level UX Polish
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in a search input
      const activeTag = (e.target as HTMLElement)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        toggleStreaming();
      } else if (e.key === 'b' || e.key === 'B') {
        injectBurst(2000);
      } else if (e.key === 'r' || e.key === 'R') {
        clearData();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleStreaming, injectBurst, clearData]);

  if (!mounted) {
    return (
      <div className="flex flex-col gap-5 pb-16 animate-pulse">
        {/* Top Control Skeletons */}
        <div className="h-16 bg-surface/80 rounded-xl border border-surface-border flex items-center px-4 justify-between">
          <div className="w-48 h-5 bg-slate-800 rounded" />
          <div className="w-32 h-5 bg-slate-800 rounded" />
        </div>
        <div className="h-28 bg-surface/80 rounded-xl border border-surface-border flex items-center px-4 justify-between">
          <div className="w-64 h-5 bg-slate-800 rounded" />
          <div className="w-48 h-5 bg-slate-800 rounded" />
        </div>

        {/* 2x2 Chart Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[360px] bg-surface/80 rounded-xl border border-surface-border p-4 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className="w-36 h-4 bg-slate-800 rounded" />
                <div className="w-20 h-4 bg-slate-800 rounded" />
              </div>
              <div className="flex-1 flex items-center justify-center text-xs font-mono text-slate-500">
                <Activity className="w-5 h-5 mr-2 animate-spin text-sky-400" />
                Initializing High-Performance Canvas Engine...
              </div>
              <div className="w-full h-4 bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>

        {/* Virtualized Table Skeleton */}
        <div className="h-[440px] bg-surface/80 rounded-xl border border-surface-border p-4 flex flex-col justify-between">
          <div className="w-48 h-5 bg-slate-800 rounded" />
          <div className="w-full h-72 bg-slate-900/50 rounded" />
          <div className="w-32 h-4 bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-16">
      {/* Floating Performance Telemetry HUD */}
      <PerformanceMonitor />

      {/* Control Panels */}
      <div className="flex flex-col gap-4">
        <TimeRangeSelector />
        <FilterPanel />
      </div>

      {/* 2x2 Responsive Visualizations Grid wrapped in Suspense & Error Boundaries */}
      <React.Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[360px] bg-surface rounded-xl border border-surface-border" />
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 1. Time-Series Line Chart (Gradient Area + Dual Series) */}
          <ChartErrorBoundary chartName="Time-Series Line Chart">
            <LineChart data={renderedData} />
          </ChartErrorBoundary>

          {/* 2. Scatter Plot (10k+ Points with O(1) Spatial Grid) */}
          <ChartErrorBoundary chartName="Scatter Distribution Plot">
            <ScatterPlot data={renderedData} />
          </ChartErrorBoundary>

          {/* 3. Aggregated Bucket Bar Chart */}
          <ChartErrorBoundary chartName="Aggregation Histogram">
            <BarChart
              data={renderedData}
              aggregation={aggregation}
              aggregatedData={aggregatedData}
            />
          </ChartErrorBoundary>

          {/* 4. Time × Node Density Heatmap */}
          <ChartErrorBoundary chartName="Density Heatmap">
            <Heatmap data={renderedData} />
          </ChartErrorBoundary>
        </div>
      </React.Suspense>

      {/* Virtualized Telemetry Data Table wrapped in Suspense & Error Boundary */}
      <React.Suspense
        fallback={
          <div className="h-[440px] bg-surface rounded-xl border border-surface-border animate-pulse" />
        }
      >
        <div className="w-full">
          <ChartErrorBoundary chartName="Telemetry Virtualized Table">
            <DataTable data={filteredData} />
          </ChartErrorBoundary>
        </div>
      </React.Suspense>
    </div>
  );
}
