'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '@/components/providers/DataProvider';
import { useChartRenderer } from '@/hooks/useChartRenderer';
import { setupHiDPICanvas, createLinearScale, formatTimeTick, CATEGORY_COLORS } from '@/lib/canvasUtils';
import { BarChart3 } from 'lucide-react';
import { CategoryType, DataPoint, AggregationPeriod, AggregatedBucket } from '@/lib/types';

interface BarItem {
  label: string;
  count: number;
  avgValue: number;
  categoryBreakdown: Record<string, number>;
  timestamp?: number;
}

interface BarChartProps {
  data?: DataPoint[];
  aggregation?: AggregationPeriod;
  aggregatedData?: AggregatedBucket[];
}

function BarChart({ data, aggregation: propAggregation, aggregatedData: propAggregatedData }: BarChartProps) {
  const context = useData();
  const renderedData = data || context.renderedData;
  const aggregation = propAggregation || context.aggregation;
  const aggregatedData = propAggregatedData || context.aggregatedData;
  const { startRenderMeasure, endRenderMeasure } = context;
  const {
    canvasRef,
    containerRef,
    dimensions,
    mousePos,
    isHovered,
    eventHandlers,
  } = useChartRenderer();

  const [hoveredBar, setHoveredBar] = useState<{
    item: BarItem;
    x: number;
    y: number;
  } | null>(null);

  // Compute bar data (either from time aggregation or computed bins)
  const barData: BarItem[] = useMemo(() => {
    if (aggregatedData.length > 0) {
      return aggregatedData.slice(-30).map((b) => ({
        label: new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        count: b.count,
        avgValue: Math.round(b.avg * 10) / 10,
        categoryBreakdown: b.categoryCounts,
        timestamp: b.timestamp,
      }));
    }

    // Default: Group into 16 time buckets across the rendered window
    if (renderedData.length === 0) return [];

    const bucketCount = 16;
    const minT = renderedData[0].timestamp;
    const maxT = renderedData[renderedData.length - 1].timestamp;
    const span = maxT - minT || 1;
    const bucketSpan = span / bucketCount;

    const buckets: BarItem[] = Array.from({ length: bucketCount }, (_, i) => {
      const bStart = minT + i * bucketSpan;
      return {
        label: formatTimeTick(bStart, span),
        count: 0,
        avgValue: 0,
        categoryBreakdown: {},
        timestamp: bStart,
      };
    });

    const sumVals = new Array(bucketCount).fill(0);

    for (let i = 0; i < renderedData.length; i++) {
      const pt = renderedData[i];
      const bIdx = Math.min(bucketCount - 1, Math.floor((pt.timestamp - minT) / bucketSpan));
      if (bIdx >= 0 && bIdx < bucketCount) {
        buckets[bIdx].count++;
        sumVals[bIdx] += pt.value;
        buckets[bIdx].categoryBreakdown[pt.category] =
          (buckets[bIdx].categoryBreakdown[pt.category] || 0) + 1;
      }
    }

    for (let i = 0; i < bucketCount; i++) {
      if (buckets[i].count > 0) {
        buckets[i].avgValue = Math.round((sumVals[i] / buckets[i].count) * 10) / 10;
      }
    }

    return buckets;
  }, [aggregatedData, renderedData]);

  // Main Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    startRenderMeasure();

    const { ctx } = setupHiDPICanvas(canvas, dimensions.width, dimensions.height);
    const { width, height } = dimensions;
    const padding = { top: 20, right: 20, bottom: 35, left: 50 };

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    if (barData.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting aggregated data...', width / 2, height / 2);
      endRenderMeasure();
      return;
    }

    // Determine max value for Y-axis (use count or avgValue depending on view)
    let maxVal = 0;
    for (let i = 0; i < barData.length; i++) {
      if (barData[i].avgValue > maxVal) maxVal = barData[i].avgValue;
    }
    maxVal = Math.ceil(maxVal * 1.15) || 100;

    const scaleY = createLinearScale(0, maxVal, padding.top + plotHeight, padding.top);

    // Draw horizontal grid lines
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const val = (i / yTicks) * maxVal;
      const y = scaleY(val);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(val)}`, padding.left - 8, y);
    }
    ctx.setLineDash([]);

    // Draw Bars
    const totalBars = barData.length;
    const slotWidth = plotWidth / totalBars;
    const barWidth = Math.max(3, slotWidth * 0.72);
    const barGap = (slotWidth - barWidth) / 2;

    let hoveredItem: { item: BarItem; x: number; y: number } | null = null;

    for (let i = 0; i < totalBars; i++) {
      const item = barData[i];
      const barX = padding.left + i * slotWidth + barGap;
      const barY = scaleY(item.avgValue);
      const barH = padding.top + plotHeight - barY;

      // Check hover
      const isThisBarHovered =
        isHovered &&
        mousePos &&
        mousePos.x >= barX &&
        mousePos.x <= barX + barWidth &&
        mousePos.y >= padding.top &&
        mousePos.y <= padding.top + plotHeight;

      if (isThisBarHovered) {
        hoveredItem = {
          item,
          x: barX + barWidth / 2,
          y: barY,
        };
      }

      // Bar gradient
      const barGrad = ctx.createLinearGradient(0, barY, 0, padding.top + plotHeight);
      if (isThisBarHovered) {
        barGrad.addColorStop(0, '#38bdf8');
        barGrad.addColorStop(1, 'rgba(56, 189, 248, 0.4)');
      } else {
        barGrad.addColorStop(0, '#10b981'); // Emerald accent
        barGrad.addColorStop(1, 'rgba(16, 185, 129, 0.25)');
      }

      ctx.fillStyle = barGrad;

      // Rounded top rectangle
      const radius = Math.min(4, barWidth / 2);
      ctx.beginPath();
      ctx.moveTo(barX, padding.top + plotHeight);
      ctx.lineTo(barX, barY + radius);
      ctx.quadraticCurveTo(barX, barY, barX + radius, barY);
      ctx.lineTo(barX + barWidth - radius, barY);
      ctx.quadraticCurveTo(barX + barWidth, barY, barX + barWidth, barY + radius);
      ctx.lineTo(barX + barWidth, padding.top + plotHeight);
      ctx.closePath();
      ctx.fill();

      // Top edge highlight
      ctx.strokeStyle = isThisBarHovered ? '#7dd3fc' : '#34d399';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(barX + radius, barY);
      ctx.lineTo(barX + barWidth - radius, barY);
      ctx.stroke();

      // X Label (draw every Nth label to prevent clutter)
      const labelInterval = Math.ceil(totalBars / 6);
      if (i % labelInterval === 0 || i === totalBars - 1) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(item.label, barX + barWidth / 2, padding.top + plotHeight + 10);
      }
    }

    setHoveredBar(hoveredItem);
    endRenderMeasure();
  }, [barData, dimensions, isHovered, mousePos, startRenderMeasure, endRenderMeasure]);

  return (
    <div className="relative flex flex-col bg-surface border border-surface-border rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-surface-border/60">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent-emerald" />
          <div>
            <h3 className="text-sm font-semibold text-slate-100 tracking-wide">
              Aggregated Bucket Histogram
            </h3>
            <p className="text-xs text-slate-400">
              Time period binning ({aggregation.toUpperCase()}) • Mean throughput
            </p>
          </div>
        </div>
        <div className="text-xs font-mono px-2 py-1 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
          {barData.length} Bins Active
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full h-[280px] overflow-hidden cursor-pointer select-none"
      >
        <canvas
          ref={canvasRef}
          {...eventHandlers}
          className="absolute inset-0 block w-full h-full"
        />

        {hoveredBar && (
          <div
            className="pointer-events-none absolute z-20 px-3 py-2 text-xs font-mono bg-slate-900/95 text-slate-100 rounded-lg shadow-xl border border-emerald-500/40 backdrop-blur-sm -translate-x-1/2 -translate-y-full"
            style={{
              left: `${hoveredBar.x}px`,
              top: `${hoveredBar.y - 10}px`,
            }}
          >
            <div className="text-emerald-400 font-bold mb-0.5">
              Avg: {hoveredBar.item.avgValue} ops
            </div>
            <div className="text-[11px] text-slate-300">
              Sample Count: <span className="text-white">{hoveredBar.item.count} pts</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Time: {hoveredBar.item.label}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 mt-1 border-t border-surface-border/40 font-mono">
        <span className="text-emerald-400">● Aggregate Window Average</span>
        <span className="text-slate-500">Hover bars to inspect sample densities</span>
      </div>
    </div>
  );
}

export default React.memo(BarChart);
