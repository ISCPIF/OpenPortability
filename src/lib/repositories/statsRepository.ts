import { PostgrestSingleResponse } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { RawStatsData } from "../types/stats";

interface CountResponse {
  count: number;
}

export class StatsRepository {
    async getFollowersCount(): Promise<PostgrestSingleResponse<CountResponse>> {
      return supabase.rpc('count_followers').single();
    }

    async getFollowingCount(): Promise<PostgrestSingleResponse<CountResponse>> {
      return supabase.rpc('count_targets').single();
    }

    async getSourcesCount(): Promise<{ count: number }> {
      const { count } = await supabase
        .from('sources')
        .select('*', { count: 'exact', head: true });
      
      return { count: count ?? 0 };
    }

    async getTargetsWithHandleCount(): Promise<PostgrestSingleResponse<CountResponse>> {
        return supabase.rpc('count_targets_with_handle').single();
    }
}