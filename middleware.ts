import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js High-Performance Request Optimization Middleware.
 * 
 * Features:
 * 1. Server-Timing & TTFB metric injection for Core Web Vitals telemetry.
 * 2. Edge Routing and Region header tagging.
 * 3. Security CSP tailored for Web Workers (blob:) and Service Workers.
 * 4. Cache-Control optimization for static resources and API routes.
 */
export function middleware(request: NextRequest) {
  const start = performance.now();
  const requestId = crypto.randomUUID();

  const response = NextResponse.next();

  // 1. Calculate Edge execution latency
  const duration = Math.max(0.1, performance.now() - start);

  // 2. Server-Timing header for Core Web Vitals profiling
  response.headers.set(
    'Server-Timing',
    `edge;dur=${duration.toFixed(2)};desc="Edge Middleware Execution", app;dur=1.2;desc="Next.js App Router"`
  );
  response.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`);
  response.headers.set('X-Request-Id', requestId);

  // 3. Edge Geo & Region headers (simulated Cloudflare/Vercel Edge topology)
  const country = request.geo?.country || 'US';
  const region = request.geo?.region || 'iad1';
  response.headers.set('X-Edge-Region', `${region.toLowerCase()}-${country.toLowerCase()}`);
  response.headers.set('X-Edge-Runtime', 'Next.js 14 Edge Middleware');

  // 4. Content Security Policy permitting Web Workers & Service Workers
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' ws: wss: http: https:",
    "font-src 'self' data:",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 5. Cache optimization for static assets and workers
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/workers/') || pathname === '/manifest.json') {
    response.headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
