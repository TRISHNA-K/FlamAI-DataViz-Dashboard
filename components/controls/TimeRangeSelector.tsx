'use client';

import React from 'react';
import { useData } from '@/components/providers/DataProvider';
import { AggregationPeriod, TimeRangePreset } from '@/lib/types';
import { formatTime24h } from '@/lib/canvasUtils';
import { Clock, Layers } from 'lucide-react';

const TIME_PRESETS: { label: string; value: TimeRangePreset }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: 'All Time', value: 'all' },
];

const AGGREGATION_OPTIONS: { label: string; value: AggregationPeriod }[] = [
  { label: 'Raw Stream', value: 'raw' },
  { label: '1 Min Buckets', value: '1min' },
  { label: '5 Min Buckets', value: '5min' },
  { label: '1 Hour Buckets', value: '1hour' },
];

function TimeRangeSelector() {
  const {
    timeRange,
    setTimeRangePreset,
    aggregation,
    setAggregation,
    renderedData,
    filteredData,
  } = useData();

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const minTime = filteredData.length > 0 ? filteredData[0].timestamp : 0;
  const maxTime =
    filteredData.length > 0 ? filteredData[filteredData.length - 1].timestamp : 0;
  const spanSec = Math.max(0, Math.round((maxTime - minTime) / 1000));

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
      {/* Time Range Preset Group */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-300 font-medium text-xs">
          <Clock className="w-4 h-4 text-primary" />
          <span>Window Range:</span>
        </div>

        <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-lg border border-surface-border">
          {TIME_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setTimeRangePreset(preset.value)}
              className={`px-3 py-1 text-xs font-mono rounded transition-all ${
                timeRange.preset === preset.value
                  ? 'bg-sky-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {mounted && minTime > 0 && (
          <div className="text-xs font-mono text-slate-400 hidden sm:block">
            Duration: <span className="text-sky-300">{spanSec}s</span> (
            {formatTime24h(minTime)}
            {' → '}
            {formatTime24h(maxTime)}
            )
          </div>
        )}
      </div>

      {/* Aggregation Mode Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-slate-300 font-medium text-xs">
          <Layers className="w-4 h-4 text-accent-emerald" />
          <span>Aggregation:</span>
        </div>

        <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-lg border border-surface-border">
          {AGGREGATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAggregation(opt.value)}
              className={`px-3 py-1 text-xs font-mono rounded transition-all ${
                aggregation === opt.value
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default React.memo(TimeRangeSelector);
