'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useTransition, useCallback } from 'react';
import {
  AggregatedBucket,
  AggregationPeriod,
  CategoryType,
  DataPoint,
  FilterState,
  PerformanceMetrics,
  StreamingConfig,
  TimeRange,
  TimeRangePreset,
} from '@/lib/types';
import { useDataStream } from '@/hooks/useDataStream';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { aggregateByTimePeriod, lttbDownsample, minMaxDownsample } from '@/lib/performanceUtils';

interface DataContextType {
  // Data
  allData: DataPoint[];
  filteredData: DataPoint[];
  renderedData: DataPoint[];
  aggregatedData: AggregatedBucket[];
  downsampleWithWorker: (data: DataPoint[], threshold?: number, algorithm?: 'lttb' | 'minmax') => Promise<DataPoint[]>;
  isWorkerActive: boolean;
  
  // Streaming & Config
  streamingConfig: StreamingConfig;
  toggleStreaming: () => void;
  setIntervalMs: (interval: number) => void;
  setTargetPointCount: (count: number) => void;
  injectBurst: (count?: number) => void;
  injectCustomPoints: (points: DataPoint[]) => void;
  clearData: () => void;
  
  // Filtering & Time
  filter: FilterState;
  setFilter: React.Dispatch<React.SetStateAction<FilterState>>;
  updateCategoryFilter: (category: CategoryType, enabled: boolean) => void;
  setValueRange: (min: number, max: number) => void;
  toggleAnomaliesOnly: () => void;
  setSearchQuery: (query: string) => void;
  
  // Time Range
  timeRange: TimeRange;
  setTimeRangePreset: (preset: TimeRangePreset) => void;
  setCustomTimeRange: (start: number, end: number) => void;
  
  // Aggregation
  aggregation: AggregationPeriod;
  setAggregation: (period: AggregationPeriod) => void;
  
  // Performance
  metrics: PerformanceMetrics;
  startRenderMeasure: () => void;
  endRenderMeasure: () => void;
  isPending: boolean;
}

const DataContext = createContext<DataContextType | null>(null);

interface DataProviderProps {
  children: React.ReactNode;
  initialData?: DataPoint[];
}

