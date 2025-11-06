import { BskyAgent } from '@atproto/api';
import { pgAccountRepository } from '../repositories/auth/pg-account-repository';
import { pgUserRepository } from '../repositories/auth/pg-user-repository';
import { pgMastodonInstanceRepository } from '../repositories/auth/pg-mastodon-instance-repository';
import { Provider, RefreshResult, TokenData, TokenUpdate } from '../types/account';
import { supabaseAdapter } from '../supabase-adapter';
import { supabase } from '../supabase';
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

    // Bluesky OAuth tokens are DPoP-bound and not compatible with BskyAgent.resumeSession (which expects app-password session tokens)
    // Instead, check for the persisted OAuth session in Redis using the DID and validate minimal scope.
    try {
      const did: string = account.provider_account_id;
      const handleGuess = did.includes('.') ? did.split('.')[0] : did;

      // Attempt to read the OAuth session saved by blueskyOAuthClient's sessionStore
      const { getRedis } = await import('../services/redisClient');
      const redis = getRedis();
      const redisKey = `bsky:session:${did}`;
      const raw = await redis.get(redisKey);

      if (!raw) {
        console.warn(' [AccountService.verifyAndRefreshBlueskyToken] No OAuth session found in Redis for DID:', did);
        return { 
          success: false, 
          error: 'Missing OAuth session (DPoP)',
          requiresReauth: true 
        };
      }

      const sessionData = JSON.parse(raw);
      const tokenSet = sessionData?.tokenSet || {};
      const scope: string | undefined = tokenSet.scope;
      const tokenType: string | undefined = tokenSet.token_type;

      // Validate expected minimal scope
      // We request "atproto transition:generic" in client metadata. If scope is missing or different, make it explicit.
      if (!scope || !scope.includes('atproto')) {
        console.error(' [AccountService.verifyAndRefreshBlueskyToken] Token scope invalid or missing', { userId, did, scope, tokenType });
        return {
          success: false,
          error: `Bad token scope: expected atproto scope, got ${scope ?? 'none'} (type=${tokenType ?? 'unknown'})`,
          requiresReauth: true,
        };
      }

      // Optional: make a lightweight authenticated call using dpopFetch to ensure the session works
      const dpopFetch = sessionData?.dpopFetch;
      if (typeof dpopFetch === 'function') {
        try {
          const origin = 'https://bsky.social';
          const url = new URL('/xrpc/app.bsky.actor.getProfile', origin);
          url.searchParams.set('actor', did);
          const resp = await dpopFetch(url.toString());
          if (!resp.ok) {
            const body = await resp.text();
            console.warn(' [AccountService.verifyAndRefreshBlueskyToken] dpopFetch non-OK', { status: resp.status, body });
            return {
              success: false,
              error: `OAuth session invalid (status ${resp.status})`,
              requiresReauth: true,
            };
          }
        } catch (e: any) {
          console.warn(' [AccountService.verifyAndRefreshBlueskyToken] dpopFetch failed', { message: e?.message });
          return {
            success: false,
            error: 'OAuth session check failed',
            requiresReauth: true,
          };
        }
      }
      return { success: true };
    } catch (error: any) {
      logger.logError('Security', 'Token refresh failed:', error.message);
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


    // Récupérer l'instance Mastodon depuis le profil utilisateur
    if (!supabaseAdapter?.getUser) {
      console.error(' [AccountService.verifyAndRefreshMastodonToken] supabaseAdapter.getUser is not defined');
      return { success: false, error: 'Internal configuration error', requiresReauth: true };
    }

    const user = await supabaseAdapter.getUser(userId);
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error(' [AccountService.verifyAndRefreshMastodonToken] Token validation failed:', error.message);
      return { 
        success: false, 
        error: error.message,
        requiresReauth: true 
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