'use client';

import { useState, useEffect } from 'react';
import {
  WebVitalsReport,
  createInitialReport,
  observeWebVitals,
} from '@/lib/webVitals';

export function useWebVitals(): WebVitalsReport {
  const [report, setReport] = useState<WebVitalsReport>(createInitialReport);

  useEffect(() => {
    const disconnect = observeWebVitals((latest) => {
      setReport(latest);
    });
    return disconnect;
  }, []);

  return report;
}
