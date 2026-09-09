import { NextRequest, NextResponse } from 'next/server';
import { generateInitialDataset } from '@/lib/dataGenerator';
import { aggregateByTimePeriod } from '@/lib/performanceUtils';
import { AggregationPeriod, CategoryType } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const pointsParam = searchParams.get('points');
  const count = pointsParam ? Math.min(100000, Math.max(10, parseInt(pointsParam, 10))) : 1000;
  const categoryParam = searchParams.get('category') as CategoryType | null;
  const aggregateParam = (searchParams.get('aggregate') || 'raw') as AggregationPeriod;
  const timeStepMs = parseInt(searchParams.get('step') || '100', 10);

  const startTime = performance.now();
  let dataset = generateInitialDataset(count, timeStepMs);

  if (categoryParam) {
    dataset = dataset.filter((d) => d.category === categoryParam);
  }

  const processingTime = performance.now() - startTime;

  if (aggregateParam !== 'raw') {
    const aggregated = aggregateByTimePeriod(dataset, aggregateParam);
    return NextResponse.json({
      success: true,
      meta: {
        totalGenerated: count,
        aggregatedBuckets: aggregated.length,
        period: aggregateParam,
        generationTimeMs: Math.round(processingTime * 100) / 100,
      },
      data: aggregated,
    });
  }

  return NextResponse.json({
    success: true,
    meta: {
      count: dataset.length,
      requestedCount: count,
      categoryFilter: categoryParam || 'all',
      generationTimeMs: Math.round(processingTime * 100) / 100,
    },
    data: dataset,
  });
}
