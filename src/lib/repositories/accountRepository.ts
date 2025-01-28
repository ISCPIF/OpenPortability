import { authClient } from '../supabase';
import { Provider, TokenUpdate } from '../types/account';

export class AccountRepository {
  async getAccount(userId: string) {
    const { data, error } = await authClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error(' [AccountRepository.getAccount] Error:', error.message);
      throw error;
    }
    return data;
  }

  async getProviderAccount(userId: string, provider: Provider) {
    const { data, error } = await authClient
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('type', 'oauth')
      .single();
    
    if (error) {
      console.error(' [AccountRepository.getProviderAccount] Error:', error.message);
      throw error;
    }
    return data;
  }

  async updateTokens(userId: string, provider: Provider, update: TokenUpdate): Promise<void> {
    const { error } = await authClient
      .from('accounts')
      .update(update)
      .eq('user_id', userId)
      .eq('provider', provider);
    
    if (error) {
      console.error(' [AccountRepository.updateTokens] Error:', error.message);
      throw error;
    }
  }
}