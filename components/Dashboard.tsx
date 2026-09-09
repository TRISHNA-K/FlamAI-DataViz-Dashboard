'use client';

import React, { useState, useEffect } from 'react';
import LineChart from '@/components/charts/LineChart';
import ScatterPlot from '@/components/charts/ScatterPlot';
import BarChart from '@/components/charts/BarChart';
import Heatmap from '@/components/charts/Heatmap';
import FilterPanel from '@/components/controls/FilterPanel';
import TimeRangeSelector from '@/components/controls/TimeRangeSelector';
import DataTable from '@/components/ui/DataTable';
import PerformanceMonitor from '@/components/ui/PerformanceMonitor';
import { useData } from '@/components/providers/DataProvider';
import { Activity } from 'lucide-react';

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const { renderedData, filteredData, aggregation, aggregatedData } = useData();

  useEffect(() => {
    setMounted(true);
  }, []);

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

      {/* 2x2 Responsive Visualizations Grid wrapped in Suspense boundary */}
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
          <LineChart data={renderedData} />

          {/* 2. Scatter Plot (10k+ Points with O(1) Spatial Grid) */}
          <ScatterPlot data={renderedData} />

          {/* 3. Aggregated Bucket Bar Chart */}
          <BarChart
            data={renderedData}
            aggregation={aggregation}
            aggregatedData={aggregatedData}
          />

          {/* 4. Time × Node Density Heatmap */}
          <Heatmap data={renderedData} />
        </div>
      </React.Suspense>

      {/* Virtualized Telemetry Data Table wrapped in Suspense boundary */}
      <React.Suspense
        fallback={
          <div className="h-[440px] bg-surface rounded-xl border border-surface-border animate-pulse" />
        }
      >
        <div className="w-full">
          <DataTable data={filteredData} />
        </div>
      </React.Suspense>
    </div>
  );
}
