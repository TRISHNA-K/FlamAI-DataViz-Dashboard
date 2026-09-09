'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useData } from '@/components/providers/DataProvider';
import { useChartRenderer } from '@/hooks/useChartRenderer';
import { setupHiDPICanvas, createLinearScale, SpatialGridIndex, CATEGORY_COLORS, CATEGORY_RGBA, formatTimeTick } from '@/lib/canvasUtils';
import { DataPoint } from '@/lib/types';
import { Crosshair, RotateCcw, BoxSelect, X, Sparkles } from 'lucide-react';

interface ClusterStats {
  count: number;
  meanValue: number;
  anomalyCount: number;
  anomalyPercentage: number;
  categoryDistribution: Record<string, number>;
}

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

  // Cluster / Drag-Box Selection State
  const [isBoxSelectMode, setIsBoxSelectMode] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<ClusterStats | null>(null);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

  // Ref tracking current hovered point to avoid redundant React state updates on mouse moves
  const hoveredPointRef = useRef<{
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

        // Avoid unnecessary React state updates: only set state when active hovered point actually changes
        if (hoveredPointRef.current?.point.id !== nearest.point.id) {
          const nextHovered = {
            point: nearest.point,
            x: nearest.x,
            y: nearest.y,
          };
          hoveredPointRef.current = nextHovered;
          setHoveredPoint(nextHovered);
        }
      } else {
        if (hoveredPointRef.current !== null) {
          hoveredPointRef.current = null;
          setHoveredPoint(null);
        }
      }
    } else {
      if (hoveredPointRef.current !== null) {
        hoveredPointRef.current = null;
        setHoveredPoint(null);
      }
    }

    ctx.restore(); // Restore clipping

    // Draw Box Selection
    if (selectionBox) {
      const bx = Math.min(selectionBox.startX, selectionBox.endX);
      const by = Math.min(selectionBox.startY, selectionBox.endY);
      const bw = Math.abs(selectionBox.endX - selectionBox.startX);
      const bh = Math.abs(selectionBox.endY - selectionBox.startY);

      ctx.save();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.18)';
      ctx.fillRect(bx, by, bw, bh);

      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.restore();
    }

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
    selectionBox,
    startRenderMeasure,
    endRenderMeasure,
  ]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isBoxSelectMode && e.button === 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      isSelectingRef.current = true;
      selectionStartRef.current = { x, y };
      setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
      return;
    }
    eventHandlers.onMouseDown(e);
  }, [isBoxSelectMode, eventHandlers]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isBoxSelectMode && isSelectingRef.current && selectionStartRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setSelectionBox({
        startX: selectionStartRef.current.x,
        startY: selectionStartRef.current.y,
        endX: x,
        endY: y,
      });
      return;
    }
    eventHandlers.onMouseMove(e);
  }, [isBoxSelectMode, eventHandlers]);

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isBoxSelectMode && isSelectingRef.current && selectionStartRef.current && selectionBox) {
      isSelectingRef.current = false;
      const x1 = Math.min(selectionBox.startX, selectionBox.endX);
      const x2 = Math.max(selectionBox.startX, selectionBox.endX);
      const y1 = Math.min(selectionBox.startY, selectionBox.endY);
      const y2 = Math.max(selectionBox.startY, selectionBox.endY);

      if (Math.abs(x2 - x1) > 10 && Math.abs(y2 - y1) > 10) {
        const padding = { top: 20, right: 25, bottom: 35, left: 55 };
        const plotWidth = dimensions.width - padding.left - padding.right;
        const plotHeight = dimensions.height - padding.top - padding.bottom;
        const scaleXRaw = createLinearScale(minTime, maxTime, padding.left, padding.left + plotWidth);
        const scaleY = createLinearScale(minValue, maxValue, padding.top + plotHeight, padding.top);
        const scaleX = (val: number) => padding.left + (scaleXRaw(val) - padding.left) * transform.zoom + transform.panX;

        const matched: DataPoint[] = [];
        let totalVal = 0;
        let anomalyCount = 0;
        const catMap: Record<string, number> = {};

        for (let i = 0; i < renderedData.length; i++) {
          const pt = renderedData[i];
          const px = scaleX(pt.timestamp);
          const py = scaleY(pt.value);

          if (px >= x1 && px <= x2 && py >= y1 && py <= y2) {
            matched.push(pt);
            totalVal += pt.value;
            if (pt.isAnomaly) anomalyCount++;
            catMap[pt.category] = (catMap[pt.category] || 0) + 1;
          }
        }

        if (matched.length > 0) {
          setSelectedCluster({
            count: matched.length,
            meanValue: Math.round((totalVal / matched.length) * 100) / 100,
            anomalyCount,
            anomalyPercentage: Math.round((anomalyCount / matched.length) * 1000) / 10,
            categoryDistribution: catMap,
          });
        } else {
          setSelectedCluster(null);
          setSelectionBox(null);
        }
      } else {
        setSelectionBox(null);
        setSelectedCluster(null);
      }
      selectionStartRef.current = null;
      return;
    }
    eventHandlers.onMouseUp();
  }, [
    isBoxSelectMode,
    selectionBox,
    dimensions,
    minTime,
    maxTime,
    minValue,
    maxValue,
    transform,
    renderedData,
    eventHandlers,
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const nextMode = !isBoxSelectMode;
              setIsBoxSelectMode(nextMode);
              if (!nextMode) {
                setSelectionBox(null);
                setSelectedCluster(null);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-all ${
              isBoxSelectMode
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 font-semibold'
                : 'bg-surface-elevated hover:bg-slate-800 text-slate-300 border-surface-border'
            }`}
            title="Toggle Drag Box Cluster Selection"
          >
            <BoxSelect className="w-3.5 h-3.5" />
            <span>{isBoxSelectMode ? 'Selecting Area' : 'Box Select'}</span>
          </button>

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
      </div>

      <div
        ref={containerRef}
        className={`relative w-full h-[280px] overflow-hidden select-none ${
          isBoxSelectMode ? 'cursor-crosshair' : 'cursor-default'
        }`}
      >
        <canvas
          ref={canvasRef}
          {...eventHandlers}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="absolute inset-0 block w-full h-full"
        />

        {/* Hover Tooltip */}
        {hoveredPoint && !isSelectingRef.current && (
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

        {/* Cluster Selection Statistics Overlay */}
        {selectedCluster && (
          <div className="absolute top-3 right-3 z-20 p-3 bg-slate-950/95 border border-cyan-500/60 rounded-xl shadow-2xl backdrop-blur-md font-mono text-xs max-w-[270px] animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Cluster Analytics</span>
              </div>
              <button
                onClick={() => {
                  setSelectedCluster(null);
                  setSelectionBox(null);
                }}
                className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
              <div>
                <span className="text-slate-400">Selected:</span>
                <div className="text-sm font-bold text-white">
                  {selectedCluster.count.toLocaleString()} pts
                </div>
              </div>
              <div>
                <span className="text-slate-400">Mean:</span>
                <div className="text-sm font-bold text-cyan-300">
                  {selectedCluster.meanValue}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Anomalies:</span>
                <div className="text-sm font-bold text-rose-400">
                  {selectedCluster.anomalyCount} ({selectedCluster.anomalyPercentage}%)
                </div>
              </div>
              <div>
                <span className="text-slate-400">Density:</span>
                <div className="text-sm font-bold text-emerald-400">
                  {Math.round((selectedCluster.count / Math.max(1, renderedData.length)) * 100)}%
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-800/80 text-[10px]">
              {Object.entries(selectedCluster.categoryDistribution).map(([cat, count]) => (
                <span
                  key={cat}
                  className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] || '#38bdf8' }}
                  />
                  {cat}: {count}
                </span>
              ))}
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
        <span className="text-slate-500">
          {isBoxSelectMode ? 'Drag on canvas to box-select cluster' : 'Sub-millisecond hover search • Click Box Select to analyze clusters'}
        </span>
      </div>
    </div>
  );
}

export default React.memo(ScatterPlot);
