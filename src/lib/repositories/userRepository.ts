import { UserUpdate, ShareEvent } from '../types/user';
import { SupabaseClient } from '@supabase/supabase-js';
import { authClient, supabase } from '../supabase';
import { logError, logWarning } from '../log_utils';

export class UserRepository {
    
  async updateUser(userId: string, update: UserUpdate): Promise<void> {
    const { error } = await authClient
      .from('users')
      .update(update)
      .eq('id', userId);
    
    if (error) {
      logError('Repository', 'UserRepository.updateUser', error, userId, { update });
      throw error;
    }
  }

  async getUser(userId: string) {
    const { data, error } = await authClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      logError('Repository', 'UserRepository.getUser', error, userId);
      throw error;
    }
    return data;
  }

  async createShareEvent(event: ShareEvent): Promise<void> {
    const { error } = await supabase
      .from('share_events')
      .insert(event);
    
    if (error) {
      logError('Repository', 'UserRepository.createShareEvent', error, event.source_id, { event });
      throw error;
    }
  }

  async getShareEvents(userId: string): Promise<ShareEvent[]> {
    const { data, error } = await supabase
      .from('share_events')
      .select('*')
      .eq('source_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) { 
      logError('Repository', 'UserRepository.getShareEvents', error, userId);
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
      logError('Repository', 'UserRepository.hasShareEvents', error, userId);
      throw error;
    }
    
    return count !== null && count > 0;
  }
}