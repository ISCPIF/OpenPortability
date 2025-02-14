export interface PlatformStats {
  total: number;
  hasFollowed: number;
  notFollowed: number;
}

export interface UserCompleteStats {
  connections: {
    followers: number;
    following: number;
  };
  matches: {
    bluesky: PlatformStats;
    mastodon: PlatformStats;
  };
  updated_at: string;
}

export interface GlobalStats {
  users: {
    total: number;
    onboarded: number;
  };
  connections: {
    followers: number;
    following: number;
    withHandle: number;
    withHandleBluesky: number;
    withHandleMastodon: number;
    followedOnBluesky: number;
    followedOnMastodon: number;
  };
  updated_at: string;
}

export interface ReconnectionStats {
  connections: number;
  blueskyMappings: number;
  sources: number;
}

export interface RawStatsData {
  count: number;
}

export interface StatsError {
  error: string;
  status: number;
}

export interface StatsResponse {
  total_followers: number;
  total_following: number;
  total_sources: number;
}

export type UserStats = {
  following: number;
  followers: number;
}