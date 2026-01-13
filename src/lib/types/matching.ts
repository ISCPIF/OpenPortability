export interface MatchingTarget {
  node_id: string;
  bluesky_handle: string | null;
  mastodon_handle: string | null;
  mastodon_username: string | null;
  mastodon_instance: string | null;
  mastodon_id: string | null;
  has_follow_bluesky: boolean;
  has_follow_mastodon: boolean;
  // Timestamps to distinguish "never tried" (null) from "tried and failed" (has date but has_follow=false)
  followed_at_bluesky?: string | null;
  followed_at_mastodon?: string | null;
  dismissed?: boolean;
  total_count?: number;
}

export interface StoredProcedureTarget {
  node_id: string;
  bluesky_handle: string | null;
  mastodon_handle: string | null;
  mastodon_username: string | null;
  mastodon_instance: string | null;
  mastodon_id: string | null;
  has_follow_bluesky: boolean;
  has_follow_mastodon: boolean;
  followed_at_bluesky: string | null;
  followed_at_mastodon: string | null;
  dismissed: boolean;
  total_count: number;
}

export interface MatchedFollower {
  source_twitter_id: string;
  bluesky_handle: string | null;
  mastodon_id: string | null;
  mastodon_username: string | null;
  mastodon_instance: string | null;
  has_been_followed_on_bluesky: boolean;
  has_been_followed_on_mastodon: boolean;
  // Timestamps to distinguish "never tried" from "tried and failed"
  followed_at_bluesky?: string | null;
  followed_at_mastodon?: string | null;
  full_count?: number;
}

export interface MatchingStats {
  total_following: number;
  matched_following: number;
  bluesky_matches: number;
  mastodon_matches: number;
}

export interface MatchingResult {
  following: MatchingTarget[];
  stats: MatchingStats;
}

export interface FollowerOfSource {
  node_id: string;
  bluesky_handle: string | null;
  has_follow_bluesky: boolean;
  followed_at_bluesky: string | null;
  followed_at_mastodon: string | null;
  has_been_followed_on_bluesky: boolean;
  has_been_followed_on_mastodon: boolean;
  total_count: number;
}