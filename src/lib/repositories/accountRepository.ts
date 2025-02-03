import { authClient } from '../supabase';
import { Provider, TokenUpdate } from '../types/account';
import { encrypt, decrypt } from '../encryption';

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
      .maybeSingle();
    
    if (error) {
      console.error(' [AccountRepository.getProviderAccount] Error:', error.message);
      throw error;
    }

    console.log(' [AccountRepository.getProviderAccount] Account found:', data);
    if (data) {
      // Decrypt sensitive tokens
      return {
        ...data,
        access_token: data.access_token ? decrypt(data.access_token) : null,
        refresh_token: data.refresh_token ? decrypt(data.refresh_token) : null,
        id_token: data.id_token ? decrypt(data.id_token) : null,
      };
    }

    return data;
  }

  async updateTokens(userId: string, provider: Provider, update: TokenUpdate): Promise<void> {
    // Encrypt sensitive tokens before update
    const encryptedUpdate = {
      ...update,
      access_token: update.access_token ? encrypt(update.access_token) : null,
      refresh_token: update.refresh_token ? encrypt(update.refresh_token) : null,
    };

    const { error } = await authClient
      .from('accounts')
      .update(encryptedUpdate)
      .eq('user_id', userId)
      .eq('provider', provider);
    
    if (error) {
      console.error(' [AccountRepository.updateTokens] Error:', error.message);
      throw error;
    }
  }

  async deleteAccount(userId: string, provider: Provider): Promise<void> {
    const { error } = await authClient
      .from('accounts')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('type', 'oauth');
    
    // if (error) {
    //   console.error(' [AccountRepository.deleteAccount] Error:', error.message);
    //   throw error;
    // }
  }
}