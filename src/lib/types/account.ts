export type Provider = 'bluesky' | 'mastodon';

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at?: Date;
  provider: Provider;
  provider_account_id?: string;
}

export interface TokenUpdate {
  access_token?: string;
  refresh_token?: string;
  expires_at?: Date;
}

export interface RefreshResult {
  success: boolean;
  error?: string;
  requiresReauth?: boolean;
  errorCode?: string;  // Specific error code for frontend handling (e.g., 'MastodonRateLimit')
}

export interface BlueskyCredentials {
    accessJwt: string;
    refreshJwt: string;
    handle: string;
    did: string;
  }