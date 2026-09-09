export type CategoryType = 'Server A' | 'Server B' | 'Server C' | 'Server D';

export interface DataPoint {
  id: string;
  timestamp: number;
  value: number;
  secondaryValue: number;
  category: CategoryType;
  anomalyScore: number;
  isAnomaly: boolean;
  metadata?: {
    cpuLoad?: number;
    memoryMb?: number;
    latencyMs?: number;
    region?: string;
  };
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'scatter' | 'heatmap';
  dataKey: string;
  color: string;
  visible: boolean;
  title?: string;
}

export interface PerformanceMetrics {
  fps: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  frameTime: number; // ms per frame
  memoryUsage: number; // MB used heap
  heapLimit: number; // MB heap limit
  renderTime: number; // ms
  dataProcessingTime: number; // ms
  totalPoints: number;
  renderedPoints: number;
  droppedFrames: number;
  lastUpdated: number;
}

export type TimeRangePreset = '1m' | '5m' | '15m' | '1h' | 'all' | 'custom';

export interface TimeRange {
  preset: TimeRangePreset;
  start: number;
  end: number;
}

export type AggregationPeriod = 'raw' | '1min' | '5min' | '1hour';

export interface FilterState {
  categories: CategoryType[];
  minValue: number;
  maxValue: number;
  showAnomaliesOnly: boolean;
  searchQuery: string;
}

export interface StreamingConfig {
  intervalMs: number; // e.g., 50, 100, 250, 500, 1000
  batchSize: number; // points per tick
  targetPointCount: number; // 1000, 5000, 10000, 50000, 100000
  isRunning: boolean;
  stressMode: boolean;
}

export interface ViewportTransform {
  scaleX: number;
  scaleY: number;
  panX: number;
  panY: number;
}

export interface HeatmapCell {
  xBin: number;
  yBin: number;
  xLabel: string;
  yLabel: string;
  count: number;
  avgValue: number;
}

export interface AggregatedBucket {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  avg: number;
  count: number;
  categoryCounts: Record<string, number>;
}
