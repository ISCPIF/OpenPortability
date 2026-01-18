import { NextRequest, NextResponse } from 'next/server';
import { 
  startPgNotifyListener, 
  stopPgNotifyListener, 
  isPgNotifyListenerRunning,
  sendTestNotification,
  PG_NOTIFY_CHANNELS 
} from '@/lib/pg-notify-listener';
import logger from '@/lib/log_utils';

/**
 * GET /api/internal/pg-notify
 * 
 * Get the status of the PostgreSQL NOTIFY listener
 */
export async function GET() {
  const isRunning = isPgNotifyListenerRunning();
  
  return NextResponse.json({
    status: isRunning ? 'running' : 'stopped',
    channels: Object.values(PG_NOTIFY_CHANNELS),
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/internal/pg-notify
 * 
 * Start or stop the PostgreSQL NOTIFY listener
 * 
 * Body: { action: 'start' | 'stop' | 'test' }
 * For 'test': { action: 'test', channel: string, payload: object }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, channel, payload } = body;

    switch (action) {
      case 'start': {
        if (isPgNotifyListenerRunning()) {
          return NextResponse.json({
            success: true,
            message: 'Listener already running',
            status: 'running',
          });
        }

        const started = await startPgNotifyListener();
        
        if (started) {
          logger.logInfo('PgNotifyAPI', 'Listener started via API', '', 'system');
          return NextResponse.json({
            success: true,
            message: 'Listener started successfully',
            status: 'running',
            channels: Object.values(PG_NOTIFY_CHANNELS),
          });
        } else {
          return NextResponse.json({
            success: false,
            message: 'Failed to start listener',
            status: 'stopped',
          }, { status: 500 });
        }
      }

      case 'stop': {
        await stopPgNotifyListener();
        logger.logInfo('PgNotifyAPI', 'Listener stopped via API', '', 'system');
        
        return NextResponse.json({
          success: true,
          message: 'Listener stopped',
          status: 'stopped',
        });
      }

      case 'test': {
        if (!isPgNotifyListenerRunning()) {
          return NextResponse.json({
            success: false,
            message: 'Listener not running. Start it first.',
          }, { status: 400 });
        }

        if (!channel || !payload) {
          return NextResponse.json({
            success: false,
            message: 'Missing channel or payload for test',
          }, { status: 400 });
        }

        const sent = await sendTestNotification(channel, payload);
        
        return NextResponse.json({
          success: sent,
          message: sent ? 'Test notification sent' : 'Failed to send test notification',
          channel,
          payload,
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: `Unknown action: ${action}. Use 'start', 'stop', or 'test'.`,
        }, { status: 400 });
    }
  } catch (error) {
    logger.logError('PgNotifyAPI', 'API error', 
      error instanceof Error ? error.message : String(error), 'system');
    
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
