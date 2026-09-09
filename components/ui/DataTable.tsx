'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '@/components/providers/DataProvider';
import { useVirtualization } from '@/hooks/useVirtualization';
import { CATEGORY_COLORS, formatTime24h } from '@/lib/canvasUtils';
import { DataPoint } from '@/lib/types';
import {
  Table as TableIcon,
  ArrowUpDown,
  Download,
  Pin,
  AlertCircle,
  Clock,
  Cpu,
  Radio,
} from 'lucide-react';

type SortField = 'timestamp' | 'value' | 'category' | 'anomalyScore';
type SortOrder = 'asc' | 'desc';

interface RowProps {
  item: DataPoint;
  isSelected: boolean;
  onSelect: (item: DataPoint) => void;
  height: number;
}

const VirtualTableRow = React.memo(function VirtualTableRow({
  item,
  isSelected,
  onSelect,
  height,
}: RowProps) {
  const nodeColor = CATEGORY_COLORS[item.category];

  return (
    <div
      onClick={() => onSelect(item)}
      style={{ height: `${height}px` }}
      className={`grid grid-cols-12 px-4 items-center transition-colors cursor-pointer hover:bg-slate-800/60 ${
        isSelected
          ? 'bg-sky-950/40 border-l-2 border-sky-400'
          : item.isAnomaly
          ? 'bg-rose-950/15'
          : ''
      }`}
    >
      <div className="col-span-3 text-slate-400 truncate" suppressHydrationWarning>
        {formatTime24h(item.timestamp)}.
        {Math.floor((item.timestamp % 1000) / 10).toString().padStart(2, '0')}
      </div>

      <div className="col-span-2 flex items-center gap-1.5 truncate">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: nodeColor }} />
        <span className="text-slate-200">{item.category}</span>
      </div>

      <div className="col-span-2 text-right font-semibold text-white">
        {item.value.toFixed(2)}
      </div>

      <div className="col-span-2 text-right text-slate-400">
        {item.metadata?.cpuLoad}% • {Math.round((item.metadata?.memoryMb || 0) / 1024)}GB
      </div>

      <div className="col-span-3 text-right flex items-center justify-end gap-1.5">
        {item.isAnomaly ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <AlertCircle className="w-3 h-3" />
            Spike ({item.anomalyScore})
          </span>
        ) : (
          <span className="text-emerald-400/80 text-[11px]">Normal</span>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.isSelected === next.isSelected &&
    prev.item.value === next.item.value &&
    prev.height === next.height
  );
});

interface DataTableProps {
  data?: DataPoint[];
}

