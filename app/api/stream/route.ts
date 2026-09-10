import { NextRequest } from 'next/server';
import { generateStreamBatch } from '@/lib/dataGenerator';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * Next.js Edge Runtime SSE (Server-Sent Events) Streaming Route Handler.
 * Streams real-time telemetry packets continuously over HTTP using a ReadableStream
 * directly from edge V8 isolates with zero Node.js runtime overhead.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const intervalMs = Math.max(50, Math.min(1000, parseInt(searchParams.get('interval') || '100', 10)));
  const batchSize = Math.max(1, Math.min(20, parseInt(searchParams.get('batch') || '2', 10)));

  const encoder = new TextEncoder();
  let currentTimestamp = Date.now();
  let intervalId: any = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial handshake header
      const initialMeta = JSON.stringify({
        type: 'HANDSHAKE',
        runtime: 'edge-v8',
        streamIntervalMs: intervalMs,
        startedAt: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`event: meta\ndata: ${initialMeta}\n\n`));

      // Continuous telemetry stream loop
      intervalId = setInterval(() => {
        if (request.signal.aborted) {
          clearInterval(intervalId);
          controller.close();
          return;
        }

        try {
          const batch = generateStreamBatch(batchSize, currentTimestamp);
          currentTimestamp = batch[batch.length - 1].timestamp;

          const sseChunk = `event: telemetry\ndata: ${JSON.stringify(batch)}\n\n`;
          controller.enqueue(encoder.encode(sseChunk));
        } catch (err) {
          clearInterval(intervalId);
          controller.error(err);
        }
      }, intervalMs);
    },
    cancel() {
      if (intervalId) {
        clearInterval(intervalId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Edge-Runtime': 'v8-isolate',
      'X-Edge-Streaming': 'SSE-Active',
    },
  });
}
