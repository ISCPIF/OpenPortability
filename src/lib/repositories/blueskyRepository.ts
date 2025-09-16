import { 
  IBlueskyRepository,
  BlueskySessionData,
  BlueskyProfile 
} from '../types/bluesky'
import { supabaseAdapter, CustomAdapterUser } from '../supabase-adapter'
import { supabase } from '../supabase'
import { encrypt } from '../encryption'
import { logError, logWarning } from '../log_utils'

export class BlueskyRepository implements IBlueskyRepository {
  async getUserByBlueskyId(did: string): Promise<CustomAdapterUser | null> {
    try {
      return await supabaseAdapter.getUserByAccount({
        provider: 'bluesky',
        providerAccountId: did
      })
    } catch (error) {
      logError('Repository', 'BlueskyRepository.getUserByBlueskyId', error, 'unknown', { did });
      return null;
    }
  }

  async linkBlueskyAccount(userId: string, blueskyData: BlueskySessionData): Promise<void> {
    try {
      await supabaseAdapter.linkAccount({
        provider: 'bluesky',
        type: 'oauth',
        providerAccountId: blueskyData.did,
        access_token: encrypt(blueskyData.accessJwt),
        refresh_token: encrypt(blueskyData.refreshJwt),
        token_type: blueskyData.token_type || 'bearer',
        userId,
        scope: blueskyData.scope
      })
    } catch (error) {
      logError('Repository', 'BlueskyRepository.linkBlueskyAccount', error, userId, { 
        did: blueskyData.did,
        context: 'Linking Bluesky account'
      });
      throw error;
    }
  }

  async updateBlueskyProfile(userId: string, profile: BlueskyProfile): Promise<void> {
    try {
      await supabaseAdapter.updateUser(userId, {
        provider: 'bluesky',
        profile: {
          did: profile.did,
          handle: profile.handle,
          displayName: profile.displayName,
          avatar: profile.avatar
        }
      })
    } catch (error) {
      logError('Repository', 'BlueskyRepository.updateBlueskyProfile', error, userId, { 
        did: profile.did,
        handle: profile.handle,
        context: 'Updating Bluesky profile'
      });
      throw error;
    }
  }

  async updateFollowStatus(userId: string, targetTwitterId: string): Promise<void> {
    const { error } = await supabase
      .from('sources_targets')
      .update({ has_follow_bluesky: true })
      .eq('source_id', userId)
      .eq('target_twitter_id', targetTwitterId)

    if (error) {
      logError('Repository', 'BlueskyRepository.updateFollowStatus', error, userId, { 
        targetTwitterId,
        context: 'Updating follow status'
      });
      throw new Error(`Failed to update follow status: ${error.message}`)
    }
  }
}