export function DataProvider({ children, initialData }: DataProviderProps) {
  const [isPending, startTransition] = useTransition();

  // Initialize data stream with 10,000 points default
  const {
    data: allData,
    getDownsampledData,
    downsampleWithWorker,
    isWorkerActive,
    aggregation,
    setAggregation,
    config: streamingConfig,
    toggleStreaming,
    setIntervalMs,
    setTargetPointCount,
    injectBurst,
    injectCustomPoints,
    clearData,
  } = useDataStream({ initialData, defaultCapacity: 10000, defaultIntervalMs: 100 });

  // Filtering State
  const [filter, setFilter] = useState<FilterState>({
    categories: ['Server A', 'Server B', 'Server C', 'Server D'],
    minValue: 0,
    maxValue: 1000,
    showAnomaliesOnly: false,
    searchQuery: '',
  });

  // Time Range State
  const [timeRange, setTimeRange] = useState<TimeRange>({
    preset: 'all',
    start: 0,
    end: 0,
  });

  // Hydrate initial state from URL query parameters (shareable link state)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const rangeParam = params.get('range');
    const aggParam = params.get('agg');
    const nodesParam = params.get('nodes');
    const anomaliesParam = params.get('anomalies');

    if (rangeParam && ['1m', '5m', '15m', '1h', 'all'].includes(rangeParam)) {
      setTimeRange({ preset: rangeParam as TimeRangePreset, start: 0, end: 0 });
    }
    if (aggParam && ['raw', '1min', '5min', '1hour'].includes(aggParam)) {
      setAggregation(aggParam as AggregationPeriod);
    }
    if (nodesParam) {
      const validNodes = nodesParam.split(',').filter((n): n is CategoryType =>
        ['Server A', 'Server B', 'Server C', 'Server D'].includes(n as CategoryType)
      );
      if (validNodes.length > 0) {
        setFilter((prev) => ({ ...prev, categories: validNodes }));
      }
    }
    if (anomaliesParam === 'true') {
      setFilter((prev) => ({ ...prev, showAnomaliesOnly: true }));
    }
  }, [setAggregation]);

  // Synchronize active filters to URL query string without page reloads
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (timeRange.preset !== 'all') params.set('range', timeRange.preset);
    if (aggregation !== 'raw') params.set('agg', aggregation);
    if (filter.categories.length < 4) params.set('nodes', filter.categories.join(','));
    if (filter.showAnomaliesOnly) params.set('anomalies', 'true');

    const queryString = params.toString();
    const newUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState(null, '', newUrl);
  }, [timeRange.preset, aggregation, filter.categories, filter.showAnomaliesOnly]);

  // Calculate filtered data with O(1) fast-path for standard telemetry flow
  const filteredData = useMemo(() => {
    if (allData.length === 0) return [];

    const isAllCategories = filter.categories.length === 4;
    const isFullValueRange = filter.minValue <= 0 && filter.maxValue >= 1000;
    const isAllAnomalies = !filter.showAnomaliesOnly;
    const isNoSearch = !filter.searchQuery.trim();
    const isAllTime = timeRange.preset === 'all';

    // Fast-path: When default filters are active, completely skip iterating 100k items!
    if (isAllCategories && isFullValueRange && isAllAnomalies && isNoSearch && isAllTime) {
      return allData;
    }

    const allowA = filter.categories.includes('Server A');
    const allowB = filter.categories.includes('Server B');
    const allowC = filter.categories.includes('Server C');
    const allowD = filter.categories.includes('Server D');
    const minVal = filter.minValue;
    const maxVal = filter.maxValue;
    const anomaliesOnly = filter.showAnomaliesOnly;
    const search = filter.searchQuery.toLowerCase().trim();

    // Determine time bounds
    let startTime = 0;
    let endTime = Infinity;

    if (!isAllTime) {
      const latestTs = allData[allData.length - 1].timestamp;
      let durationMs = 60 * 1000;
      if (timeRange.preset === '5m') durationMs = 5 * 60 * 1000;
      if (timeRange.preset === '15m') durationMs = 15 * 60 * 1000;
      if (timeRange.preset === '1h') durationMs = 60 * 60 * 1000;
      
      if (timeRange.preset === 'custom') {
        startTime = timeRange.start;
        endTime = timeRange.end;
      } else {
        startTime = latestTs - durationMs;
        endTime = latestTs;
      }
    }

    const result: DataPoint[] = [];
    for (let i = 0; i < allData.length; i++) {
      const pt = allData[i];
      if (pt.timestamp < startTime || pt.timestamp > endTime) continue;

      // Fast category branch
      if (pt.category === 'Server A') {
        if (!allowA) continue;
      } else if (pt.category === 'Server B') {
        if (!allowB) continue;
      } else if (pt.category === 'Server C') {
        if (!allowC) continue;
      } else if (pt.category === 'Server D') {
        if (!allowD) continue;
      }

      if (pt.value < minVal || pt.value > maxVal) continue;
      if (anomaliesOnly && !pt.isAnomaly) continue;
      if (search && !pt.id.toLowerCase().includes(search) && !pt.category.toLowerCase().includes(search)) {
        continue;
      }

      result.push(pt);
    }

    return result;
  }, [allData, filter, timeRange]);

  // Web Worker assisted downsampling state for heavy datasets (> 3000 pts)
  const [workerRenderedData, setWorkerRenderedData] = useState<DataPoint[] | null>(null);

  // Pure synchronous downsampling calculation strictly over filteredData
  const syncRenderedData = useMemo(() => {
    if (filteredData.length <= 1500) return filteredData;
    if (filteredData.length > 30000) {
      return minMaxDownsample(filteredData, 1500);
    }
    return lttbDownsample(filteredData, 1500);
  }, [filteredData]);

  // Offload heavy LTTB / MinMax calculation to background Web Worker
  useEffect(() => {
    if (filteredData.length > 3000) {
      let isCurrent = true;
      const algo = filteredData.length > 30000 ? 'minmax' : 'lttb';
      downsampleWithWorker(filteredData, 1500, algo).then((result) => {
        if (isCurrent && result && result.length > 0) {
          setWorkerRenderedData(result);
        }
      });
      return () => {
        isCurrent = false;
      };
    } else {
      setWorkerRenderedData(null);
    }
  }, [filteredData, downsampleWithWorker]);

  // Use worker downsampled data when available, falling back to sync calculation
  const renderedData =
    workerRenderedData && workerRenderedData.length > 0 ? workerRenderedData : syncRenderedData;

  // Aggregated data when aggregation mode is active
  const aggregatedData = useMemo(() => {
    if (aggregation === 'raw') return [];
    return aggregateByTimePeriod(filteredData, aggregation);
  }, [filteredData, aggregation]);

  // Performance telemetry
  const { metrics, startRenderMeasure, endRenderMeasure } = usePerformanceMonitor(
    allData.length,
    renderedData.length
  );

  // Filter dispatchers wrapped in transition for non-blocking UI
  const updateCategoryFilter = useCallback((category: CategoryType, enabled: boolean) => {
    startTransition(() => {
      setFilter((prev) => {
        const next = enabled
          ? [...prev.categories, category]
          : prev.categories.filter((c) => c !== category);
        return { ...prev, categories: next };
      });
    });
  }, []);

  const setValueRange = useCallback((min: number, max: number) => {
    startTransition(() => {
      setFilter((prev) => ({ ...prev, minValue: min, maxValue: max }));
    });
  }, []);

  const toggleAnomaliesOnly = useCallback(() => {
    startTransition(() => {
      setFilter((prev) => ({ ...prev, showAnomaliesOnly: !prev.showAnomaliesOnly }));
    });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    startTransition(() => {
      setFilter((prev) => ({ ...prev, searchQuery: query }));
    });
  }, []);

  const setTimeRangePreset = useCallback((preset: TimeRangePreset) => {
    startTransition(() => {
      setTimeRange({ preset, start: 0, end: 0 });
    });
  }, []);

  const setCustomTimeRange = useCallback((start: number, end: number) => {
    startTransition(() => {
      setTimeRange({ preset: 'custom', start, end });
    });
  }, []);

  const value = useMemo(
    () => ({
      allData,
      filteredData,
      renderedData,
      aggregatedData,
      downsampleWithWorker,
      isWorkerActive,
      streamingConfig,
      toggleStreaming,
      setIntervalMs,
      setTargetPointCount,
      injectBurst,
      injectCustomPoints,
      clearData,
      filter,
      setFilter,
      updateCategoryFilter,
      setValueRange,
      toggleAnomaliesOnly,
      setSearchQuery,
      timeRange,
      setTimeRangePreset,
      setCustomTimeRange,
      aggregation,
      setAggregation,
      metrics,
      startRenderMeasure,
      endRenderMeasure,
      isPending,
    }),
    [
      allData,
      filteredData,
      renderedData,
      aggregatedData,
      downsampleWithWorker,
      isWorkerActive,
      streamingConfig,
      toggleStreaming,
      setIntervalMs,
      setTargetPointCount,
      injectBurst,
      injectCustomPoints,
      clearData,
      filter,
      updateCategoryFilter,
      setValueRange,
      toggleAnomaliesOnly,
      setSearchQuery,
      timeRange,
      setTimeRangePreset,
      setCustomTimeRange,
      aggregation,
      setAggregation,
      metrics,
      startRenderMeasure,
      endRenderMeasure,
      isPending,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
