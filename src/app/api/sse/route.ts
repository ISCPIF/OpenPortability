import { NextRequest } from 'next/server';
import { redis } from '@/lib/redis';
import { auth } from '@/app/auth';
import logger from '@/lib/log_utils';
import { SSE_GRAPH_CHANNEL, SSE_HEARTBEAT_INTERVAL_MS, type SSEEvent } from '@/lib/sse/constants';

/**
 * GET /api/sse
 * 
 * Server-Sent Events endpoint for real-time graph updates.
 * Replaces polling for:
 * - Labels version changes
 * - Node type changes
 * - Follower/following hash updates
 * - Stats updates
 * 
 * Authentication is optional:
 * - Authenticated users receive user-specific events + public events
 * - Anonymous users receive only public events (labels, nodeTypes, stats:global)
 */
export async function GET(request: NextRequest) {
  // Get session (optional - anonymous users can still receive public events)
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session?.user?.id || null;
  } catch {
    // Anonymous user - will only receive public events
  }

  const encoder = new TextEncoder();
  let subscriber: ReturnType<typeof redis.createSubscriber> | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let isControllerClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Create a dedicated Redis subscriber client
        subscriber = redis.createSubscriber();

        // Subscribe to the SSE channel
        await subscriber.subscribe(SSE_GRAPH_CHANNEL);

        logger.logInfo('SSE', 'Client connected', `User: ${userId || 'anonymous'}`, userId || 'anonymous');

        // Send initial connection event
        const connectEvent = `data: ${JSON.stringify({ type: 'connected', userId, timestamp: Date.now() })}\n\n`;
        controller.enqueue(encoder.encode(connectEvent));

        // Handle incoming messages from Redis pub/sub
        subscriber.on('message', (channel: string, message: string) => {
          if (isControllerClosed) return;
          
          try {
            const event: SSEEvent = JSON.parse(message);

            // Filter user-specific events
            // If event has userId and it doesn't match current user, skip
            if (event.userId && event.userId !== userId) {
              return;
            }

            // For user-specific event types, only send to authenticated users
            if ((event.type === 'followers' || event.type === 'followings' || event.type === 'stats:user') && !userId) {
              return;
            }

            // Send the event to the client
            const sseData = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(sseData));

          } catch (parseError) {
            logger.logError('SSE', 'Failed to parse message', parseError instanceof Error ? parseError.message : String(parseError), userId || 'anonymous');
          }
        });

        // Handle Redis errors
        subscriber.on('error', (error: Error) => {
          logger.logError('SSE', 'Redis subscriber error', error.message, userId || 'anonymous');
          if (!isControllerClosed) {
            isControllerClosed = true;
            controller.close();
          }
        });

        // Heartbeat to keep connection alive (prevents proxy/load balancer timeouts)
        heartbeatInterval = setInterval(() => {
          if (isControllerClosed) {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            return;
          }
          try {
            // SSE comment (starts with :) - doesn't trigger onmessage but keeps connection alive
            controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
          } catch {
            // Controller might be closed
            if (heartbeatInterval) clearInterval(heartbeatInterval);
          }
        }, SSE_HEARTBEAT_INTERVAL_MS);

      } catch (error) {
        logger.logError('SSE', 'Failed to setup SSE stream', error instanceof Error ? error.message : String(error), userId || 'anonymous');
        if (!isControllerClosed) {
          isControllerClosed = true;
          controller.close();
        }
      }
    },

    cancel() {
      // Cleanup when client disconnects
      isControllerClosed = true;
      
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      if (subscriber) {
        subscriber.unsubscribe(SSE_GRAPH_CHANNEL).catch(() => {});
        subscriber.quit().catch(() => {});
        subscriber = null;
      }

      logger.logInfo('SSE', 'Client disconnected', `User: ${userId || 'anonymous'}`, userId || 'anonymous');
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

