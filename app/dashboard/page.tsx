import React, { Suspense } from 'react';
import { generateInitialDataset } from '@/lib/dataGenerator';
import { DataProvider } from '@/components/providers/DataProvider';
import Dashboard from '@/components/Dashboard';
import DashboardServerInsights, {
  DashboardServerInsightsSkeleton,
} from '@/components/DashboardServerInsights';

/**
 * Next.js Server Component (App Router)
 * Generates initial 10,000 baseline telemetry points on the server side (SSR)
 * to eliminate initial client hydration delay.
 * Also streams asynchronous server insights via React Suspense boundary.
 */
export default async function DashboardPage() {
  // Server-side baseline generation (10,000 points)
  const initialData = generateInitialDataset(10000, 100);

  return (
    <DataProvider initialData={initialData}>
      {/* Real Async Server Component streamed via HTTP chunking in React Suspense */}
      <Suspense fallback={<DashboardServerInsightsSkeleton />}>
        <DashboardServerInsights />
      </Suspense>

      <Dashboard />
    </DataProvider>
  );
}

