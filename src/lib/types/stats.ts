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