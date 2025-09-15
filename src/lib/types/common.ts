export interface UserSession {
    user: {
      id?: string;
      twitter_username?: string | null;
      bluesky_username?: string | null;
      mastodon_username?: string | null;
      mastodon_instance?: string | null;
      twitter_id?: string | null;
      bluesky_id?: string | null;
      mastodon_id?: string | null;
      has_onboarded?: boolean;
      have_seen_newsletter?: boolean;
      have_seen_bot_newsletter?: boolean;
    }
  }
  
  export interface ConnectedServices {
    twitter: boolean;
    bluesky: boolean;
    mastodon: boolean;
  }