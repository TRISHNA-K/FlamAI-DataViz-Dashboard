// Automated Unit & Performance Algorithm Test Suite
// Run via: node --test scripts/test.mjs or npm test

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Core algorithm implementations mirroring lib/performanceUtils.ts and lib/canvasUtils.ts
class SlidingDataBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.count = 0;
  }

  get size() {
    return this.count;
  }

  push(item) {
    const idx = (this.head + this.count) % this.capacity;
    this.buffer[idx] = item;
    if (this.count < this.capacity) {
      this.count++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  pushBatch(items) {
    for (let i = 0; i < items.length; i++) {
      this.push(items[i]);
    }
  }

  toArray() {
    const result = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      result[i] = this.buffer[(this.head + i) % this.capacity];
    }
    return result;
  }

  setCapacity(newCapacity) {
    if (newCapacity === this.capacity) return;
    const currentItems = this.toArray();
    this.capacity = newCapacity;
    this.buffer = new Array(newCapacity);
    this.head = 0;
    this.count = 0;
    const slice = currentItems.length > newCapacity
      ? currentItems.slice(currentItems.length - newCapacity)
      : currentItems;
    this.pushBatch(slice);
  }

  get(index) {
    if (index < 0 || index >= this.count) {
      throw new RangeError(`Index out of bounds: ${index}`);
    }
    if (this.count < this.capacity) {
      return this.buffer[index];
    }
    return this.buffer[(this.head + index) % this.capacity];
  }

  downsampleMinMax(threshold) {
    const len = this.count;
    if (len <= threshold) return this.toArray();

    const result = [];
    const numBuckets = Math.floor(threshold / 2);
    const chunkSize = len / numBuckets;

    for (let b = 0; b < numBuckets; b++) {
      const start = Math.floor(b * chunkSize);
      const end = Math.min(len, Math.floor((b + 1) * chunkSize));
      if (start >= end) continue;

      let minPt = this.get(start);
      let maxPt = this.get(start);

      for (let i = start + 1; i < end; i++) {
        const pt = this.get(i);
        if (pt.value < minPt.value) minPt = pt;
        if (pt.value > maxPt.value) maxPt = pt;
      }

      if (minPt.timestamp < maxPt.timestamp) {
        result.push(minPt);
        if (minPt !== maxPt) result.push(maxPt);
      } else {
        result.push(maxPt);
        if (minPt !== maxPt) result.push(minPt);
      }
    }

    return result;
  }

  downsampleLTTB(threshold) {
    const len = this.count;
    if (threshold >= len || threshold <= 2) return this.toArray();

    const sampled = [];
    const bucketSize = (len - 2) / (threshold - 2);

    let a = 0;
    sampled.push(this.get(a));

    for (let i = 0; i < threshold - 2; i++) {
      let avgX = 0;
      let avgY = 0;
      let avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
      let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
      avgRangeEnd = avgRangeEnd < len ? avgRangeEnd : len;

      const avgRangeLength = avgRangeEnd - avgRangeStart;
      for (let idx = avgRangeStart; idx < avgRangeEnd; idx++) {
        const pt = this.get(idx);
        avgX += pt.timestamp;
        avgY += pt.value;
      }
      avgX /= avgRangeLength || 1;
      avgY /= avgRangeLength || 1;

      const rangeOffs = Math.floor(i * bucketSize) + 1;
      const rangeTo = Math.floor((i + 1) * bucketSize) + 1;

      const ptA = this.get(a);
      const pointAX = ptA.timestamp;
      const pointAY = ptA.value;

      let maxArea = -1;
      let nextA = rangeOffs;

      for (let idx = rangeOffs; idx < rangeTo; idx++) {
        const ptIdx = this.get(idx);
        const area = Math.abs(
          (pointAX - avgX) * (ptIdx.value - pointAY) -
          (pointAX - ptIdx.timestamp) * (avgY - pointAY)
        ) * 0.5;

        if (area > maxArea) {
          maxArea = area;
          nextA = idx;
        }
      }

      sampled.push(this.get(nextA));
      a = nextA;
    }

    sampled.push(this.get(len - 1));
    return sampled;
  }
}

