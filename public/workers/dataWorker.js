// High-Performance Data Processing Worker
// Handles LTTB downsampling, time-bucket aggregation, and synthetic point generation off-thread.

self.onmessage = function (e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'DOWNSAMPLE_LTTB': {
      const { data, threshold } = payload;
      const result = lttb(data, threshold);
      self.postMessage({ type: 'DOWNSAMPLE_LTTB_RESULT', payload: result });
      break;
    }

    case 'AGGREGATE_TIME': {
      const { data, period } = payload;
      const result = aggregate(data, period);
      self.postMessage({ type: 'AGGREGATE_TIME_RESULT', payload: result });
      break;
    }

    case 'GENERATE_BATCH': {
      const { count, startTimestamp, timeStepMs } = payload;
      const points = generatePoints(count, startTimestamp, timeStepMs);
      self.postMessage({ type: 'GENERATE_BATCH_RESULT', payload: points });
      break;
    }

    default:
      break;
  }
};

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
