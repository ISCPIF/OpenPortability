import { authClient } from '../supabase';
import { Provider, TokenUpdate } from '../types/account';
import { encrypt, decrypt } from '../encryption';
import { logError, logWarning } from '../log_utils';

export class AccountRepository {
  async getAccount(userId: string) {
    const { data, error } = await authClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      logError('Repository', 'AccountRepository.getAccount', error, userId);
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
      logError('Repository', 'AccountRepository.getProviderAccount', error, userId, { provider });
      throw error;
    }

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
      logError('Repository', 'AccountRepository.updateTokens', error, userId, { 
        provider,
        context: 'Updating tokens'
      });
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
    
    if (error) {
      logWarning('Repository', 'AccountRepository.deleteAccount', `Failed to delete account: ${error.message}`, userId, { 
        provider,
        context: 'Deleting provider account'
      });
      // Not throwing the error as per the commented code
    }
  }
}