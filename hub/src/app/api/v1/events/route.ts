import { NextRequest } from 'next/server';
import { subscribeToEvents, AgentUpdateEvent } from '../../../../lib/events';

export const dynamic = 'force-dynamic';

/**
 * Real-time Dashboard Update Stream (SSE)
 * GET /api/v1/events
 */
export async function GET(request: NextRequest) {
  const textEncoder = new TextEncoder();

  const eventStream = new ReadableStream({
    start(controller) {
      // Subscribe to the global Hub event bus
      const unsubscribeFromBus = subscribeToEvents((updateEvent: AgentUpdateEvent) => {
        try {
          const payload = `data: ${JSON.stringify(updateEvent)}\n\n`;
          controller.enqueue(textEncoder.encode(payload));
        } catch (error) {
          console.error('[SSE] Failed to enqueue event update:', error);
        }
      });

      // Maintain connection with a 15s heartbeat
      const heartbeatSession = setInterval(() => {
        try {
          controller.enqueue(textEncoder.encode(': heartbeat\n\n'));
        } catch (error) {
          // If heartbeat fails, the connection is likely stale
          clearInterval(heartbeatSession);
        }
      }, 15000);

      // Unified Connection Cleanup
      const terminateConnection = () => {
        clearInterval(heartbeatSession);
        unsubscribeFromBus();
        try {
          controller.close();
        } catch (e) {
          // Ignore errors during double-close
        }
      };

      request.signal.addEventListener('abort', terminateConnection);
    },
  });

  return new Response(eventStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for Nginx/Proxy
    },
  });
}
