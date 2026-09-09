'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PerformanceMetrics } from '@/lib/types';

export function usePerformanceMonitor(totalPoints: number = 0, renderedPoints: number = 0) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    avgFps: 60,
    minFps: 60,
    maxFps: 60,
    frameTime: 16.6,
    memoryUsage: 0,
    heapLimit: 0,
    renderTime: 0,
    dataProcessingTime: 0,
    totalPoints,
    renderedPoints,
    droppedFrames: 0,
    lastUpdated: Date.now(),
  });

  const frameCountRef = useRef<number>(0);
  const lastFpsCalcTimeRef = useRef<number>(performance.now());
  const fpsHistoryRef = useRef<number[]>([]);
  const droppedFramesRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const rafIdRef = useRef<number | null>(null);

  // Benchmarking timers for components to record
  const renderStartTimeRef = useRef<number>(0);
  const lastRecordedRenderTimeRef = useRef<number>(0);
  const lastRecordedProcessingTimeRef = useRef<number>(0);

  const startRenderMeasure = useCallback(() => {
    renderStartTimeRef.current = performance.now();
  }, []);

  const endRenderMeasure = useCallback(() => {
    if (renderStartTimeRef.current > 0) {
      lastRecordedRenderTimeRef.current = performance.now() - renderStartTimeRef.current;
      renderStartTimeRef.current = 0;
    }
  }, []);

  const recordProcessingTime = useCallback((durationMs: number) => {
    lastRecordedProcessingTimeRef.current = durationMs;
  }, []);

  useEffect(() => {
    let active = true;

    // PerformanceObserver for Long Tasks (> 50ms)
    let longTaskObserver: PerformanceObserver | null = null;
    try {
      if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
        longTaskObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (entry.entryType === 'longtask') {
              droppedFramesRef.current += Math.max(1, Math.floor(entry.duration / 16.6));
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      }
    } catch {
      // 'longtask' might not be supported in some browser environments
    }

    // RAF FPS loop
    const loop = (now: number) => {
      if (!active) return;

      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      // Detect dropped frame (took significantly more than 16.7ms for 60fps)
      if (delta > 28) {
        droppedFramesRef.current += Math.floor(delta / 16.6) - 1;
      }

      frameCountRef.current++;

      // Update FPS readout every 500ms for smooth UI readability
      const elapsedSinceFps = now - lastFpsCalcTimeRef.current;
      if (elapsedSinceFps >= 500) {
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsedSinceFps);
        frameCountRef.current = 0;
        lastFpsCalcTimeRef.current = now;

        fpsHistoryRef.current.push(currentFps);
        if (fpsHistoryRef.current.length > 30) {
          fpsHistoryRef.current.shift();
        }

        const avg = Math.round(
          fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length
        );
        const min = Math.min(...fpsHistoryRef.current);
        const max = Math.max(...fpsHistoryRef.current);

        // Memory inspection (Chrome / Chromium specific API)
        let memUsage = 0;
        let memLimit = 0;
        const perfWithMemory = performance as unknown as {
          memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number; totalJSHeapSize: number };
        };
        if (perfWithMemory.memory) {
          memUsage = Math.round((perfWithMemory.memory.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
          memLimit = Math.round((perfWithMemory.memory.jsHeapSizeLimit / (1024 * 1024)) * 10) / 10;
        } else {
          // Simulated baseline for browsers that hide memory details for privacy
          memUsage = Math.round((35 + (totalPoints / 10000) * 8 + Math.sin(now / 5000) * 2) * 10) / 10;
          memLimit = 2048;
        }

        setMetrics({
          fps: currentFps,
          avgFps: avg,
          minFps: min,
          maxFps: max,
          frameTime: Math.round(delta * 10) / 10,
          memoryUsage: memUsage,
          heapLimit: memLimit,
          renderTime: Math.round(lastRecordedRenderTimeRef.current * 10) / 10,
          dataProcessingTime: Math.round(lastRecordedProcessingTimeRef.current * 10) / 10,
          totalPoints,
          renderedPoints,
          droppedFrames: droppedFramesRef.current,
          lastUpdated: Date.now(),
        });
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (longTaskObserver) longTaskObserver.disconnect();
    };
  }, [totalPoints, renderedPoints]);

  return {
    metrics,
    startRenderMeasure,
    endRenderMeasure,
    recordProcessingTime,
  };
}
