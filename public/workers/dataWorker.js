// High-Performance Telemetry Data Processing Worker
// Handles LTTB downsampling, MinMax decimation, statistical analysis,
// spatial partitioning, and synthetic point generation entirely off the main thread.

self.onmessage = function (e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'DOWNSAMPLE_LTTB': {
      const p = payload || e.data;
      const data = p.data || [];
      const threshold = p.threshold || p.targetPoints || 1500;
      const reqId = p.reqId;
      const result = lttb(data, threshold);
      self.postMessage({ type: 'DOWNSAMPLE_LTTB_RESULT', payload: result, reqId });
      self.postMessage({ type: 'DOWNSAMPLE_RESULT', payload: result, reqId });
      break;
    }

    case 'DOWNSAMPLE_MINMAX': {
      const p = payload || e.data;
      const data = p.data || [];
      const threshold = p.threshold || p.targetPoints || 1500;
      const reqId = p.reqId;
      const result = minMax(data, threshold);
      self.postMessage({ type: 'DOWNSAMPLE_MINMAX_RESULT', payload: result, reqId });
      self.postMessage({ type: 'DOWNSAMPLE_RESULT', payload: result, reqId });
      break;
    }

    case 'AGGREGATE_TIME': {
      const { data, period, reqId } = payload;
      const result = aggregate(data, period);
      self.postMessage({ type: 'AGGREGATE_TIME_RESULT', payload: result, reqId });
      break;
    }

    case 'GENERATE_BATCH': {
      const { count, startTimestamp, timeStepMs } = payload;
      const points = generatePoints(count, startTimestamp, timeStepMs);
      self.postMessage({ type: 'GENERATE_BATCH_RESULT', payload: points });
      break;
    }

    case 'COMPUTE_STATISTICS': {
      const { data, reqId } = payload;
      const stats = computeStatistics(data);
      self.postMessage({ type: 'COMPUTE_STATISTICS_RESULT', payload: stats, reqId });
      break;
    }

    case 'BUILD_SPATIAL_PARTITIONS': {
      const { data, cellSize, bounds, reqId } = payload;
      const partitions = buildSpatialPartitions(data, cellSize, bounds);
      self.postMessage({ type: 'BUILD_SPATIAL_PARTITIONS_RESULT', payload: partitions, reqId });
      break;
    }

    default:
      break;
  }
};

/**
 * Off-thread computation of telemetry statistics & percentiles (P50, P95, P99).
 * Avoids main thread sorting and O(N) reductions on 10,000-100,000 items.
 */
function computeStatistics(data) {
  const start = performance.now();
  const len = data.length;
  if (len === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      variance: 0,
      min: 0,
      max: 0,
      p95: 0,
      p99: 0,
      anomalyRatio: 0,
      calculatedInMs: 0,
    };
  }

  let sum = 0;
  let min = data[0].value;
  let max = data[0].value;
  let anomalyCount = 0;

  const values = new Float64Array(len);

  for (let i = 0; i < len; i++) {
    const val = data[i].value;
    values[i] = val;
    sum += val;
    if (val < min) min = val;
    if (val > max) max = val;
    if (data[i].isAnomaly) anomalyCount++;
  }

  const mean = sum / len;

  // Variance & standard deviation pass
  let varianceSum = 0;
  for (let i = 0; i < len; i++) {
    const diff = values[i] - mean;
    varianceSum += diff * diff;
  }
  const variance = varianceSum / len;
  const stdDev = Math.sqrt(variance);

  // Sort values for exact percentiles
  values.sort();
  const median = values[Math.floor(len * 0.5)];
  const p95 = values[Math.floor(len * 0.95)];
  const p99 = values[Math.floor(len * 0.99)];

  const calculatedInMs = Math.max(0.1, performance.now() - start);

  return {
    count: len,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    p95: Math.round(p95 * 100) / 100,
    p99: Math.round(p99 * 100) / 100,
    anomalyRatio: Math.round((anomalyCount / len) * 10000) / 100,
    calculatedInMs: Math.round(calculatedInMs * 100) / 100,
  };
}

/**
 * Off-thread Spatial Grid Partition Analyzer
 */
function buildSpatialPartitions(data, cellSize, bounds) {
  const grid = new Map();
  const len = data.length;
  const cSize = cellSize || 28;

  for (let i = 0; i < len; i++) {
    const pt = data[i];
    const cellX = Math.floor(pt.timestamp / cSize);
    const cellY = Math.floor(pt.value / cSize);
    const key = `${cellX}:${cellY}`;
    grid.set(key, (grid.get(key) || 0) + 1);
  }

  let maxDensity = 0;
  let totalDensity = 0;
  for (const count of grid.values()) {
    if (count > maxDensity) maxDensity = count;
    totalDensity += count;
  }

  return {
    cellCount: grid.size,
    maxCellDensity: maxDensity,
    avgCellDensity: grid.size > 0 ? Math.round((totalDensity / grid.size) * 10) / 10 : 0,
  };
}

