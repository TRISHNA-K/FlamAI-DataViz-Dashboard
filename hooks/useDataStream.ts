'use client';

import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { AggregationPeriod, DataPoint, StreamingConfig } from '@/lib/types';
import { generateInitialDataset, generateStreamBatch } from '@/lib/dataGenerator';
import { SlidingDataBuffer, lttbDownsample, minMaxDownsample } from '@/lib/performanceUtils';

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

  // React state for points snapshot (consumed by virtual table and components)
  const [dataPoints, setDataPoints] = useState<DataPoint[]>(() => {
    return bufferRef.current ? bufferRef.current.toArray() : [];
  });

  // Web Worker ref and pending request map for off-thread downsampling
  const workerRef = useRef<Worker | null>(null);
  const pendingRequestsRef = useRef<Map<number, (data: DataPoint[]) => void>>(new Map());
  const requestIdRef = useRef<number>(0);
  const [isWorkerActive, setIsWorkerActive] = useState(false);

  // Initialize Web Worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Worker' in window) {
      try {
        const worker = new Worker('/workers/dataWorker.js');
        workerRef.current = worker;
        setIsWorkerActive(true);

        worker.onmessage = (e: MessageEvent) => {
          const { type, payload, reqId } = e.data;

          if (type === 'GENERATE_BATCH_RESULT') {
            if (bufferRef.current && Array.isArray(payload) && payload.length > 0) {
              bufferRef.current.pushBatch(payload);
              latestTimestampRef.current = payload[payload.length - 1].timestamp;

              if (bufferRef.current.size > config.targetPointCount) {
                bufferRef.current.setCapacity(config.targetPointCount);
              }

              const now = Date.now();
              const shouldSyncState =
                !config.stressMode ||
                config.intervalMs >= 100 ||
                now - lastStateSyncRef.current >= 80;

              if (shouldSyncState) {
                lastStateSyncRef.current = now;
                setDataPoints(bufferRef.current.toArray());
              }
            }
          } else if (
            (type === 'DOWNSAMPLE_LTTB_RESULT' || type === 'DOWNSAMPLE_MINMAX_RESULT') &&
            reqId !== undefined
          ) {
            const resolver = pendingRequestsRef.current.get(reqId);
            if (resolver) {
              pendingRequestsRef.current.delete(reqId);
              resolver(payload);
            }
          }
        };

        worker.onerror = (err) => {
          console.warn('Web Worker encountered an error, using main thread fallback:', err);
          setIsWorkerActive(false);
        };

        return () => {
          worker.terminate();
          workerRef.current = null;
          setIsWorkerActive(false);
          pendingRequestsRef.current.clear();
        };
      } catch (err) {
        console.warn('Web Worker initialization fallback to main thread:', err);
        setIsWorkerActive(false);
      }
    }
  }, [config.stressMode, config.intervalMs, config.targetPointCount]);

  // Ref tracking latest timestamp to prevent re-creating setInterval on every tick
  const latestTimestampRef = useRef<number>(
    initialData && initialData.length > 0
      ? initialData[initialData.length - 1].timestamp
      : Date.now()
  );

  // Ref tracking timestamp of last raw array state synchronization
  const lastStateSyncRef = useRef<number>(0);

  // Streaming timer loop - depends strictly on configuration, not on data array
  useEffect(() => {
    if (!config.isRunning) return;

    const intervalId = setInterval(() => {
      if (!bufferRef.current) return;

      // Generate points advancing from the tracked latest timestamp
      const pointsToGenerate = config.stressMode ? Math.max(5, config.batchSize * 5) : config.batchSize;

      if (workerRef.current) {
        // Offload real-time batch generation to background Web Worker thread
        workerRef.current.postMessage({
          type: 'GENERATE_BATCH',
          payload: {
            count: pointsToGenerate,
            startTimestamp: latestTimestampRef.current,
            timeStepMs: 100,
          },
        });
      } else {
        // Synchronous fallback when Web Worker is not available
        const newPoints = generateStreamBatch(pointsToGenerate, latestTimestampRef.current);
        latestTimestampRef.current = newPoints[newPoints.length - 1].timestamp;

        bufferRef.current.pushBatch(newPoints);

        // If array exceeds targetPointCount, trim to targetPointCount
        if (bufferRef.current.size > config.targetPointCount) {
          bufferRef.current.setCapacity(config.targetPointCount);
        }

        const now = Date.now();
        const shouldSyncState =
          !config.stressMode ||
          config.intervalMs >= 100 ||
          now - lastStateSyncRef.current >= 80;

        if (shouldSyncState) {
          lastStateSyncRef.current = now;
          setDataPoints(bufferRef.current.toArray());
        }
      }
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
        
        // Pass startTs to connect timestamps continuously
        const additional = generateInitialDataset(needed, 100, startTs);
        
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

  // Offload burst point generation to Web Worker when available
  const injectBurst = useCallback((burstSize: number = 1000) => {
    if (workerRef.current) {
      // Actively delegate heavy synthetic generation to dedicated background worker thread
      workerRef.current.postMessage({
        type: 'GENERATE_BATCH',
        payload: {
          count: burstSize,
          startTimestamp: latestTimestampRef.current,
          timeStepMs: 100,
        },
      });
    } else {
      if (!bufferRef.current) return;
      const burst = generateStreamBatch(burstSize, latestTimestampRef.current);
      latestTimestampRef.current = burst[burst.length - 1].timestamp;
      bufferRef.current.pushBatch(burst);
      setDataPoints(bufferRef.current.toArray());
    }
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

  /**
   * Synchronous downsampling algorithm.
   * If sourceData (e.g. filteredData) is passed, downsamples sourceData.
   * If omitted, downsamples directly from circular ring buffer without allocating intermediate arrays.
   */
  const getDownsampledData = useCallback(
    (sourceData?: DataPoint[], threshold: number = 1500): DataPoint[] => {
      if (sourceData) {
        if (sourceData.length <= threshold) return sourceData;
        if (sourceData.length > 30000) {
          return minMaxDownsample(sourceData, threshold);
        }
        return lttbDownsample(sourceData, threshold);
      }

      if (bufferRef.current) {
        if (bufferRef.current.size <= threshold) {
          return bufferRef.current.toArray();
        }
        if (bufferRef.current.size > 30000) {
          return bufferRef.current.downsampleMinMax(threshold);
        }
        return bufferRef.current.downsampleLTTB(threshold);
      }

      return [];
    },
    []
  );

  /**
   * Dedicated off-thread Web Worker downsampling method.
   * Dispatches heavy LTTB / MinMax calculation to background worker thread.
   */
  const downsampleWithWorker = useCallback(
    (
      data: DataPoint[],
      threshold: number = 1500,
      algorithm: 'lttb' | 'minmax' = 'lttb'
    ): Promise<DataPoint[]> => {
      return new Promise((resolve) => {
        if (!workerRef.current || data.length <= threshold) {
          resolve(getDownsampledData(data, threshold));
          return;
        }

        const reqId = ++requestIdRef.current;
        pendingRequestsRef.current.set(reqId, resolve);

        workerRef.current.postMessage({
          type: algorithm === 'minmax' ? 'DOWNSAMPLE_MINMAX' : 'DOWNSAMPLE_LTTB',
          payload: { data, threshold, reqId },
        });

        // Safety timeout fallback (300ms)
        setTimeout(() => {
          if (pendingRequestsRef.current.has(reqId)) {
            pendingRequestsRef.current.delete(reqId);
            resolve(getDownsampledData(data, threshold));
          }
        }, 300);
      });
    },
    [getDownsampledData]
  );

  return {
    data: dataPoints,
    bufferRef,
    getDownsampledData,
    downsampleWithWorker,
    isWorkerActive,
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
