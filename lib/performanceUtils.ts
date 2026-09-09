import { AggregatedBucket, AggregationPeriod, DataPoint } from './types';

/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling algorithm.
 * Reduces large datasets (10k-100k points) to target visual resolution (e.g. 1,000 points)
 * while strictly preserving all visual peaks, troughs, and data character.
 */
export function lttbDownsample(data: DataPoint[], threshold: number): DataPoint[] {
  const dataLength = data.length;
  if (threshold >= dataLength || threshold === 0) {
    return data;
  }

  const sampled: DataPoint[] = [];
  const bucketSize = (dataLength - 2) / (threshold - 2);

  let a = 0; // Initially the first point in the dataset
  sampled.push(data[a]);

  for (let i = 0; i < threshold - 2; i++) {
    // Calculate point average for next bucket (bucket c)
    let avgX = 0;
    let avgY = 0;
    let avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    avgRangeEnd = avgRangeEnd < dataLength ? avgRangeEnd : dataLength;

    const avgRangeLength = avgRangeEnd - avgRangeStart;

    for (let idx = avgRangeStart; idx < avgRangeEnd; idx++) {
      avgX += data[idx].timestamp;
      avgY += data[idx].value;
    }
    avgX /= avgRangeLength || 1;
    avgY /= avgRangeLength || 1;

    // Get the range for this bucket (bucket b)
    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1;

    // Point a
    const pointAX = data[a].timestamp;
    const pointAY = data[a].value;

    let maxArea = -1;
    let nextA = rangeOffs;

    for (let idx = rangeOffs; idx < rangeTo; idx++) {
      // Calculate triangle area over points a, this point, and the average point of next bucket
      const area = Math.abs(
        (pointAX - avgX) * (data[idx].value - pointAY) -
        (pointAX - data[idx].timestamp) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        nextA = idx;
      }
    }

    sampled.push(data[nextA]); // Pick the point with maximum triangle area
    a = nextA;
  }

  sampled.push(data[dataLength - 1]); // Always include the last point
  return sampled;
}

/**
 * High-speed Min-Max decimation algorithm.
 * Excellent for extreme load (50,000+ points) to run in < 2ms.
 */
export function minMaxDownsample(data: DataPoint[], bucketCount: number): DataPoint[] {
  const len = data.length;
  if (len <= bucketCount * 2) return data;

  const result: DataPoint[] = [];
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

    // Preserve temporal order between min and max
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

/**
 * Aggregate points into discrete time buckets (1min, 5min, 1hour)
 */
export function aggregateByTimePeriod(
  data: DataPoint[],
  period: AggregationPeriod
): AggregatedBucket[] {
  if (period === 'raw' || data.length === 0) return [];

  let intervalMs = 60 * 1000; // 1min default
  if (period === '5min') intervalMs = 5 * 60 * 1000;
  if (period === '1hour') intervalMs = 60 * 60 * 1000;

  const bucketsMap = new Map<number, AggregatedBucket>();

  for (let i = 0; i < data.length; i++) {
    const pt = data[i];
    const bucketTime = Math.floor(pt.timestamp / intervalMs) * intervalMs;

    let bucket = bucketsMap.get(bucketTime);
    if (!bucket) {
      bucket = {
        timestamp: bucketTime,
        open: pt.value,
        high: pt.value,
        low: pt.value,
        close: pt.value,
        avg: pt.value,
        count: 1,
        categoryCounts: { [pt.category]: 1 },
      };
      bucketsMap.set(bucketTime, bucket);
    } else {
      bucket.high = Math.max(bucket.high, pt.value);
      bucket.low = Math.min(bucket.low, pt.value);
      bucket.close = pt.value;
      bucket.avg = (bucket.avg * bucket.count + pt.value) / (bucket.count + 1);
      bucket.count += 1;
      bucket.categoryCounts[pt.category] = (bucket.categoryCounts[pt.category] || 0) + 1;
    }
  }

  return Array.from(bucketsMap.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Sliding Window Ring Buffer for strictly bounded memory consumption.
 * Eliminates GC pauses during continuous streaming.
 */
export class SlidingDataBuffer {
  private buffer: DataPoint[];
  private capacity: number;
  private head: number = 0;
  private count: number = 0;

  constructor(capacity: number = 100000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  public setCapacity(newCapacity: number) {
    if (newCapacity === this.capacity) return;
    const current = this.toArray();
    this.capacity = newCapacity;
    this.buffer = new Array(newCapacity);
    this.head = 0;
    this.count = 0;
    this.pushBatch(current.slice(-newCapacity));
  }

  public push(point: DataPoint): void {
    this.buffer[this.head] = point;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  public pushBatch(points: DataPoint[]): void {
    for (let i = 0; i < points.length; i++) {
      this.push(points[i]);
    }
  }

  public toArray(): DataPoint[] {
    if (this.count < this.capacity) {
      return this.buffer.slice(0, this.count);
    }
    // Buffer has wrapped around; return chronological order
    const result = new Array<DataPoint>(this.capacity);
    let outIdx = 0;
    for (let i = this.head; i < this.capacity; i++) {
      result[outIdx++] = this.buffer[i];
    }
    for (let i = 0; i < this.head; i++) {
      result[outIdx++] = this.buffer[i];
    }
    return result;
  }

  public get size(): number {
    return this.count;
  }

  public clear(): void {
    this.head = 0;
    this.count = 0;
    this.buffer = new Array(this.capacity);
  }
}
