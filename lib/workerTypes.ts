/**
 * Strict TypeScript Type Contracts for Background Web Worker Communication
 */

import { AggregationPeriod, DataPoint } from '@/lib/types';

export interface StatisticalSummary {
  count: number;
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
  anomalyRatio: number;
  calculatedInMs: number;
}

export type WorkerInboundMessage =
  | {
      type: 'DOWNSAMPLE_LTTB';
      payload: { data: DataPoint[]; threshold: number; reqId: number | string };
    }
  | {
      type: 'DOWNSAMPLE_MINMAX';
      payload: { data: DataPoint[]; threshold: number; reqId: number | string };
    }
  | {
      type: 'AGGREGATE_TIME';
      payload: { data: DataPoint[]; period: AggregationPeriod; reqId: number | string };
    }
  | {
      type: 'GENERATE_BATCH';
      payload: { count: number; startTimestamp: number; timeStepMs: number };
    }
  | {
      type: 'COMPUTE_STATISTICS';
      payload: { data: DataPoint[]; reqId: number | string };
    }
  | {
      type: 'BUILD_SPATIAL_PARTITIONS';
      payload: {
        data: DataPoint[];
        cellSize: number;
        bounds: { minX: number; maxX: number; minY: number; maxY: number };
        reqId: number | string;
      };
    };

export type WorkerOutboundMessage =
  | {
      type: 'DOWNSAMPLE_LTTB_RESULT';
      payload: DataPoint[];
      reqId: number | string;
    }
  | {
      type: 'DOWNSAMPLE_MINMAX_RESULT';
      payload: DataPoint[];
      reqId: number | string;
    }
  | {
      type: 'AGGREGATE_TIME_RESULT';
      payload: any[];
      reqId: number | string;
    }
  | {
      type: 'GENERATE_BATCH_RESULT';
      payload: DataPoint[];
    }
  | {
      type: 'COMPUTE_STATISTICS_RESULT';
      payload: StatisticalSummary;
      reqId: number | string;
    }
  | {
      type: 'BUILD_SPATIAL_PARTITIONS_RESULT';
      payload: { cellCount: number; maxCellDensity: number; avgCellDensity: number };
      reqId: number | string;
    };
