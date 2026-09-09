import React, { Suspense } from 'react';
import Dashboard from '@/components/Dashboard';
import DashboardServerInsights, {
  DashboardServerInsightsSkeleton,
} from '@/components/DashboardServerInsights';

/**
 * Next.js Server Component (App Router)
 * Streams asynchronous server insights via React Suspense boundary
 * and mounts the high-performance telemetry dashboard.
 */
export default async function DashboardPage() {
  return (
    <>
      {/* Real Async Server Component streamed via HTTP chunking in React Suspense */}
      <Suspense fallback={<DashboardServerInsightsSkeleton />}>
        <DashboardServerInsights />
      </Suspense>

      <Dashboard />
    </>
  );
}

