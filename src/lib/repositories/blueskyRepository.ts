import { 
  IBlueskyRepository,
  BlueskySessionData,
  BlueskyProfile 
} from '../types/bluesky'
import { supabaseAdapter, CustomAdapterUser } from '../supabase-adapter'
import { supabase } from '../supabase'

export class BlueskyRepository implements IBlueskyRepository {
  async getUserByBlueskyId(did: string): Promise<CustomAdapterUser | null> {
    return await supabaseAdapter.getUserByAccount({
      provider: 'bluesky',
      providerAccountId: did
    })
  }

  async linkBlueskyAccount(userId: string, blueskyData: BlueskySessionData): Promise<void> {
    await supabaseAdapter.linkAccount({
      provider: 'bluesky',
      type: 'oauth',
      providerAccountId: blueskyData.did,
      access_token: blueskyData.accessJwt,
      refresh_token: blueskyData.refreshJwt,
      token_type: 'bearer',
      userId,
      scope: undefined
    })
  }

  async updateBlueskyProfile(userId: string, profile: BlueskyProfile): Promise<void> {
    await supabaseAdapter.updateUser(userId, {
      provider: 'bluesky',
      profile: {
        did: profile.did,
        handle: profile.handle,
        displayName: profile.displayName,
        avatar: profile.avatar
      }
    })
  }

  async updateFollowStatus(userId: string, targetTwitterId: string): Promise<void> {
    const { error } = await supabase
      .from('sources_targets')
      .update({ has_follow_bluesky: true })
      .eq('source_id', userId)
      .eq('target_twitter_id', targetTwitterId)

    if (error) {
      throw new Error(`Failed to update follow status: ${error.message}`)
    }
  }
}