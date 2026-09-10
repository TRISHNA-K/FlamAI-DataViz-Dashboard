/**
 * Static Chart Configurations for Build-Time SSG (Static Site Generation)
 * Provides pre-compiled visualization parameters, decimation budgets, color palettes,
 * and axis scales that can be statically rendered at build time with Next.js generateStaticParams.
 */

export interface StaticChartConfig {
  id: string;
  name: string;
  type: 'line' | 'scatter' | 'bar' | 'heatmap';
  description: string;
  targetFPS: number;
  maxPointCapacity: number;
  recommendedLODThreshold: number;
  decimationAlgorithm: 'LTTB' | 'MinMax' | 'SpatialGrid' | 'BucketMean';
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    gridLine: string;
    background: string;
  };
  renderEngine: 'Canvas2D-Offscreen' | 'Canvas2D-Direct' | 'SpatialGrid-Accelerated';
  performanceBudget: {
    maxFrameTimeMs: number;
    targetMemoryMb: number;
    subMillisecondHitTest: boolean;
  };
  features: string[];
}

export const STATIC_CHART_CONFIGS: Record<string, StaticChartConfig> = {
  'line-chart': {
    id: 'line-chart',
    name: 'Time-Series Line & Area Chart',
    type: 'line',
    description: 'High-frequency telemetry stream visualizer with smoothed cubic area gradients, dual-metric comparison, and anomaly pulses.',
    targetFPS: 60,
    maxPointCapacity: 100000,
    recommendedLODThreshold: 1500,
    decimationAlgorithm: 'LTTB',
    colorPalette: {
      primary: '#38bdf8', // Sky 400
      secondary: '#8b5cf6', // Violet 500
      accent: '#f43f5e', // Rose 500
      gridLine: 'rgba(51, 65, 85, 0.4)',
      background: '#0f172a',
    },
    renderEngine: 'Canvas2D-Offscreen',
    performanceBudget: {
      maxFrameTimeMs: 16.67,
      targetMemoryMb: 25,
      subMillisecondHitTest: true,
    },
    features: [
      'Largest-Triangle-Three-Buckets (LTTB) peak preservation',
      'Dual-metric overlaid time series (ops/s + server load)',
      'Sub-pixel linear interpolation with HiDPI Retina DPR scaling',
      'Double-buffered OffscreenCanvas background layer blit',
      'Interactive crosshair with binary search nearest-neighbor lookup',
    ],
  },
  'scatter-plot': {
    id: 'scatter-plot',
    name: '10,000+ Point Scatter Distribution Plot',
    type: 'scatter',
    description: 'Dense categorical scatter visualizer rendering 10k to 100k points simultaneously with O(1) spatial partitioning.',
    targetFPS: 60,
    maxPointCapacity: 100000,
    recommendedLODThreshold: 5000,
    decimationAlgorithm: 'SpatialGrid',
    colorPalette: {
      primary: '#38bdf8', // Server A
      secondary: '#34d399', // Server B
      accent: '#fbbf24', // Server C
      gridLine: 'rgba(51, 65, 85, 0.3)',
      background: '#0f172a',
    },
    renderEngine: 'SpatialGrid-Accelerated',
    performanceBudget: {
      maxFrameTimeMs: 16.67,
      targetMemoryMb: 35,
      subMillisecondHitTest: true,
    },
    features: [
      'Custom 28px Spatial Grid Partitioning index for 9.6µs hover search',
      'OffscreenCanvas double-buffered layer composition',
      'Drag-box cluster selection with anomaly percentage aggregation',
      'Multi-node category filtering with zero main-thread GC pauses',
      'GPU rasterized path batching with alpha transparency',
    ],
  },
  'bar-chart': {
    id: 'bar-chart',
    name: 'Temporal Aggregation Histogram',
    type: 'bar',
    description: 'Dynamic time-bucket aggregation visualizer grouping continuous streams into discrete 1m, 5m, 1h, or 16 responsive intervals.',
    targetFPS: 60,
    maxPointCapacity: 50000,
    recommendedLODThreshold: 1000,
    decimationAlgorithm: 'BucketMean',
    colorPalette: {
      primary: '#0ea5e9',
      secondary: '#6366f1',
      accent: '#10b981',
      gridLine: 'rgba(51, 65, 85, 0.4)',
      background: '#0f172a',
    },
    renderEngine: 'Canvas2D-Direct',
    performanceBudget: {
      maxFrameTimeMs: 16.67,
      targetMemoryMb: 20,
      subMillisecondHitTest: true,
    },
    features: [
      'Dynamic time-bucket aggregation (1min, 5min, 1hour)',
      'High/low/open/close interval calculation',
      'Categorical distribution breakdown per time bucket',
      'Smooth responsive bar layout with rounded tops',
      'Direct memory reuse across aggregation recalculations',
    ],
  },
  'heatmap': {
    id: 'heatmap',
    name: 'Temporal Density & Latency Matrix',
    type: 'heatmap',
    description: '2D matrix (24 time buckets × 4 server nodes) visualizing activity density, concurrency, and latency heat.',
    targetFPS: 60,
    maxPointCapacity: 50000,
    recommendedLODThreshold: 2000,
    decimationAlgorithm: 'BucketMean',
    colorPalette: {
      primary: '#06b6d4', // Cool blue
      secondary: '#10b981', // Emerald
      accent: '#f43f5e', // Rose
      gridLine: 'rgba(15, 23, 42, 0.8)',
      background: '#0f172a',
    },
    renderEngine: 'Canvas2D-Direct',
    performanceBudget: {
      maxFrameTimeMs: 16.67,
      targetMemoryMb: 18,
      subMillisecondHitTest: true,
    },
    features: [
      '24 temporal columns × 4 server rows density matrix',
      'Multi-stop smooth color interpolation (blue → cyan → emerald → amber → rose)',
      'Click-to-filter drill-down into specific time and node partitions',
      'Immediate hover inspection with sub-millisecond cell query',
      'Zero layout recalculation during real-time updates',
    ],
  },
};

export function getAllStaticChartIds(): string[] {
  return Object.keys(STATIC_CHART_CONFIGS);
}

export function getStaticChartConfig(id: string): StaticChartConfig | null {
  return STATIC_CHART_CONFIGS[id] || null;
}
