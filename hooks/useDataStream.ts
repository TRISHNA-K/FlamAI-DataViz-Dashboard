'use client';

import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { AggregationPeriod, DataPoint, StreamingConfig } from '@/lib/types';
import { generateInitialDataset, generateStreamBatch } from '@/lib/dataGenerator';
import { SlidingDataBuffer, lttbDownsample, minMaxDownsample, aggregateByTimePeriod } from '@/lib/performanceUtils';

interface UseDataStreamOptions {
  initialData?: DataPoint[];
  defaultCapacity?: number;
  defaultIntervalMs?: number;
}

export function useDataStream(options: UseDataStreamOptions = {}) {
  const {
    initialData,
    defaultCapacity = 10000,
    defaultIntervalMs = 100,
  } = options;

  const [isPending, startTransition] = useTransition();

  const [config, setConfig] = useState<StreamingConfig>({
    intervalMs: defaultIntervalMs,
    batchSize: 1,
    targetPointCount: defaultCapacity,
    isRunning: true,
    stressMode: false,
  });

  const [aggregation, setAggregation] = useState<AggregationPeriod>('raw');

  // Maintain sliding buffer in a ref to avoid allocating arrays on every 100ms tick
  const bufferRef = useRef<SlidingDataBuffer | null>(null);
  if (!bufferRef.current) {
    bufferRef.current = new SlidingDataBuffer(100000);
    if (initialData && initialData.length > 0) {
      bufferRef.current.pushBatch(initialData);
    } else {
      const generated = generateInitialDataset(defaultCapacity);
      bufferRef.current.pushBatch(generated);
    }
  }

  // React state for points snapshot
  const [dataPoints, setDataPoints] = useState<DataPoint[]>(() => {
    return bufferRef.current ? bufferRef.current.toArray() : [];
  });

  // Web Worker ref
  const workerRef = useRef<Worker | null>(null);

  // Initialize Web Worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Worker' in window) {
      try {
        const worker = new Worker('/workers/dataWorker.js');
        workerRef.current = worker;

        worker.onmessage = (e) => {
          const { type, payload } = e.data;
          if (type === 'GENERATE_BATCH_RESULT') {
            if (bufferRef.current) {
              bufferRef.current.pushBatch(payload);
              setDataPoints(bufferRef.current.toArray());
            }
          }
        };

        return () => {
          worker.terminate();
          workerRef.current = null;
        };
      } catch (err) {
        console.warn('Web Worker initialization fallback to main thread:', err);
      }
    }
  }, []);

  // Ref tracking latest timestamp to prevent re-creating setInterval on every tick
  const latestTimestampRef = useRef<number>(
    initialData && initialData.length > 0
      ? initialData[initialData.length - 1].timestamp
      : Date.now()
  );

  // Streaming timer loop - depends strictly on configuration, not on data array
  useEffect(() => {
    if (!config.isRunning) return;

    const intervalId = setInterval(() => {
      if (!bufferRef.current) return;

      // Generate points advancing from the tracked latest timestamp
      const pointsToGenerate = config.stressMode ? Math.max(5, config.batchSize * 5) : config.batchSize;
      const newPoints = generateStreamBatch(pointsToGenerate, latestTimestampRef.current);
      latestTimestampRef.current = newPoints[newPoints.length - 1].timestamp;

      bufferRef.current.pushBatch(newPoints);

      // If array exceeds targetPointCount, trim to targetPointCount
      const currentArray = bufferRef.current.toArray();
      if (currentArray.length > config.targetPointCount) {
        bufferRef.current.setCapacity(config.targetPointCount);
      }

      setDataPoints(bufferRef.current.toArray());
    }, config.intervalMs);

    return () => clearInterval(intervalId);
  }, [config.isRunning, config.intervalMs, config.batchSize, config.stressMode, config.targetPointCount]);

  // Adjust target point count (e.g., from stress test selector: 1k, 5k, 10k, 50k, 100k)
  const setTargetPointCount = useCallback((count: number) => {
    startTransition(() => {
      setConfig((prev) => ({
        ...prev,
        targetPointCount: count,
        stressMode: count >= 50000,
      }));

      if (!bufferRef.current) return;

      const currentSize = bufferRef.current.size;
      if (count > currentSize) {
        // Need to expand with additional generated points
        const needed = count - currentSize;
        const currentData = bufferRef.current.toArray();
        const startTs = currentData.length > 0
          ? currentData[0].timestamp - needed * 100
          : Date.now() - count * 100;
        const additional = generateInitialDataset(needed, 100);
        
        bufferRef.current.setCapacity(count);
        bufferRef.current.pushBatch([...additional, ...currentData]);
        setDataPoints(bufferRef.current.toArray());
      } else {
        // Shrink to fit
        bufferRef.current.setCapacity(count);
        setDataPoints(bufferRef.current.toArray());
      }
    });
  }, []);

  const setIntervalMs = useCallback((intervalMs: number) => {
    setConfig((prev) => ({ ...prev, intervalMs }));
  }, []);

  const toggleStreaming = useCallback(() => {
    setConfig((prev) => ({ ...prev, isRunning: !prev.isRunning }));
  }, []);

  const injectBurst = useCallback((burstSize: number = 1000) => {
    if (!bufferRef.current) return;
    const burst = generateStreamBatch(burstSize, latestTimestampRef.current);
    latestTimestampRef.current = burst[burst.length - 1].timestamp;
    bufferRef.current.pushBatch(burst);
    setDataPoints(bufferRef.current.toArray());
  }, []);

  const injectCustomPoints = useCallback((points: DataPoint[]) => {
    if (!bufferRef.current || points.length === 0) return;
    latestTimestampRef.current = points[points.length - 1].timestamp;
    bufferRef.current.pushBatch(points);
    setDataPoints(bufferRef.current.toArray());
  }, []);

  const clearData = useCallback(() => {
    if (bufferRef.current) {
      bufferRef.current.clear();
      const fresh = generateInitialDataset(config.targetPointCount);
      bufferRef.current.pushBatch(fresh);
      setDataPoints(bufferRef.current.toArray());
    }
  }, [config.targetPointCount]);

  // Rendered downsampled dataset for display (maintains visual peak fidelity at 60fps)
  const getDownsampledData = useCallback((threshold: number = 1500): DataPoint[] => {
    if (dataPoints.length <= threshold) return dataPoints;
    if (dataPoints.length > 30000) {
      // For massive 30k-100k points, use ultra-fast MinMax decimation (< 2ms)
      return minMaxDownsample(dataPoints, threshold);
    }
    // For 10k-30k points, use LTTB
    return lttbDownsample(dataPoints, threshold);
  }, [dataPoints]);

  return {
    data: dataPoints,
    getDownsampledData,
    aggregation,
    setAggregation,
    config,
    setConfig,
    setIntervalMs,
    toggleStreaming,
    setTargetPointCount,
    injectBurst,
    injectCustomPoints,
    clearData,
    isTransitionPending: isPending,
  };
}