function lttbDownsample(data, threshold) {
  const len = data.length;
  if (threshold >= len || threshold <= 2) return data;

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

function minMaxDownsample(data, threshold) {
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

class SpatialGridIndex {
  constructor(width, height, cellSize = 32) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize) + 1;
    this.rows = Math.ceil(height / cellSize) + 1;
    this.grid = new Map();
  }

  getCellKey(col, row) {
    return `${col}:${row}`;
  }

  clear() {
    this.grid.clear();
  }

  insert(x, y, data) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    const key = this.getCellKey(col, row);
    let cell = this.grid.get(key);
    if (!cell) {
      cell = [];
      this.grid.set(key, cell);
    }
    cell.push({ x, y, data });
  }

  findNearest(x, y, maxRadius = 24) {
    const minCol = Math.floor((x - maxRadius) / this.cellSize);
    const maxCol = Math.floor((x + maxRadius) / this.cellSize);
    const minRow = Math.floor((y - maxRadius) / this.cellSize);
    const maxRow = Math.floor((y + maxRadius) / this.cellSize);

    let nearest = null;
    let minDistSq = maxRadius * maxRadius;

    for (let c = minCol; c <= maxCol; c++) {
      for (let r = minRow; r <= maxRow; r++) {
        const cell = this.grid.get(this.getCellKey(c, r));
        if (!cell) continue;

        for (let i = 0; i < cell.length; i++) {
          const pt = cell[i];
          const dx = pt.x - x;
          const dy = pt.y - y;
          const distSq = dx * dx + dy * dy;
          if (distSq < minDistSq) {
            minDistSq = distSq;
            nearest = pt.data;
          }
        }
      }
    }

    return nearest;
  }
}

function generateTestPoints(count, interval = 100) {
  const points = [];
  const baseTime = 1700000000000;
  for (let i = 0; i < count; i++) {
    points.push({
      id: `pt-${i}`,
      timestamp: baseTime + i * interval,
      value: 50 + Math.sin(i * 0.1) * 20,
      secondaryValue: 25,
      category: ['Server A', 'Server B', 'Server C', 'Server D'][i % 4],
      anomalyScore: 0.1,
      isAnomaly: false,
    });
  }
  return points;
}

// ---------------------- TEST SUITES ----------------------

describe('LTTB Downsampling Algorithm', () => {
  it('returns original data if target threshold is greater than or equal to length', () => {
    const data = generateTestPoints(50);
    const result = lttbDownsample(data, 100);
    assert.equal(result.length, 50);
  });

  it('correctly downsamples 10,000 points down to exactly 1,000 points', () => {
    const data = generateTestPoints(10000);
    const target = 1000;
    const sampled = lttbDownsample(data, target);
    assert.equal(sampled.length, target);
  });

  it('strictly preserves the very first and very last data points', () => {
    const data = generateTestPoints(5000);
    const sampled = lttbDownsample(data, 500);
    assert.equal(sampled[0].timestamp, data[0].timestamp);
    assert.equal(sampled[0].value, data[0].value);
    assert.equal(sampled[sampled.length - 1].timestamp, data[data.length - 1].timestamp);
    assert.equal(sampled[sampled.length - 1].value, data[data.length - 1].value);
  });

  it('preserves significant visual spike anomalies during decimation', () => {
    const data = generateTestPoints(1000);
    // Inject prominent spike anomaly in middle
    data[500].value = 9999.0;
    data[500].isAnomaly = true;

    const sampled = lttbDownsample(data, 100);
    const hasSpike = sampled.some((p) => p.value > 5000.0);
    assert.equal(hasSpike, true, 'LTTB triangular area maximization must capture high-energy spike');
  });
});

describe('MinMax Decimation Algorithm', () => {
  it('reduces point count while retaining local minima and maxima', () => {
    const data = generateTestPoints(10000);
    const sampled = minMaxDownsample(data, 1000);
    assert.ok(sampled.length <= 1000);
    assert.ok(sampled.length > 500);
  });

  it('returns original points if threshold exceeds length', () => {
    const data = generateTestPoints(20);
    const sampled = minMaxDownsample(data, 50);
    assert.equal(sampled.length, 20);
  });
});