function DataTable({ data }: DataTableProps) {
  const context = useData();
  const filteredData = data || context.filteredData;
  const { streamingConfig } = context;

  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [autoScrollToLatest, setAutoScrollToLatest] = useState(false);
  const [selectedRow, setSelectedRow] = useState<DataPoint | null>(null);

  // Sorting
  const sortedData = useMemo(() => {
    const list = [...filteredData];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'timestamp') cmp = a.timestamp - b.timestamp;
      else if (sortField === 'value') cmp = a.value - b.value;
      else if (sortField === 'category') cmp = a.category.localeCompare(b.category);
      else if (sortField === 'anomalyScore') cmp = a.anomalyScore - b.anomalyScore;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredData, sortField, sortOrder]);

  const ITEM_HEIGHT = 40;
  const CONTAINER_HEIGHT = 380;

  const {
    containerRef,
    onScroll,
    virtualItems,
    topPadding,
    bottomPadding,
    scrollToTop,
    scrollToBottom,
  } = useVirtualization({
    itemCount: sortedData.length,
    itemHeight: ITEM_HEIGHT,
    containerHeight: CONTAINER_HEIGHT,
    overscan: 8,
  });

  // Auto-scroll when new items arrive if auto-scroll is enabled
  useEffect(() => {
    if (autoScrollToLatest) {
      if (sortOrder === 'desc') scrollToTop();
      else scrollToBottom();
    }
  }, [sortedData.length, autoScrollToLatest, sortOrder, scrollToTop, scrollToBottom]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Date', 'Category', 'Value', 'SecondaryValue', 'Anomaly', 'CPU_Load', 'Latency_ms'];
    const rows = sortedData.slice(0, 10000).map((pt) => [
      pt.id,
      pt.timestamp,
      new Date(pt.timestamp).toISOString(),
      pt.category,
      pt.value,
      pt.secondaryValue,
      pt.isAnomaly ? 'TRUE' : 'FALSE',
      pt.metadata?.cpuLoad || '',
      pt.metadata?.latencyMs || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `telemetry_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-lg flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-border/60">
        <div className="flex items-center gap-2">
          <TableIcon className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-slate-100 tracking-wide">
              Virtualized Telemetry Data Table
            </h3>
            <p className="text-xs text-slate-400">
              Custom window virtualization • {sortedData.length.toLocaleString()} rows • 60 FPS scroll
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScrollToLatest(!autoScrollToLatest)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg border transition-all ${
              autoScrollToLatest
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                : 'bg-surface-elevated text-slate-400 border-surface-border hover:text-slate-200'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${autoScrollToLatest ? 'animate-pulse text-sky-400' : ''}`} />
            <span>Pin Latest</span>
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg bg-surface-elevated hover:bg-slate-700 text-slate-300 border border-surface-border transition-colors"
            title="Export top 5,000 rows to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Structure */}
      <div className="border border-surface-border rounded-lg overflow-hidden bg-slate-950/40">
        {/* Fixed Table Header */}
        <div className="grid grid-cols-12 bg-surface-elevated/90 px-4 py-2.5 text-xs font-mono font-medium text-slate-300 border-b border-surface-border select-none">
          <div
            className="col-span-3 flex items-center gap-1.5 cursor-pointer hover:text-white"
            onClick={() => toggleSort('timestamp')}
          >
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Timestamp</span>
            {sortField === 'timestamp' && <ArrowUpDown className="w-3 h-3 text-sky-400" />}
          </div>

          <div
            className="col-span-2 flex items-center gap-1.5 cursor-pointer hover:text-white"
            onClick={() => toggleSort('category')}
          >
            <span>Node</span>
            {sortField === 'category' && <ArrowUpDown className="w-3 h-3 text-sky-400" />}
          </div>

          <div
            className="col-span-2 text-right flex items-center justify-end gap-1.5 cursor-pointer hover:text-white"
            onClick={() => toggleSort('value')}
          >
            <span>Throughput (ops)</span>
            {sortField === 'value' && <ArrowUpDown className="w-3 h-3 text-sky-400" />}
          </div>

          <div className="col-span-2 text-right">CPU / Mem</div>

          <div
            className="col-span-3 text-right flex items-center justify-end gap-1.5 cursor-pointer hover:text-white"
            onClick={() => toggleSort('anomalyScore')}
          >
            <span>Anomaly Status</span>
            {sortField === 'anomalyScore' && <ArrowUpDown className="w-3 h-3 text-sky-400" />}
          </div>
        </div>

        {/* Virtualized Body */}
        <div
          ref={containerRef}
          onScroll={onScroll}
          style={{ height: `${CONTAINER_HEIGHT}px` }}
          className="overflow-y-auto overflow-x-hidden relative divide-y divide-surface-border/40 font-mono text-xs"
        >
          {sortedData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              No matching records found.
            </div>
          ) : (
            <div style={{ paddingTop: `${topPadding}px`, paddingBottom: `${bottomPadding}px` }}>
              {virtualItems.map((vItem) => {
                const item = sortedData[vItem.index];
                if (!item) return null;

                return (
                  <VirtualTableRow
                    key={item.id}
                    item={item}
                    isSelected={selectedRow?.id === item.id}
                    onSelect={(pt) => setSelectedRow(selectedRow?.id === pt.id ? null : pt)}
                    height={ITEM_HEIGHT}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Row Drawer / Quick Inspector */}
      {selectedRow && (
        <div className="p-3 bg-slate-900 border border-sky-500/30 rounded-lg flex flex-wrap items-center justify-between text-xs font-mono text-slate-300 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="text-sky-400 font-bold">Selected ID:</span>
            <span className="text-white">{selectedRow.id}</span>
            <span className="text-slate-500">|</span>
            <span>Region: {selectedRow.metadata?.region}</span>
            <span className="text-slate-500">|</span>
            <span>Latency: {selectedRow.metadata?.latencyMs}ms</span>
          </div>
          <button
            onClick={() => setSelectedRow(null)}
            className="text-slate-400 hover:text-white text-[11px]"
          >
            ✕ Close
          </button>
        </div>
      )}

      {/* Virtualization Stats Footer */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
        <div>
          Showing <span className="text-white">{virtualItems.length}</span> rendered DOM elements
          of <span className="text-sky-400">{sortedData.length.toLocaleString()}</span> items
        </div>
        <div className="text-slate-500">
          Zero DOM bloat • Constant memory footprint
        </div>
      </div>
    </div>
  );
}

export default React.memo(DataTable);
