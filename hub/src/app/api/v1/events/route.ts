import { NextResponse } from 'next/server';
import { subscribeToEvents } from '../../../../lib/events';

export const dynamic = 'force-dynamic';

/**
 * Event stream for the UI (SSE).
 * GET /api/v1/events
 */
export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Subscribe to the local event system
      const unsubscribe = subscribeToEvents((data) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      });

      // Handle connection close
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });

      // Keep-alive every 15 seconds
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 15000);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
