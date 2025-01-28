import { UserUpdate, ShareEvent } from '../types/user';
import { SupabaseClient } from '@supabase/supabase-js';
import { authClient, supabase } from '../supabase';

export class UserRepository {
    
  async updateUser(userId: string, update: UserUpdate): Promise<void> {
    const { error } = await authClient
      .from('users')
      .update(update)
      .eq('id', userId);
    
    if (error) throw error;
  }

  async getUser(userId: string) {
    const { data, error } = await authClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  }

  async createShareEvent(event: ShareEvent): Promise<void> {
    const { error } = await supabase
      .from('share_events')
      .insert(event);
    
    if (error) throw error;
  }

  async getShareEvents(userId: string): Promise<ShareEvent[]> {
    const { data, error } = await supabase
      .from('share_events')
      .select('*')
      .eq('source_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) { 
      
      console.log(error); 
      throw error;
    }
    return data;
  }

  async hasShareEvents(userId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('share_events')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', userId);
    
    if (error) {
      console.log(error);
      throw error;
    }
    
    return count !== null && count > 0;
  }
}