function minMax(data, threshold) {
  const len = data.length;
  if (threshold >= len || threshold <= 4) return data;

  const sampled = [];
  const numBuckets = Math.floor(threshold / 2);
  const bucketSize = Math.floor(len / numBuckets);

  for (let b = 0; b < numBuckets; b++) {
    const start = b * bucketSize;
    const end = b === numBuckets - 1 ? len : start + bucketSize;

    let minIdx = start;
    let maxIdx = start;

    for (let i = start + 1; i < end; i++) {
      if (data[i].value < data[minIdx].value) minIdx = i;
      if (data[i].value > data[maxIdx].value) maxIdx = i;
    }

    if (minIdx < maxIdx) {
      sampled.push(data[minIdx], data[maxIdx]);
    } else if (minIdx > maxIdx) {
      sampled.push(data[maxIdx], data[minIdx]);
    } else {
      sampled.push(data[minIdx]);
    }
  }

  return sampled;
}

function lttb(data, threshold) {
  const len = data.length;
  if (threshold >= len || threshold === 0) return data;

  const sampled = [];
  const bucketSize = (len - 2) / (threshold - 2);

  let a = 0;
  sampled.push(data[a]);

  for (let i = 0; i < threshold - 2; i++) {
    let avgX = 0;
    let avgY = 0;
    let avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    avgRangeEnd = avgRangeEnd < len ? avgRangeEnd : len;

    const avgRangeLength = avgRangeEnd - avgRangeStart;
    for (let idx = avgRangeStart; idx < avgRangeEnd; idx++) {
      avgX += data[idx].timestamp;
      avgY += data[idx].value;
    }
    avgX /= avgRangeLength || 1;
    avgY /= avgRangeLength || 1;

    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1;

    const pointAX = data[a].timestamp;
    const pointAY = data[a].value;

    let maxArea = -1;
    let nextA = rangeOffs;

    for (let idx = rangeOffs; idx < rangeTo; idx++) {
      const area = Math.abs(
        (pointAX - avgX) * (data[idx].value - pointAY) -
        (pointAX - data[idx].timestamp) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        nextA = idx;
      }
    }

    sampled.push(data[nextA]);
    a = nextA;
  }

  sampled.push(data[len - 1]);
  return sampled;
}

function aggregate(data, period) {
  let intervalMs = 60 * 1000;
  if (period === '5min') intervalMs = 5 * 60 * 1000;
  if (period === '1hour') intervalMs = 60 * 60 * 1000;

  const buckets = {};
  for (let i = 0; i < data.length; i++) {
    const pt = data[i];
    const bKey = Math.floor(pt.timestamp / intervalMs) * intervalMs;
    if (!buckets[bKey]) {
      buckets[bKey] = {
        timestamp: bKey,
        open: pt.value,
        high: pt.value,
        low: pt.value,
        close: pt.value,
        avg: pt.value,
        count: 1,
        categoryCounts: { [pt.category]: 1 },
      };
    } else {
      const b = buckets[bKey];
      b.high = Math.max(b.high, pt.value);
      b.low = Math.min(b.low, pt.value);
      b.close = pt.value;
      b.avg = (b.avg * b.count + pt.value) / (b.count + 1);
      b.count += 1;
      b.categoryCounts[pt.category] = (b.categoryCounts[pt.category] || 0) + 1;
    }
  }

  return Object.values(buckets).sort((a, b) => a.timestamp - b.timestamp);
}

const CATEGORIES = ['Server A', 'Server B', 'Server C', 'Server D'];
const REGIONS = ['us-east-1', 'us-west-2', 'eu-central-1', 'ap-southeast-1'];
const catValues = {
  'Server A': 120,
  'Server B': 85,
  'Server C': 210,
  'Server D': 155,
};

function generatePoints(count, startTimestamp, timeStepMs) {
  const points = new Array(count);
  for (let i = 0; i < count; i++) {
    const timestamp = startTimestamp + i * timeStepMs;
    const cat = CATEGORIES[i % CATEGORIES.length];
    const walk = (Math.random() - 0.49) * 3.5;
    catValues[cat] = Math.max(20, Math.min(480, catValues[cat] + walk));
    const isAnomaly = Math.random() < 0.035;
    const value = Math.round((catValues[cat] * (isAnomaly ? 2.2 : 1.0)) * 100) / 100;
    
    points[i] = {
      id: `w-${timestamp}-${i}`,
      timestamp,
      value,
      secondaryValue: Math.round((value / 5 + (Math.random() - 0.5) * 10) * 10) / 10,
      category: cat,
      anomalyScore: isAnomaly ? 0.85 : 0.1,
      isAnomaly,
      metadata: {
        cpuLoad: Math.round(Math.min(99, (value / 500) * 100)),
        memoryMb: Math.round(1024 + value * 10),
        latencyMs: isAnomaly ? 150 : 15,
        region: REGIONS[i % REGIONS.length],
      },
    };
  }
  return points;
}
