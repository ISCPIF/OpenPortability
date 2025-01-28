import { PostgrestSingleResponse } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { RawStatsData } from "../types/stats";

interface CountResponse {
  count: number;
}

export class StatsRepository {
    async getFollowersCount(): Promise<PostgrestSingleResponse<CountResponse>> {
      const response = await supabase.rpc('count_followers').single();
      if (response.error) {
        console.error('Error in getFollowersCount:', response.error);
      }
      console.log('getFollowersCount response:', response);
      return response;
    }

    async getFollowingCount(): Promise<PostgrestSingleResponse<CountResponse>> {
      const response = await supabase.rpc('count_targets').single();
      if (response.error) {
        console.error('Error in getFollowingCount:', response.error);
      }
      console.log('getFollowingCount response:', response);
      return response;
    }

    async getSourcesCount(): Promise<{ count: number }> {
      const { count } = await supabase
        .from('sources')
        .select('*', { count: 'exact', head: true });
      
      return { count: count ?? 0 };
    }

    async getTargetsWithHandleCount(): Promise<PostgrestSingleResponse<CountResponse>> {
        const response = await supabase.rpc('count_targets_with_handle').single();
        if (response.error) {
            console.error('Error in getTargetsWithHandleCount:', response.error);
        }
        console.log('getTargetsWithHandleCount response:', response);
        return response;
    }

    async getSourcesTargetsByUserId(userId: string): Promise<number> {
        const { count } = await supabase
          .from('sources_targets')
          .select('*', { count: 'exact', head: true })
          .eq('source_id', userId);
        return count ?? 0;
      }
      
      async getSourcesFollowersByUserId(userId: string): Promise<number> {
        const { count } = await supabase
          .from('sources_followers')
          .select('*', { count: 'exact', head: true })
          .eq('source_id', userId);
        return count ?? 0;
      }
}