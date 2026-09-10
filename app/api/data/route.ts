import { NextRequest, NextResponse } from 'next/server';
import { generateInitialDataset } from '@/lib/dataGenerator';
import { aggregateByTimePeriod } from '@/lib/performanceUtils';
import { AggregationPeriod, CategoryType } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * Next.js Edge Runtime Route Handler
 * High-performance global telemetry query endpoint running at Cloudflare/Vercel Edge nodes.
 */
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

  const responseHeaders = {
    'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59',
    'X-Edge-Runtime': 'v8-isolate',
    'X-Edge-Engine': 'Next.js 14 App Router Edge',
    'X-Response-Time': `${Math.round(processingTime * 100) / 100}ms`,
  };

  if (aggregateParam !== 'raw') {
    const aggregated = aggregateByTimePeriod(dataset, aggregateParam);
    return NextResponse.json(
      {
        success: true,
        meta: {
          runtime: 'edge',
          totalGenerated: count,
          aggregatedBuckets: aggregated.length,
          period: aggregateParam,
          generationTimeMs: Math.round(processingTime * 100) / 100,
        },
        data: aggregated,
      },
      { headers: responseHeaders }
    );
  }

  return NextResponse.json(
    {
      success: true,
      meta: {
        runtime: 'edge',
        count: dataset.length,
        requestedCount: count,
        categoryFilter: categoryParam || 'all',
        generationTimeMs: Math.round(processingTime * 100) / 100,
      },
      data: dataset,
    },
    { headers: responseHeaders }
  );
}
