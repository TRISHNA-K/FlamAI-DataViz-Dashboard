// Standalone Reproducible Benchmark Suite
// Run via: node scripts/benchmark.mjs

import { performance } from 'perf_hooks';

// Inline implementations of core algorithms for Node.js benchmarking
function generatePoints(count, timeStepMs = 100) {
  const points = new Array(count);
  const startTimestamp = Date.now() - count * timeStepMs;
  const categories = ['Server A', 'Server B', 'Server C', 'Server D'];
  let val = 150;

  for (let i = 0; i < count; i++) {
    val += (Math.random() - 0.49) * 3.5;
    if (val < 20) val = 25;
    if (val > 480) val = 470;
    const isAnomaly = Math.random() < 0.035;

    points[i] = {
      id: `dp-${i}`,
      timestamp: startTimestamp + i * timeStepMs,
      value: Math.round(val * (isAnomaly ? 2.2 : 1.0) * 100) / 100,
      secondaryValue: Math.round((val / 5) * 10) / 10,
      category: categories[i % 4],
      anomalyScore: isAnomaly ? 0.85 : 0.1,
      isAnomaly,
    };
  }
  return points;
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

function minMaxDownsample(data, bucketCount) {
  const len = data.length;
  if (len <= bucketCount * 2) return data;

  const result = [];
  const chunkSize = len / bucketCount;

  for (let b = 0; b < bucketCount; b++) {
    const start = Math.floor(b * chunkSize);
    const end = Math.min(len, Math.floor((b + 1) * chunkSize));
    if (start >= end) continue;

    let minPt = data[start];
    let maxPt = data[start];

    for (let i = start + 1; i < end; i++) {
      const pt = data[i];
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

class SpatialGrid {
  constructor(cellSize = 24) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }
  clear() {
    this.grid.clear();
  }
  insert(x, y, pt) {
    const key = `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    let c = this.grid.get(key);
    if (!c) {
      c = [];
      this.grid.set(key, c);
    }
    c.push({ x, y, pt });
  }
  findNearest(qx, qy, maxRadius = 25) {
    const minCol = Math.floor((qx - maxRadius) / this.cellSize);
    const maxCol = Math.floor((qx + maxRadius) / this.cellSize);
    const minRow = Math.floor((qy - maxRadius) / this.cellSize);
    const maxRow = Math.floor((qy + maxRadius) / this.cellSize);

    let nearest = null;
    let minD2 = maxRadius * maxRadius;

    for (let c = minCol; c <= maxCol; c++) {
      for (let r = minRow; r <= maxRow; r++) {
        const cell = this.grid.get(`${c},${r}`);
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const item = cell[i];
          const d2 = (item.x - qx) ** 2 + (item.y - qy) ** 2;
          if (d2 < minD2) {
            minD2 = d2;
            nearest = item;
          }
        }
      }
    }
    return nearest;
  }
}

console.log('===============================================================');
console.log('  ⚡ REPRODUCIBLE PERFORMANCE BENCHMARK SUITE');
console.log('===============================================================\n');

// 1. Data Generation Benchmark
console.log('1. DATA GENERATION BENCHMARK (Continuous Ingestion Simulation):');
for (const count of [10000, 50000, 100000]) {
  const t0 = performance.now();
  const dataset = generatePoints(count);
  const dt = performance.now() - t0;
  console.log(`   - ${count.toLocaleString().padStart(7)} points: ${dt.toFixed(2).padStart(6)} ms (${Math.round((count / dt) * 1000).toLocaleString()} pts/sec)`);
}

// 2. Downsampling Benchmark
console.log('\n2. DOWNSAMPLING PERFORMANCE:');
const data10k = generatePoints(10000);
const data50k = generatePoints(50000);
const data100k = generatePoints(100000);

// LTTB on 10k
const tLttb10k = performance.now();
const lttbRes10k = lttb(data10k, 1500);
const dtLttb10k = performance.now() - tLttb10k;
console.log(`   - LTTB Downsample (10,000 -> 1,500 pts):   ${dtLttb10k.toFixed(2)} ms (Output: ${lttbRes10k.length} pts)`);

// MinMax on 10k, 50k, 100k
const tMm10k = performance.now();
const mmRes10k = minMaxDownsample(data10k, 750);
const dtMm10k = performance.now() - tMm10k;
console.log(`   - MinMax Decimate (10,000 -> 1,500 pts):  ${dtMm10k.toFixed(2)} ms (Output: ${mmRes10k.length} pts)`);

const tMm50k = performance.now();
const mmRes50k = minMaxDownsample(data50k, 750);
const dtMm50k = performance.now() - tMm50k;
console.log(`   - MinMax Decimate (50,000 -> 1,500 pts):  ${dtMm50k.toFixed(2)} ms (Output: ${mmRes50k.length} pts)`);

const tMm100k = performance.now();
const mmRes100k = minMaxDownsample(data100k, 750);
const dtMm100k = performance.now() - tMm100k;
console.log(`   - MinMax Decimate (100,000 -> 1,500 pts): ${dtMm100k.toFixed(2)} ms (Output: ${mmRes100k.length} pts)`);

// 3. Spatial Grid O(1) Hit-Testing Benchmark
console.log('\n3. SPATIAL GRID HIT-TESTING BENCHMARK (10,000 Scatter Points):');
const grid = new SpatialGrid(24);
const width = 800;
const height = 400;

const tGridPop = performance.now();
for (let i = 0; i < 10000; i++) {
  const x = Math.random() * width;
  const y = Math.random() * height;
  grid.insert(x, y, data10k[i]);
}
const dtGridPop = performance.now() - tGridPop;
console.log(`   - Spatial Index Build (10,000 points):    ${dtGridPop.toFixed(2)} ms`);

// Query 1,000 random mouse coordinates
const queryCount = 1000;
const tQuery = performance.now();
for (let i = 0; i < queryCount; i++) {
  const qx = Math.random() * width;
  const qy = Math.random() * height;
  grid.findNearest(qx, qy, 25);
}
const dtQuery = performance.now() - tQuery;
const perQueryMicros = (dtQuery / queryCount) * 1000;
console.log(`   - Hover Hit-Test Latency (${queryCount} queries):  ${dtQuery.toFixed(2)} ms total (${perQueryMicros.toFixed(1)} µs / query)`);

// 4. Memory Footprint
console.log('\n4. HEAP MEMORY FOOTPRINT:');
if (global.gc) global.gc();
const mem = process.memoryUsage();
console.log(`   - Node Process Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`   - Node Process Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);

console.log('\n===============================================================');
console.log('  ✔ All benchmarks executed with zero errors');
console.log('===============================================================\n');
