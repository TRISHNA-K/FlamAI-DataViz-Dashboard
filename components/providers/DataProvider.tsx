'use client';

import React, { createContext, useContext, useState, useMemo, useTransition, useCallback } from 'react';
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
import { aggregateByTimePeriod } from '@/lib/performanceUtils';

interface DataContextType {
  // Data
  allData: DataPoint[];
  filteredData: DataPoint[];
  renderedData: DataPoint[];
  aggregatedData: AggregatedBucket[];
  
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

  // Calculate filtered data
  const filteredData = useMemo(() => {
    if (allData.length === 0) return [];

    const selectedCategories = new Set(filter.categories);
    const minVal = filter.minValue;
    const maxVal = filter.maxValue;
    const anomaliesOnly = filter.showAnomaliesOnly;
    const search = filter.searchQuery.toLowerCase().trim();

    // Determine time bounds
    let startTime = 0;
    let endTime = Infinity;

    if (timeRange.preset !== 'all') {
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

    return allData.filter((pt) => {
      // Time check
      if (pt.timestamp < startTime || pt.timestamp > endTime) return false;
      // Category check
      if (!selectedCategories.has(pt.category)) return false;
      // Value range check
      if (pt.value < minVal || pt.value > maxVal) return false;
      // Anomaly check
      if (anomaliesOnly && !pt.isAnomaly) return false;
      // Search query check
      if (search && !pt.id.toLowerCase().includes(search) && !pt.category.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });
  }, [allData, filter, timeRange]);

  // Downsample filtered data for visual charts to maintain 60 FPS
  const renderedData = useMemo(() => {
    if (filteredData.length <= 1500) return filteredData;
    return getDownsampledData(1500);
  }, [filteredData, getDownsampledData]);

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
