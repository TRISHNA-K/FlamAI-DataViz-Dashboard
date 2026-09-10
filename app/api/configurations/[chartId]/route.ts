import { NextRequest, NextResponse } from 'next/server';
import {
  STATIC_CHART_CONFIGS,
  getAllStaticChartIds,
  getStaticChartConfig,
} from '@/lib/staticChartConfigs';

/**
 * Next.js Static Route Handler with generateStaticParams.
 * Serves pre-computed static JSON configurations for chart visualizers.
 */
export async function generateStaticParams() {
  const ids = getAllStaticChartIds();
  return ids.map((id) => ({
    chartId: id,
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: { chartId: string } }
) {
  const config = getStaticChartConfig(params.chartId);

  if (!config) {
    return NextResponse.json(
      {
        error: 'Chart configuration not found',
        available: getAllStaticChartIds(),
      },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      chartId: params.chartId,
      generatedAt: '2026-09-09T00:00:00.000Z',
      isStaticallyGenerated: true,
      config,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Static-Generated': 'true',
      },
    }
  );
}
