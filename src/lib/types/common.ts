export interface UserSession {
    user: {
      id?: string;
      twitter_username?: string;
      bluesky_username?: string | null;
      mastodon_username?: string | null;
      mastodon_instance?: string | null;
      twitter_id?: string;
      bluesky_id?: string;
      mastodon_id?: string;
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