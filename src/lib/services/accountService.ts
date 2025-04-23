import { BskyAgent } from '@atproto/api';
import { AccountRepository } from '../repositories/accountRepository';
import { Provider, RefreshResult, TokenData, TokenUpdate } from '../types/account';
import { supabaseAdapter } from '../supabase-adapter';
import { supabase } from '../supabase';
import { decrypt } from '../encryption';

export class AccountService {
  private repository: AccountRepository;

  constructor() {
    this.repository = new AccountRepository();
  }


  async verifyAndRefreshBlueskyToken(userId: string): Promise<RefreshResult> {
    // console.log(' [AccountService.verifyAndRefreshBlueskyToken] Starting token verification for user:', userId);
    const account = await this.repository.getProviderAccount(userId, 'bluesky');
    if (!account) {
      console.warn(' [AccountService.verifyAndRefreshBlueskyToken] No Bluesky account found for user:', userId);
      return { success: false, error: 'No Bluesky account found', requiresReauth: true };
    }

    if (!account.access_token || !account.refresh_token) {
      console.warn(' [AccountService.verifyAndRefreshBlueskyToken] Missing tokens for user:', userId);
      return { success: false, error: 'Missing tokens', requiresReauth: true };
    }

    // console.log(' [AccountService.verifyAndRefreshBlueskyToken] Account found:', account);
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    try {
      // Déchiffrer les tokens avant de les utiliser
      const accessToken = decrypt(account.access_token);
      const refreshToken = decrypt(account.refresh_token);
      
      await agent.resumeSession({
        accessJwt: accessToken,
        refreshJwt: refreshToken,
        handle: account.provider_account_id.split('.')[0],
        did: account.provider_account_id,
        active: true
      });

      // Si le token a été rafraîchi par l'agent, mettons à jour la BD avec les nouveaux tokens chiffrés
      if (agent.session && agent.session?.accessJwt !== accessToken) {
        await this.repository.updateTokens(userId, 'bluesky', {
          access_token: agent.session.accessJwt,
          refresh_token: agent.session.refreshJwt,
        });
      } else {
        // console.log(' [AccountService.verifyAndRefreshBlueskyToken] Token is still valid, no refresh needed');
      }

      return { success: true };
    } catch (error) {
      console.error(' [AccountService.verifyAndRefreshBlueskyToken] Token refresh failed:', error.message);
      return { 
        success: false, 
        error: error.message,
        requiresReauth: true 
      };
    }
  }

  async verifyAndRefreshMastodonToken(userId: string): Promise<RefreshResult> {
    const account = await this.repository.getProviderAccount(userId, 'mastodon');
    if (!account) {
      console.warn(' [AccountService.verifyAndRefreshMastodonToken] No Mastodon account found for user:', userId);
      return { success: false, error: 'No Mastodon account found', requiresReauth: true };
    }

    if (!account.scope?.includes('follow')) {
      console.warn(' [AccountService.verifyAndRefreshMastodonToken] Account scope does not include "follow" permission:', userId);
      
      // Supprimer le compte de la table accounts uniquement
      // await this.repository.deleteAccount(userId, 'mastodon');
      
      return { success: false, error: 'Missing follow permission', requiresReauth: true };
    }

    // console.log(' [AccountService.verifyAndRefreshMastodonToken] Account found:', {
    //   userId,
    //   hasAccessToken: !!account.access_token,
    //   hasRefreshToken: !!account.refresh_token
    // });

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

    // console.log(' [AccountService.verifyAndRefreshMastodonToken] Using Mastodon instance:', user.mastodon_instance);

    try {
    //   console.log(' [AccountService.verifyAndRefreshMastodonToken] Verifying credentials with Mastodon API');
      const response = await fetch(`${user.mastodon_instance}/api/v1/accounts/verify_credentials`, {
        headers: {
          'Authorization': `Bearer ${account.access_token}`
        }
      });

      if (!response.ok) {
        console.error(' [AccountService.verifyAndRefreshMastodonToken] Token validation failed:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

    //   console.log(' [AccountService.verifyAndRefreshMastodonToken] Token is valid');
      return { success: true };
    } catch (error) {
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
      return await this.repository.getProviderAccount(userId, provider as Provider);
    } catch (error) {
      console.error(`Error fetching account ${provider}:`, error);
      return null;
    }
  }

  isTokenValid(tokenData: TokenData): boolean {
    // console.log(' [AccountService.isTokenValid] Checking token validity:', {
    //   hasExpiryDate: !!tokenData.expires_at,
    //   expiryDate: tokenData.expires_at
    // });
    if (!tokenData.expires_at) return true;
    const expiryDate = new Date(tokenData.expires_at);
    const isValid = expiryDate > new Date();
    // console.log(`${isValid ? '' : ''} [AccountService.isTokenValid] Token is ${isValid ? 'valid' : 'expired'}`);
    return isValid;
  }
}