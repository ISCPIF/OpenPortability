import { Client } from 'pg';
import logger from '../log_utils';
import { PG_NOTIFY_CHANNELS } from './channels';
import { dispatchPgNotification } from './dispatcher';

// Singleton state
declare global {
  // eslint-disable-next-line no-var
  var __pgNotifyClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __pgNotifyListenerStarted: boolean | undefined;
}

/**
 * Get direct PostgreSQL connection config (bypassing PgBouncer)
 * LISTEN/NOTIFY requires a persistent connection, not pooled
 */
function getDirectPgConfig() {
  return {
    host: process.env.POSTGRES_HOST || 'postgres',
    port: parseInt(process.env.POSTGRES_DIRECT_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'nexus',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'mysecretpassword',
    // Keep connection alive
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  };
}

/**
 * Start the PostgreSQL NOTIFY listener
 * Creates a dedicated connection to PostgreSQL (not through PgBouncer)
 * and subscribes to notification channels
 */
export async function startPgNotifyListener(): Promise<boolean> {
  if (globalThis.__pgNotifyListenerStarted) {
    logger.logInfo('PgNotify', 'Listener already started', 'Skipping duplicate start', 'system');
    return true;
  }

  try {
    const config = getDirectPgConfig();
    logger.logInfo('PgNotify', 'Starting listener', `Connecting to ${config.host}:${config.port}/${config.database}`, 'system');

    const client = new Client(config);
    globalThis.__pgNotifyClient = client;

    client.on('error', (err: Error) => {
      logger.logError('PgNotify', 'Connection error', err.message, 'system');
      globalThis.__pgNotifyListenerStarted = false;
      setTimeout(() => {
        logger.logInfo('PgNotify', 'Attempting reconnection', '', 'system');
        startPgNotifyListener();
      }, 5000);
    });

    client.on('notification', (msg: { channel: string; payload?: string }) => {
      if (msg.channel && msg.payload) {
        dispatchPgNotification(msg.channel, msg.payload);
      }
    });

    await client.connect();
    logger.logInfo('PgNotify', 'Connected to PostgreSQL', 'Direct connection established', 'system');

    for (const channel of Object.values(PG_NOTIFY_CHANNELS)) {
      await client.query(`LISTEN ${channel}`);
      logger.logInfo('PgNotify', 'Subscribed to channel', channel, 'system');
    }

    globalThis.__pgNotifyListenerStarted = true;
    logger.logInfo('PgNotify', 'Listener started successfully', `Listening on ${Object.values(PG_NOTIFY_CHANNELS).length} channels`, 'system');

    return true;
  } catch (error) {
    logger.logError('PgNotify', 'Failed to start listener', error instanceof Error ? error.message : String(error), 'system');
    globalThis.__pgNotifyListenerStarted = false;
    return false;
  }
}

/**
 * Stop the PostgreSQL NOTIFY listener
 */
export async function stopPgNotifyListener(): Promise<void> {
  if (globalThis.__pgNotifyClient) {
    try {
      for (const channel of Object.values(PG_NOTIFY_CHANNELS)) {
        await globalThis.__pgNotifyClient.query(`UNLISTEN ${channel}`);
      }
      await globalThis.__pgNotifyClient.end();
      logger.logInfo('PgNotify', 'Listener stopped', 'Connection closed', 'system');
    } catch (error) {
      logger.logError('PgNotify', 'Error stopping listener', error instanceof Error ? error.message : String(error), 'system');
    } finally {
      globalThis.__pgNotifyClient = undefined;
      globalThis.__pgNotifyListenerStarted = false;
    }
  }
}

/**
 * Check if the listener is running
 */
export function isPgNotifyListenerRunning(): boolean {
  return globalThis.__pgNotifyListenerStarted === true;
}

/**
 * Manually trigger a test notification (for testing purposes)
 */
export async function sendTestNotification(channel: string, payload: object): Promise<boolean> {
  try {
    if (!globalThis.__pgNotifyClient) {
      logger.logError('PgNotify', 'Cannot send test notification', 'Listener not started', 'system');
      return false;
    }

    const payloadStr = JSON.stringify(payload);
    await globalThis.__pgNotifyClient.query(`NOTIFY ${channel}, '${payloadStr.replace(/'/g, "''")}'`);
    logger.logInfo('PgNotify', 'Test notification sent', `channel=${channel}`, 'system');
    return true;
  } catch (error) {
    logger.logError('PgNotify', 'Failed to send test notification', error instanceof Error ? error.message : String(error), 'system');
    return false;
  }
}
