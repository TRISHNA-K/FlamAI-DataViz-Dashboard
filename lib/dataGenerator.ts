import { CategoryType, DataPoint } from './types';

const CATEGORIES: CategoryType[] = ['Server A', 'Server B', 'Server C', 'Server D'];
const REGIONS = ['us-east-1', 'us-west-2', 'eu-central-1', 'ap-southeast-1'];

// Internal state for continuous Brownian drift per category
export interface CategoryState {
  currentValue: number;
  trend: number;
  volatility: number;
}

export function createInitialCategoryStates(): Record<CategoryType, CategoryState> {
  return {
    'Server A': { currentValue: 120, trend: 0.05, volatility: 3.5 },
    'Server B': { currentValue: 85, trend: -0.02, volatility: 2.8 },
    'Server C': { currentValue: 210, trend: 0.08, volatility: 5.2 },
    'Server D': { currentValue: 155, trend: -0.04, volatility: 4.1 },
  };
}

/**
 * Generate a single realistic data point
 */
export function generateNextPoint(
  timestamp: number,
  forcedCategory?: CategoryType,
  states?: Record<CategoryType, CategoryState>
): DataPoint {
  const category = forcedCategory || CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const stateMap = states || createInitialCategoryStates();
  const state = stateMap[category];

  // Brownian motion with mean reversion
  const meanReversion = (150 - state.currentValue) * 0.02;
  const randomWalk = (Math.random() - 0.49) * state.volatility;
  
  // Diurnal sinusoidal oscillation (period ~ 1 hour)
  const timeCycle = Math.sin((timestamp / (1000 * 60 * 15)) * Math.PI) * 15;

  state.currentValue += state.trend + meanReversion + randomWalk;
  
  // Keep bounded
  if (state.currentValue < 20) state.currentValue = 20 + Math.random() * 10;
  if (state.currentValue > 500) state.currentValue = 480 - Math.random() * 10;

  // Occasional anomaly spike (3% chance)
  const isAnomaly = Math.random() < 0.035;
  const anomalyFactor = isAnomaly ? (Math.random() > 0.5 ? 2.2 : 0.3) : 1.0;
  const rawValue = (state.currentValue + timeCycle) * anomalyFactor;
  const value = Math.max(5, Math.round(rawValue * 100) / 100);

  const anomalyScore = isAnomaly 
    ? Math.round((0.75 + Math.random() * 0.25) * 100) / 100 
    : Math.round(Math.random() * 0.3 * 100) / 100;

  const secondaryValue = Math.round(
    Math.max(10, Math.min(100, (value / 5) + (Math.random() - 0.5) * 15)) * 10
  ) / 10;

  return {
    id: `dp-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp,
    value,
    secondaryValue,
    category,
    anomalyScore,
    isAnomaly,
    metadata: {
      cpuLoad: Math.round(Math.min(99, Math.max(5, (value / 500) * 100 + (Math.random() * 10 - 5)))),
      memoryMb: Math.round(1024 + value * 12 + Math.random() * 200),
      latencyMs: Math.round(Math.max(2, (isAnomaly ? 180 : 18) + (Math.random() * 15))),
      region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
    },
  };
}

/**
 * High-performance batch generation for initial datasets (e.g. 10,000 - 100,000 points)
 */
export function generateInitialDataset(
  count: number = 10000,
  timeStepMs: number = 100,
  customStartTimestamp?: number,
  scopedStates?: Record<CategoryType, CategoryState>
): DataPoint[] {
  const states = scopedStates || createInitialCategoryStates();
  const points: DataPoint[] = new Array(count);
  const now = Date.now();
  const startTimestamp =
    customStartTimestamp !== undefined ? customStartTimestamp : now - count * timeStepMs;

  for (let i = 0; i < count; i++) {
    const timestamp = startTimestamp + i * timeStepMs;
    const category = CATEGORIES[i % CATEGORIES.length];
    points[i] = generateNextPoint(timestamp, category, states);
  }

  return points;
}

/**
 * Generate a batch of streaming points for real-time ticks
 */
export function generateStreamBatch(
  count: number = 1,
  currentLatestTimestamp?: number,
  scopedStates?: Record<CategoryType, CategoryState>
): DataPoint[] {
  const states = scopedStates || createInitialCategoryStates();
  const points: DataPoint[] = [];
  const baseTime = currentLatestTimestamp ? currentLatestTimestamp + 100 : Date.now();

  for (let i = 0; i < count; i++) {
    const timestamp = baseTime + i * 100;
    points.push(generateNextPoint(timestamp, undefined, states));
  }

  return points;
}
