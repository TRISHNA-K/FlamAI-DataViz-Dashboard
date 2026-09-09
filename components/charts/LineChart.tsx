'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useData } from '@/components/providers/DataProvider';
import { useChartRenderer } from '@/hooks/useChartRenderer';
import { setupHiDPICanvas, createLinearScale, formatTimeTick, CATEGORY_COLORS } from '@/lib/canvasUtils';
import { ZoomIn, ZoomOut, RotateCcw, Activity } from 'lucide-react';
import { DataPoint } from '@/lib/types';

interface LineChartProps {
  data?: DataPoint[];
}

function LineChart({ data }: LineChartProps) {
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
    timestamp: number;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  // Compute domain bounds
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

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    startRenderMeasure();

    const { ctx } = setupHiDPICanvas(canvas, dimensions.width, dimensions.height);
    const { width, height } = dimensions;
    const padding = { top: 20, right: 30, bottom: 35, left: 55 };

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    if (renderedData.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting live data stream...', width / 2, height / 2);
      endRenderMeasure();
      return;
    }

    // Set up scales with zoom & pan applied
    const scaleXRaw = createLinearScale(minTime, maxTime, padding.left, padding.left + plotWidth);
    const scaleY = createLinearScale(minValue, maxValue, padding.top + plotHeight, padding.top);

    const scaleX = (val: number) => {
      const rawX = scaleXRaw(val);
      return padding.left + (rawX - padding.left) * transform.zoom + transform.panX;
    };

    // Clip plotting area so zoomed lines don't bleed into axes
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, plotWidth, plotHeight);
    ctx.clip();

    // 1. Draw Subtle Grid Lines (Horizontal)
    const yTickCount = 5;
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let i = 0; i <= yTickCount; i++) {
      const val = minValue + (i / yTickCount) * (maxValue - minValue);
      const y = scaleY(val);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();
    }
    ctx.setLineDash([]); // Reset line dash

    // 2. Draw Area Gradient under the line
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    gradient.addColorStop(0.7, 'rgba(56, 189, 248, 0.08)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    ctx.beginPath();
    const firstX = scaleX(renderedData[0].timestamp);
    const firstY = scaleY(renderedData[0].value);
    ctx.moveTo(firstX, padding.top + plotHeight);
    ctx.lineTo(firstX, firstY);

    for (let i = 1; i < renderedData.length; i++) {
      const pt = renderedData[i];
      const x = scaleX(pt.timestamp);
      const y = scaleY(pt.value);
      ctx.lineTo(x, y);
    }

    const lastX = scaleX(renderedData[renderedData.length - 1].timestamp);
    ctx.lineTo(lastX, padding.top + plotHeight);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 3. Draw Primary Series Line
    ctx.beginPath();
    ctx.strokeStyle = '#38bdf8'; // Primary Neon Sky Blue
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.moveTo(firstX, firstY);
    for (let i = 1; i < renderedData.length; i++) {
      const pt = renderedData[i];
      const x = scaleX(pt.timestamp);
      const y = scaleY(pt.value);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 4. Draw Secondary Metric Line (CPU load / secondaryValue)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.55)'; // Violet
    ctx.lineWidth = 1.5;
    for (let i = 0; i < renderedData.length; i += 2) {
      const pt = renderedData[i];
      const x = scaleX(pt.timestamp);
      const y = scaleY(pt.secondaryValue * 3); // Scaled for comparison
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 5. Draw Anomalies as Crimson Glowing Pulses
    for (let i = 0; i < renderedData.length; i++) {
      const pt = renderedData[i];
      if (pt.isAnomaly) {
        const ax = scaleX(pt.timestamp);
        const ay = scaleY(pt.value);
        if (ax >= padding.left && ax <= padding.left + plotWidth) {
          ctx.beginPath();
          ctx.arc(ax, ay, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#f43f5e';
          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0; // reset
        }
      }
    }

    // 6. Interactive Crosshair & Hover Tooltip Hit Test
    if (isHovered && mousePos && mousePos.x >= padding.left && mousePos.x <= padding.left + plotWidth) {
      // Find nearest point on X axis
      const hoveredX = mousePos.x;
      // Invert scale to approximate timestamp
      const normX = (hoveredX - padding.left - transform.panX) / (plotWidth * transform.zoom);
      const approxTime = minTime + normX * (maxTime - minTime);

      // Binary search for closest point
      let low = 0;
      let high = renderedData.length - 1;
      let closest = renderedData[0];
      let minDiff = Math.abs(renderedData[0].timestamp - approxTime);

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const pt = renderedData[mid];
        const diff = Math.abs(pt.timestamp - approxTime);

        if (diff < minDiff) {
          minDiff = diff;
          closest = pt;
        }

        if (pt.timestamp < approxTime) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const cx = scaleX(closest.timestamp);
      const cy = scaleY(closest.value);

      // Draw Crosshair lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(cx, padding.top);
      ctx.lineTo(cx, padding.top + plotHeight);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(padding.left, cy);
      ctx.lineTo(padding.left + plotWidth, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point Indicator
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.fill();
      ctx.stroke();

      setHoveredPoint({
        timestamp: closest.timestamp,
        value: closest.value,
        x: cx,
        y: cy,
      });
    } else {
      setHoveredPoint(null);
    }

    ctx.restore(); // Restore clipping

    // 7. Render Crisp Y-Axis Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= yTickCount; i++) {
      const val = minValue + (i / yTickCount) * (maxValue - minValue);
      const y = scaleY(val);
      ctx.fillText(`${Math.round(val)}`, padding.left - 8, y);
    }

    // 8. Render Crisp X-Axis Time Labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xTickCount = Math.max(3, Math.floor(plotWidth / 120));
    const timeSpan = maxTime - minTime;

    for (let i = 0; i <= xTickCount; i++) {
      const t = minTime + (i / xTickCount) * timeSpan;
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

  const latestVal = renderedData.length > 0 ? renderedData[renderedData.length - 1].value : 0;

  return (
    <div className="relative flex flex-col bg-surface border border-surface-border rounded-xl p-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-surface-border/60">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-slate-100 tracking-wide">
              Time-Series Stream (10,000+ Pts)
            </h3>
            <p className="text-xs text-slate-400">
              Live updates • 60 FPS Canvas hybrid • Area gradient
            </p>
          </div>
        </div>

        {/* Live metric badge & Zoom controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-950/60 border border-sky-500/30">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-mono font-medium text-sky-300">
              {latestVal.toFixed(2)} ops/s
            </span>
          </div>

          {transform.zoom > 1 && (
            <button
              onClick={resetTransform}
              title="Reset Zoom"
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 bg-surface-elevated hover:bg-slate-700 border border-surface-border rounded transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{transform.zoom.toFixed(1)}x</span>
            </button>
          )}
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div
        ref={containerRef}
        className="relative w-full h-[280px] overflow-hidden cursor-crosshair select-none"
      >
        <canvas
          ref={canvasRef}
          {...eventHandlers}
          className="absolute inset-0 block w-full h-full"
        />

        {/* HTML Tooltip Overlay on hover */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-20 px-3 py-1.5 text-xs font-mono bg-slate-900/90 text-slate-100 rounded-lg shadow-xl border border-sky-500/40 backdrop-blur-sm -translate-x-1/2 -translate-y-full"
            style={{
              left: `${hoveredPoint.x}px`,
              top: `${hoveredPoint.y - 12}px`,
            }}
          >
            <div className="text-sky-400 font-semibold">{hoveredPoint.value.toFixed(2)} ops</div>
            <div className="text-[10px] text-slate-400">
              {new Date(hoveredPoint.timestamp).toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 mt-1 border-t border-surface-border/40 font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-sky-400 rounded-full inline-block" /> Primary Metric
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-violet-500 rounded-full inline-block" /> Secondary Load
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-rose-500 rounded-full inline-block" /> Anomaly Peak
          </span>
        </div>
        <div className="text-slate-500">
          Scroll wheel to Zoom • Click & drag to Pan • Double-click to Reset
        </div>
      </div>
    </div>
  );
}

export default React.memo(LineChart);
