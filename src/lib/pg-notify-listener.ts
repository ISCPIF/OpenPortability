// Backward-compatible re-exports.
//
// This file remains the public entrypoint for existing imports.
// Internals are implemented in src/lib/pg-notify/* for maintainability.

export { PG_NOTIFY_CHANNELS } from './pg-notify/channels';
export type { CacheInvalidationPayload, ConsentChangePayload } from './pg-notify/types';

export {
  startPgNotifyListener,
  stopPgNotifyListener,
  isPgNotifyListenerRunning,
  sendTestNotification,
} from './pg-notify/listener';
