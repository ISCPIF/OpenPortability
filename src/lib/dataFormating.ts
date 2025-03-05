import { UserCompleteStats } from "@/lib/types/stats";

export function formatNumber(num: number): string {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  
  export function calculateTotalMatches(stats: UserCompleteStats) {
    const totalMatches = stats.matches.bluesky.notFollowed + stats.matches.mastodon.notFollowed;
    const totalHasFollowed = stats.matches.bluesky.hasFollowed + stats.matches.mastodon.hasFollowed;
    
    return { totalMatches, totalHasFollowed };
  }