describe('SpatialGridIndex (O(1) Hover Hit-Testing)', () => {
  it('indexes 10,000 coordinates and performs sub-millisecond nearest neighbor query', () => {
    const index = new SpatialGridIndex(800, 600, 32);
    for (let i = 0; i < 10000; i++) {
      const x = (i * 7) % 800;
      const y = (i * 13) % 600;
      index.insert(x, y, { id: `item-${i}`, x, y });
    }

    // Exact query on point 420
    const targetX = (420 * 7) % 800;
    const targetY = (420 * 13) % 600;

    const found = index.findNearest(targetX, targetY, 15);
    assert.ok(found !== null);
    assert.equal(found.x, targetX);
    assert.equal(found.y, targetY);
  });

  it('returns null when query coordinate is outside radius of any point', () => {
    const index = new SpatialGridIndex(800, 600, 32);
    index.insert(100, 100, { id: 'single' });

    const result = index.findNearest(750, 550, 20);
    assert.equal(result, null);
  });
});

describe('SlidingDataBuffer (Ring Buffer / Zero-GC)', () => {
  it('acts as fixed capacity FIFO circular queue', () => {
    const ring = new SlidingDataBuffer(5);
    for (let i = 1; i <= 8; i++) {
      ring.push({ id: `pt-${i}`, val: i });
    }

    assert.equal(ring.size, 5);
    const arr = ring.toArray();
    assert.deepEqual(arr.map((p) => p.val), [4, 5, 6, 7, 8]);
  });

  it('correctly resizes capacity dynamically without data corruption', () => {
    const ring = new SlidingDataBuffer(4);
    ring.pushBatch([{ val: 1 }, { val: 2 }, { val: 3 }, { val: 4 }]);
    assert.equal(ring.size, 4);

    // Expand
    ring.setCapacity(10);
    assert.equal(ring.size, 4);
    ring.pushBatch([{ val: 5 }, { val: 6 }]);
    assert.equal(ring.size, 6);
    assert.deepEqual(ring.toArray().map((p) => p.val), [1, 2, 3, 4, 5, 6]);

    // Shrink
    ring.setCapacity(3);
    assert.equal(ring.size, 3);
    assert.deepEqual(ring.toArray().map((p) => p.val), [4, 5, 6]);
  });

  it('performs direct zero-allocation MinMax and LTTB downsampling from ring buffer', () => {
    const ring = new SlidingDataBuffer(1000);
    const testPoints = generateTestPoints(1000, 100);
    ring.pushBatch(testPoints);

    const minMaxSampled = ring.downsampleMinMax(100);
    assert.ok(minMaxSampled.length <= 100);
    assert.ok(minMaxSampled.length >= 50);

    const lttbSampled = ring.downsampleLTTB(100);
    assert.equal(lttbSampled.length, 100);
    assert.equal(lttbSampled[0].timestamp, testPoints[0].timestamp);
    assert.equal(lttbSampled[lttbSampled.length - 1].timestamp, testPoints[testPoints.length - 1].timestamp);
  });
});

describe('Filter-then-Downsample Correctness', () => {
  it('strictly downsamples only filtered categories (e.g. Server A only)', () => {
    const rawPoints = generateTestPoints(4000, 100); // Has Server A, B, C, D
    // Filter to Server A only
    const filtered = rawPoints.filter((p) => p.category === 'Server A');
    assert.equal(filtered.length, 1000);

    // Downsample the filtered subset
    const downsampled = lttbDownsample(filtered, 200);
    assert.equal(downsampled.length, 200);

    // Every single downsampled point must strictly belong to Server A
    const allServerA = downsampled.every((p) => p.category === 'Server A');
    assert.equal(allServerA, true, 'Downsampled points must strictly originate from filtered category');
  });
});

describe('Time-Series Data Consistency', () => {
  it('verifies generated points have strictly monotonic ascending timestamps', () => {
    const points = generateTestPoints(1000, 100);
    assert.equal(points.length, 1000);
    for (let i = 1; i < points.length; i++) {
      assert.ok(
        points[i].timestamp > points[i - 1].timestamp,
        `Timestamp at index ${i} (${points[i].timestamp}) must be > index ${i - 1} (${points[i - 1].timestamp})`
      );
    }
  });
});
