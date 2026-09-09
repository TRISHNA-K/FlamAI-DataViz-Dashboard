'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '@/components/providers/DataProvider';
import { useChartRenderer } from '@/hooks/useChartRenderer';
import { setupHiDPICanvas, createLinearScale, SpatialGridIndex, CATEGORY_COLORS, CATEGORY_RGBA, formatTimeTick } from '@/lib/canvasUtils';
import { DataPoint } from '@/lib/types';
import { Crosshair, RotateCcw } from 'lucide-react';

interface ScatterPlotProps {
  data?: DataPoint[];
}

function ScatterPlot({ data }: ScatterPlotProps) {
  const context = useData();
  const renderedData = data || context.renderedData;
  const { startRenderMeasure, endRenderMeasure } = context;
  const {
    canvasRef,
    containerRef,
    dimensions,
    transform,
    mousePos,
    isHovered,
    eventHandlers,
    resetTransform,
  } = useChartRenderer();

  const [hoveredPoint, setHoveredPoint] = useState<{
    point: DataPoint;
    x: number;
    y: number;
  } | null>(null);

  // Maintain Spatial Grid for O(1) hover search
  const spatialIndexRef = useRef<SpatialGridIndex>(new SpatialGridIndex(28));

  // Compute Domain Bounds
  const { minTime, maxTime, minValue, maxValue } = useMemo(() => {
    if (renderedData.length === 0) {
      return { minTime: 0, maxTime: 1, minValue: 0, maxValue: 100 };
    }
    let minT = renderedData[0].timestamp;
    let maxT = renderedData[renderedData.length - 1].timestamp;
    let minV = renderedData[0].value;
    let maxV = renderedData[0].value;

    for (let i = 1; i < renderedData.length; i++) {
      const v = renderedData[i].value;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }

    const padding = (maxV - minV) * 0.1 || 10;
    return {
      minTime: minT,
      maxTime: maxT || minT + 1000,
      minValue: Math.max(0, Math.floor(minV - padding)),
      maxValue: Math.ceil(maxV + padding),
    };
  }, [renderedData]);

  // Main Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    startRenderMeasure();

    const { ctx } = setupHiDPICanvas(canvas, dimensions.width, dimensions.height);
    const { width, height } = dimensions;
    const padding = { top: 20, right: 25, bottom: 35, left: 55 };

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    if (renderedData.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting scatter dataset...', width / 2, height / 2);
      endRenderMeasure();
      return;
    }

    // Set up scales
    const scaleXRaw = createLinearScale(minTime, maxTime, padding.left, padding.left + plotWidth);
    const scaleY = createLinearScale(minValue, maxValue, padding.top + plotHeight, padding.top);

    const scaleX = (val: number) => {
      const rawX = scaleXRaw(val);
      return padding.left + (rawX - padding.left) * transform.zoom + transform.panX;
    };

    // Draw Subtle Grid
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const val = minValue + (i / yTicks) * (maxValue - minValue);
      const y = scaleY(val);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(val)}`, padding.left - 8, y);
    }
    ctx.setLineDash([]);

    // Clear spatial index for new frame
    spatialIndexRef.current.clear();

    // Clip plotting area for points
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, plotWidth, plotHeight);
    ctx.clip();

    // Group points by category for batch rendering
    const categoryBatches: Record<string, { x: number; y: number; pt: DataPoint }[]> = {
      'Server A': [],
      'Server B': [],
      'Server C': [],
      'Server D': [],
    };

    const anomalyBatch: { x: number; y: number; pt: DataPoint }[] = [];

    // Map and index points
    for (let i = 0; i < renderedData.length; i++) {
      const pt = renderedData[i];
      const px = scaleX(pt.timestamp);
      const py = scaleY(pt.value);

      // Only process points within viewport visibility
      if (px >= padding.left - 10 && px <= padding.left + plotWidth + 10) {
        spatialIndexRef.current.insert(px, py, pt);

        if (pt.isAnomaly) {
          anomalyBatch.push({ x: px, y: py, pt });
        } else if (categoryBatches[pt.category]) {
          categoryBatches[pt.category].push({ x: px, y: py, pt });
        }
      }
    }

    // Render batch per category (minimizes context switches for maximum FPS)
    const radius = transform.zoom > 3 ? 3.5 : 2.5;

    for (const [category, points] of Object.entries(categoryBatches)) {
      if (points.length === 0) continue;
      ctx.fillStyle = CATEGORY_RGBA[category as keyof typeof CATEGORY_RGBA] || 'rgba(56, 189, 248, 0.7)';
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        ctx.moveTo(p.x + radius, p.y);
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // Render Anomalies Batch with Crimson Halo
    if (anomalyBatch.length > 0) {
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      for (let i = 0; i < anomalyBatch.length; i++) {
        const p = anomalyBatch[i];
        ctx.moveTo(p.x + 4.5, p.y);
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      }
      ctx.fill();

      // Outer ring
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < anomalyBatch.length; i++) {
        const p = anomalyBatch[i];
        ctx.moveTo(p.x + 7, p.y);
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      }
      ctx.stroke();
    }

    // Hit Testing using Spatial Grid O(1)
    if (isHovered && mousePos && mousePos.x >= padding.left && mousePos.x <= padding.left + plotWidth) {
      const nearest = spatialIndexRef.current.findNearest(mousePos.x, mousePos.y, 25);
      if (nearest) {
        // Draw highlight circle around hovered point
        ctx.beginPath();
        ctx.arc(nearest.x, nearest.y, 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(nearest.x, nearest.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = CATEGORY_COLORS[nearest.point.category] || '#38bdf8';
        ctx.fill();

        setHoveredPoint({
          point: nearest.point,
          x: nearest.x,
          y: nearest.y,
        });
      } else {
        setHoveredPoint(null);
      }
    } else {
      setHoveredPoint(null);
    }

    ctx.restore(); // Restore clipping

    // X-Axis Time Ticks
    const timeSpan = maxTime - minTime;
    const xTicks = Math.max(3, Math.floor(plotWidth / 120));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i <= xTicks; i++) {
      const t = minTime + (i / xTicks) * timeSpan;
      const x = scaleX(t);
      if (x >= padding.left && x <= padding.left + plotWidth) {
        ctx.fillText(formatTimeTick(t, timeSpan), x, padding.top + plotHeight + 10);
      }
    }

    endRenderMeasure();
  }, [
    renderedData,
    dimensions,
    transform,
    minTime,
    maxTime,
    minValue,
    maxValue,
    isHovered,
    mousePos,
    startRenderMeasure,
    endRenderMeasure,
  ]);

  return (
    <div className="relative flex flex-col bg-surface border border-surface-border rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-surface-border/60">
        <div className="flex items-center gap-2">
          <Crosshair className="w-5 h-5 text-accent-cyan" />
          <div>
            <h3 className="text-sm font-semibold text-slate-100 tracking-wide">
              Scatter Distribution ({renderedData.length.toLocaleString()} Points)
            </h3>
            <p className="text-xs text-slate-400">
              Spatial Grid O(1) Hit-Testing • Category Partitioning • Anomaly detection
            </p>
          </div>
        </div>

        {transform.zoom > 1 && (
          <button
            onClick={resetTransform}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 bg-surface-elevated hover:bg-slate-700 border border-surface-border rounded transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset {transform.zoom.toFixed(1)}x</span>
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative w-full h-[280px] overflow-hidden cursor-crosshair select-none"
      >
        <canvas
          ref={canvasRef}
          {...eventHandlers}
          className="absolute inset-0 block w-full h-full"
        />

        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-20 px-3 py-2 text-xs font-mono bg-slate-950/95 text-slate-100 rounded-lg shadow-2xl border border-cyan-500/50 backdrop-blur-md -translate-x-1/2 -translate-y-full min-w-[180px]"
            style={{
              left: `${hoveredPoint.x}px`,
              top: `${hoveredPoint.y - 12}px`,
            }}
          >
            <div className="flex items-center justify-between font-bold border-b border-slate-700 pb-1 mb-1">
              <span style={{ color: CATEGORY_COLORS[hoveredPoint.point.category] }}>
                {hoveredPoint.point.category}
              </span>
              <span className="text-[10px] text-slate-400">
                {hoveredPoint.point.metadata?.region || 'us-east'}
              </span>
            </div>
            <div className="text-white font-semibold text-[13px]">
              Value: {hoveredPoint.point.value.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-300">
              CPU: {hoveredPoint.point.metadata?.cpuLoad}% • Latency: {hoveredPoint.point.metadata?.latencyMs}ms
            </div>
            {hoveredPoint.point.isAnomaly && (
              <div className="text-[10px] text-rose-400 font-bold mt-0.5">
                ⚠ ANOMALY DETECTED (Score: {hoveredPoint.point.anomalyScore})
              </div>
            )}
            <div className="text-[9px] text-slate-500 mt-1">
              {new Date(hoveredPoint.point.timestamp).toISOString()}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 mt-1 border-t border-surface-border/40 font-mono">
        <div className="flex items-center gap-3">
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <span key={cat} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {cat}
            </span>
          ))}
          <span className="flex items-center gap-1 text-rose-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Anomaly
          </span>
        </div>
        <span className="text-slate-500">Sub-millisecond hover search</span>
      </div>
    </div>
  );
}

export default React.memo(ScatterPlot);
