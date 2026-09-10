/**
 * Real-Time Core Web Vitals Telemetry Engine.
 * Measures LCP, INP/FID, CLS, FCP, and TTFB directly in the browser via PerformanceObserver.
 */

export interface WebVitalMetric {
  name: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  unit: string;
  thresholds: [number, number]; // [goodThreshold, poorThreshold]
}

export interface WebVitalsReport {
  lcp: WebVitalMetric;
  inp: WebVitalMetric;
  cls: WebVitalMetric;
  fcp: WebVitalMetric;
  ttfb: WebVitalMetric;
  overallScore: 'good' | 'needs-improvement' | 'poor';
}

function rateMetric(value: number, [good, poor]: [number, number]): 'good' | 'needs-improvement' | 'poor' {
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

export function createInitialReport(): WebVitalsReport {
  return {
    lcp: { name: 'LCP', value: 0, rating: 'good', unit: 'ms', thresholds: [2500, 4000] },
    inp: { name: 'INP', value: 0, rating: 'good', unit: 'ms', thresholds: [200, 500] },
    cls: { name: 'CLS', value: 0, rating: 'good', unit: '', thresholds: [0.1, 0.25] },
    fcp: { name: 'FCP', value: 0, rating: 'good', unit: 'ms', thresholds: [1800, 3000] },
    ttfb: { name: 'TTFB', value: 0, rating: 'good', unit: 'ms', thresholds: [800, 1800] },
    overallScore: 'good',
  };
}

export function observeWebVitals(onUpdate: (report: WebVitalsReport) => void): () => void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return () => {};
  }

  const report: WebVitalsReport = createInitialReport();

  const updateAndNotify = () => {
    const ratings = [report.lcp.rating, report.inp.rating, report.cls.rating];
    if (ratings.includes('poor')) {
      report.overallScore = 'poor';
    } else if (ratings.includes('needs-improvement')) {
      report.overallScore = 'needs-improvement';
    } else {
      report.overallScore = 'good';
    }
    onUpdate({ ...report });
  };

  const observers: PerformanceObserver[] = [];

  // 1. TTFB (Navigation Timing)
  try {
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries.length > 0) {
      const nav = navEntries[0] as PerformanceNavigationTiming;
      const ttfb = Math.round(nav.responseStart - nav.requestStart);
      report.ttfb.value = Math.max(1, ttfb);
      report.ttfb.rating = rateMetric(report.ttfb.value, report.ttfb.thresholds);
      updateAndNotify();
    }
  } catch {
    // Navigation timing fallback
  }

  // 2. FCP (Paint Timing)
  try {
    const paintObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          report.fcp.value = Math.round(entry.startTime);
          report.fcp.rating = rateMetric(report.fcp.value, report.fcp.thresholds);
          updateAndNotify();
        }
      }
    });
    paintObserver.observe({ type: 'paint', buffered: true });
    observers.push(paintObserver);
  } catch {}

  // 3. LCP (Largest Contentful Paint)
  try {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1];
        report.lcp.value = Math.round(lastEntry.startTime);
        report.lcp.rating = rateMetric(report.lcp.value, report.lcp.thresholds);
        updateAndNotify();
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    observers.push(lcpObserver);
  } catch {}

  // 4. CLS (Cumulative Layout Shift)
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as any[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          report.cls.value = Math.round(clsValue * 1000) / 1000;
          report.cls.rating = rateMetric(report.cls.value, report.cls.thresholds);
          updateAndNotify();
        }
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
    observers.push(clsObserver);
  } catch {}

  // 5. INP / First Input Delay
  try {
    const inpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as any[]) {
        const delay = entry.processingStart - entry.startTime;
        if (delay > report.inp.value) {
          report.inp.value = Math.round(delay);
          report.inp.rating = rateMetric(report.inp.value, report.inp.thresholds);
          updateAndNotify();
        }
      }
    });
    inpObserver.observe({ type: 'first-input', buffered: true });
    observers.push(inpObserver);
  } catch {}

  return () => {
    for (const obs of observers) {
      obs.disconnect();
    }
  };
}
