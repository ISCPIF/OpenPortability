/**
 * Next.js Instrumentation
 * 
 * This file is executed once when the Next.js server starts.
 * Used to initialize background services like the PostgreSQL NOTIFY listener.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on the server (Node.js runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startPgNotifyListener, isPgNotifyListenerRunning } = await import('@/lib/pg-notify-listener');
    const logger = (await import('@/lib/log_utils')).default;

    // Check if listener is already running (handles HMR in development)
    if (!isPgNotifyListenerRunning()) {
      logger.logInfo('Instrumentation', 'Starting PgNotify listener on server startup', '', 'system');
      
      const started = await startPgNotifyListener();
      
      if (started) {
        logger.logInfo('Instrumentation', 'PgNotify listener started successfully', '', 'system');
      } else {
        logger.logError('Instrumentation', 'Failed to start PgNotify listener', 'Will retry on first API call', 'system');
      }
    } else {
      logger.logInfo('Instrumentation', 'PgNotify listener already running', '', 'system');
    }
  }
}
