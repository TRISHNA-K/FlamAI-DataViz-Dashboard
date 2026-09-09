'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useData } from '@/components/providers/DataProvider';
import { useChartRenderer } from '@/hooks/useChartRenderer';
import { setupHiDPICanvas, getHeatmapColor, formatTimeTick, formatTime24h } from '@/lib/canvasUtils';
import { Grid, X, Filter, Activity, Clock, Layers } from 'lucide-react';
import { CategoryType, DataPoint } from '@/lib/types';

const CATEGORIES: CategoryType[] = ['Server A', 'Server B', 'Server C', 'Server D'];

interface HeatmapGridCell {
  xIdx: number;
  yIdx: number;
  category: CategoryType;
  timeStart: number;
  timeEnd: number;
  count: number;
  avgValue: number;
  intensity: number;
}

interface HeatmapProps {
  data?: DataPoint[];
}

function Heatmap({ data }: HeatmapProps) {
  const context = useData();
  const renderedData = data || context.renderedData;
  const { startRenderMeasure, endRenderMeasure, setFilter } = context;
  const {
    canvasRef,
    containerRef,
    dimensions,
    mousePos,
    isHovered,
    eventHandlers,
  } = useChartRenderer();

  const [hoveredCell, setHoveredCell] = useState<{
    cell: HeatmapGridCell;
    x: number;
    y: number;
  } | null>(null);

  const [selectedCell, setSelectedCell] = useState<HeatmapGridCell | null>(null);

  // Ref tracking hovered cell to eliminate 120-240Hz React state update cascades
  const hoveredCellRef = useRef<{
    cell: HeatmapGridCell;
    x: number;
    y: number;
  } | null>(null);

  // Compute Heatmap Matrix (Time Slices x Server Categories)
  const { matrix, maxIntensity, timeSlices, timeSpan, minTime } = useMemo(() => {
    const numCols = 24; // 24 time intervals
    const numRows = CATEGORIES.length;

    if (renderedData.length === 0) {
      return { matrix: [], maxIntensity: 1, timeSlices: 24, timeSpan: 1000, minTime: 0 };
    }

    const minT = renderedData[0].timestamp;
    const maxT = renderedData[renderedData.length - 1].timestamp;
    const span = Math.max(1000, maxT - minT);
    const colDuration = span / numCols;

    // Initialize 2D grid
    const grid: HeatmapGridCell[][] = Array.from({ length: numCols }, (_, c) =>
      Array.from({ length: numRows }, (_, r) => ({
        xIdx: c,
        yIdx: r,
        category: CATEGORIES[r],
        timeStart: minT + c * colDuration,
        timeEnd: minT + (c + 1) * colDuration,
        count: 0,
        avgValue: 0,
        intensity: 0,
      }))
    );

    const sumVals: number[][] = Array.from({ length: numCols }, () =>
      new Array(numRows).fill(0)
    );

    // Populate grid
    for (let i = 0; i < renderedData.length; i++) {
      const pt = renderedData[i];
      const col = Math.min(numCols - 1, Math.max(0, Math.floor((pt.timestamp - minT) / colDuration)));
      const row = CATEGORIES.indexOf(pt.category);
      if (row !== -1) {
        grid[col][row].count++;
        sumVals[col][row] += pt.value;
      }
    }

    let maxCnt = 1;
    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < numRows; r++) {
        const cell = grid[c][r];
        if (cell.count > 0) {
          cell.avgValue = Math.round((sumVals[c][r] / cell.count) * 10) / 10;
          if (cell.count > maxCnt) maxCnt = cell.count;
        }
      }
    }

    // Normalize intensity (combination of count density and average value)
    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < numRows; r++) {
        const cell = grid[c][r];
        if (cell.count > 0) {
          const densityNorm = cell.count / maxCnt;
          const valueNorm = Math.min(1, cell.avgValue / 400);
          cell.intensity = 0.4 * densityNorm + 0.6 * valueNorm;
        }
      }
    }

    return {
      matrix: grid,
      maxIntensity: maxCnt,
      timeSlices: numCols,
      timeSpan: span,
      minTime: minT,
    };
  }, [renderedData]);

  // Main Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    startRenderMeasure();

    const { ctx } = setupHiDPICanvas(canvas, dimensions.width, dimensions.height);
    const { width, height } = dimensions;
    const padding = { top: 20, right: 30, bottom: 35, left: 75 };

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    if (matrix.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting heatmap data...', width / 2, height / 2);
      endRenderMeasure();
      return;
    }

    const numCols = matrix.length;
    const numRows = CATEGORIES.length;
    const cellWidth = plotWidth / numCols;
    const cellHeight = plotHeight / numRows;

    let hovered: { cell: HeatmapGridCell; x: number; y: number } | null = null;

    // Draw Heatmap Cells
    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < numRows; r++) {
        const cell = matrix[c][r];
        const cellX = padding.left + c * cellWidth;
        const cellY = padding.top + r * cellHeight;

        const isThisHovered =
          isHovered &&
          mousePos &&
          mousePos.x >= cellX &&
          mousePos.x < cellX + cellWidth &&
          mousePos.y >= cellY &&
          mousePos.y < cellY + cellHeight;

        if (isThisHovered) {
          hovered = {
            cell,
            x: cellX + cellWidth / 2,
            y: cellY + cellHeight / 2,
          };
        }

        // Fill cell with computed heatmap gradient
        if (cell.count === 0) {
          ctx.fillStyle = 'rgba(30, 41, 59, 0.4)';
        } else {
          ctx.fillStyle = getHeatmapColor(cell.intensity, isThisHovered ? 1.0 : 0.85);
        }

        ctx.fillRect(cellX + 1, cellY + 1, cellWidth - 2, cellHeight - 2);

        // Highlight active cell border on hover
        if (isThisHovered) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(cellX + 1, cellY + 1, cellWidth - 2, cellHeight - 2);
        }
      }
    }

    const prev = hoveredCellRef.current;
    const changed =
      (!prev && hovered) ||
      (prev && !hovered) ||
      (prev && hovered && (prev.cell.xIdx !== hovered.cell.xIdx || prev.cell.yIdx !== hovered.cell.yIdx));

    if (changed) {
      hoveredCellRef.current = hovered;
      setHoveredCell(hovered);
    }

    // Draw Y-Axis Labels (Server Categories)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < numRows; r++) {
      const y = padding.top + (r + 0.5) * cellHeight;
      ctx.fillText(CATEGORIES[r], padding.left - 10, y);
    }

    // Draw X-Axis Labels (Time Slices)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelStep = Math.ceil(numCols / 6);

    for (let c = 0; c < numCols; c += labelStep) {
      const cell = matrix[c][0];
      const x = padding.left + (c + 0.5) * cellWidth;
      ctx.fillText(formatTimeTick(cell.timeStart, timeSpan), x, padding.top + plotHeight + 10);
    }

    endRenderMeasure();
  }, [matrix, dimensions, isHovered, mousePos, timeSpan, startRenderMeasure, endRenderMeasure]);

  const handleCanvasClick = useCallback(() => {
    if (hoveredCellRef.current) {
      setSelectedCell(hoveredCellRef.current.cell);
    }
  }, []);

  return (
    <div className="relative flex flex-col bg-surface border border-surface-border rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-surface-border/60">
        <div className="flex items-center gap-2">
          <Grid className="w-5 h-5 text-accent-amber" />
          <div>
            <h3 className="text-sm font-semibold text-slate-100 tracking-wide">
              Time × Node Density Heatmap
            </h3>
            <p className="text-xs text-slate-400">
              Temporal matrix binning • Activity and latency heat distribution
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-300">
          <span>Cool</span>
          <div className="w-20 h-2.5 rounded bg-gradient-to-r from-blue-600 via-emerald-500 via-amber-400 to-rose-600" />
          <span>Hot</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full h-[280px] overflow-hidden cursor-pointer select-none"
      >
        <canvas
          ref={canvasRef}
          {...eventHandlers}
          onClick={handleCanvasClick}
          className="absolute inset-0 block w-full h-full"
        />

        {hoveredCell && (
          <div
            className="pointer-events-none absolute z-20 px-3 py-2 text-xs font-mono bg-slate-950/95 text-slate-100 rounded-lg shadow-2xl border border-amber-500/50 backdrop-blur-md -translate-x-1/2 -translate-y-full min-w-[160px]"
            style={{
              left: `${hoveredCell.x}px`,
              top: `${hoveredCell.y - 12}px`,
            }}
          >
            <div className="text-amber-400 font-bold border-b border-slate-700 pb-1 mb-1">
              {hoveredCell.cell.category}
            </div>
            <div className="text-white font-medium">
              Mean Value: {hoveredCell.cell.avgValue} ops
            </div>
            <div className="text-[11px] text-slate-300">
              Data Density: {hoveredCell.cell.count} points
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {formatTime24h(hoveredCell.cell.timeStart)} - {formatTime24h(hoveredCell.cell.timeEnd)}
            </div>
          </div>
        )}

        {/* Dynamic Drill-Down Inspection Modal */}
        {selectedCell && (
          <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm rounded-xl flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-amber-500/50 rounded-xl p-4 shadow-2xl max-w-sm w-full font-mono text-xs flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="font-bold text-white text-sm">
                    {selectedCell.category} Drill-Down
                  </span>
                </div>
                <button
                  onClick={() => setSelectedCell(null)}
                  className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-surface border border-surface-border">
                  <div className="text-slate-400">Mean Value</div>
                  <div className="text-base font-bold text-amber-300 mt-0.5">
                    {selectedCell.avgValue} ops
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-surface border border-surface-border">
                  <div className="text-slate-400">Sample Count</div>
                  <div className="text-base font-bold text-white mt-0.5">
                    {selectedCell.count.toLocaleString()} pts
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-surface border border-surface-border">
                  <div className="text-slate-400">Heat Index</div>
                  <div className="text-base font-bold text-rose-400 mt-0.5">
                    {Math.round(selectedCell.intensity * 100)}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-surface border border-surface-border">
                  <div className="text-slate-400">Time Window</div>
                  <div className="text-[10px] text-slate-300 mt-1 font-sans">
                    {formatTime24h(selectedCell.timeStart)} - {formatTime24h(selectedCell.timeEnd)}
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px]">
                <span className="text-slate-400">Status Assessment: </span>
                <span
                  className={`font-semibold ${
                    selectedCell.intensity > 0.75
                      ? 'text-rose-400'
                      : selectedCell.intensity > 0.4
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {selectedCell.intensity > 0.75
                    ? 'High Concurrency Hotspot'
                    : selectedCell.intensity > 0.4
                    ? 'Elevated Traffic'
                    : 'Normal Baseline'}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                <button
                  onClick={() => {
                    setFilter((prev) => ({
                      ...prev,
                      categories: [selectedCell.category],
                    }));
                    setSelectedCell(null);
                  }}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Isolate {selectedCell.category}
                </button>
                <button
                  onClick={() => setSelectedCell(null)}
                  className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 mt-1 border-t border-surface-border/40 font-mono">
        <span className="text-amber-400">● Dynamic Heat Matrix (24×4)</span>
        <span className="text-slate-400">Hover for quick metrics • Click cell for node drill-down</span>
      </div>
    </div>
  );
}

export default React.memo(Heatmap);
