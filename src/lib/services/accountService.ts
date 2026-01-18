import { BskyAgent } from '@atproto/api';
import { pgAccountRepository } from '../repositories/auth/pg-account-repository';
import { pgUserRepository } from '../repositories/auth/pg-user-repository';
import { pgMastodonInstanceRepository } from '../repositories/auth/pg-mastodon-instance-repository';
import { Provider, RefreshResult, TokenData, TokenUpdate } from '../types/account';
// import { supabaseAdapter } from '../supabase-adapter';
// import { supabase } from '../supabase';
import logger from '../log_utils';

export class AccountService {
  constructor() {
    // pgAccountRepository is a singleton object, no instantiation needed
  }


  async verifyAndRefreshBlueskyToken(userId: string): Promise<RefreshResult> {
    const account = await pgAccountRepository.getProviderAccount('bluesky', userId);
    if (!account) {
      logger.logError('Security', 'No Bluesky account found for user:', userId);
      return { success: false, error: 'No Bluesky account found', requiresReauth: true };
    }

    // Tokens from pgAccountRepository.getProviderAccount() are already decrypted. Do NOT decrypt again.
    if (!account.access_token || !account.refresh_token) {
      logger.logWarning('Security', 'Missing tokens for user:', userId);
      return { success: false, error: 'Missing tokens', requiresReauth: true };
    }

    try {
      const did: string = account.provider_account_id;

      // Check if session exists in Redis (required for OAuth client to work)
      const { getRedis } = await import('../services/redisClient');
      const redis = getRedis();
      const redisKey = `bsky:session:${did}`;
      const raw = await redis.get(redisKey);

      if (!raw) {
        logger.logWarning('Security', `No OAuth session found in Redis for DID: ${did}`, userId);
        return { 
          success: false, 
          error: 'Missing OAuth session in Redis',
          requiresReauth: true 
        };
      }

      // Parse session to check scope
      const sessionData = JSON.parse(raw);
      const tokenSet = sessionData?.tokenSet || {};
      const scope: string | undefined = tokenSet.scope;

      // Validate expected minimal scope
      if (!scope || !scope.includes('atproto')) {
        logger.logError('Security', `Token scope invalid: ${scope ?? 'none'}`, userId);
        return {
          success: false,
          error: 'Invalid token scope',
          requiresReauth: true,
        };
      }

      // Sync tokens if mismatch between DB and Redis
      const redisAccessToken = tokenSet.access_token;
      const redisRefreshToken = tokenSet.refresh_token;
      
      if (redisAccessToken !== account.access_token || redisRefreshToken !== account.refresh_token) {
        sessionData.tokenSet.access_token = account.access_token;
        sessionData.tokenSet.refresh_token = account.refresh_token;
        await redis.set(redisKey, JSON.stringify(sessionData), 'EX', 60 * 60 * 24 * 30); // 30 days
      }

      // NOTE: Active verification with getProfile was removed because dpopFetch
      // often fails with 401 even with valid tokens due to DPoP nonce issues.
      // The actual follow operations will fail gracefully if the token is invalid.
      // 
      // We've verified:
      // 1. Account exists in DB with tokens
      // 2. Session exists in Redis with correct scope
      // 3. Tokens are synced between DB and Redis
      //
      // This is sufficient for most cases. If the token is truly invalid,
      // the batchFollowOAuth call will fail and return appropriate errors.

      return { success: true };
    } catch (error: any) {
      logger.logError('Security', 'Token verification failed:', error.message);
      return { 
        success: false, 
        error: error.message,
        requiresReauth: true 
      };
    }
  }

  async verifyAndRefreshMastodonToken(userId: string): Promise<RefreshResult> {
    const account = await pgAccountRepository.getProviderAccount('mastodon', userId);
    if (!account) {
      logger.logWarning('Security', 'No Mastodon account found for user:', userId);
      return { success: false, error: 'No Mastodon account found', requiresReauth: true };
    }

    if (!account.scope?.includes('follow')) {
      logger.logWarning('Security', 'Account scope does not include "follow" permission:', userId);
      
      // Supprimer le compte de la table accounts uniquement
      // await this.repository.deleteAccount(userId, 'mastodon');
      
      return { success: false, error: 'Missing follow permission', requiresReauth: true };
    }


    const user = await pgUserRepository.getUser(userId);
    if (!user?.mastodon_instance) {
      console.warn(' [AccountService.verifyAndRefreshMastodonToken] No Mastodon instance found for user:', userId);
      return { success: false, error: 'No Mastodon instance found', requiresReauth: true };
    }
    try {
      const response = await fetch(`${user.mastodon_instance}/api/v1/accounts/verify_credentials`, {
        headers: {
          'Authorization': `Bearer ${account.access_token}`
        }
      });

      if (!response.ok) {
        console.error(' [AccountService.verifyAndRefreshMastodonToken] Token validation failed:', response.status);
        
        // Specific handling for rate limit (429)
        if (response.status === 429) {
          return { 
            success: false, 
            error: 'Rate limit exceeded',
            requiresReauth: true,
            errorCode: 'MastodonRateLimit'
          };
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error(' [AccountService.verifyAndRefreshMastodonToken] Token validation failed:', error.message);
      
      // Check if error message contains rate limit info
      const isRateLimit = error.message?.includes('429') || error.message?.includes('Too Many Requests');
      
      return { 
        success: false, 
        error: error.message,
        requiresReauth: true,
        errorCode: isRateLimit ? 'MastodonRateLimit' : undefined
      };
    }
  }

  async getAccountByProviderAndUserId(provider: string, userId: string): Promise<any | null> {
    try {
      return await pgAccountRepository.getProviderAccount(provider, userId);
    } catch (error) {
      console.error(`Error fetching account ${provider}:`, error);
      return null;
    }
  }

  isTokenValid(tokenData: TokenData): boolean {
    if (!tokenData.expires_at) return true;
    const expiryDate = new Date(tokenData.expires_at);
    const isValid = expiryDate > new Date();
    return isValid;
  }
}