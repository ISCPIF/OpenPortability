import { BlueskySessionData, BlueskyProfile } from '../../types/bluesky'
import { queryPublic } from '../../database'
import { pgAccountRepository } from '../auth/pg-account-repository'
import logger from '../../log_utils'

/**
 * Repository pour les opérations Bluesky (schéma public)
 * Gère les données Bluesky et les relations utilisateur-cible
 */
export const pgBlueskyRepository = {
  /**
   * Récupère un utilisateur par son Bluesky DID
   * Délègue à pgAccountRepository pour chercher le compte provider
   */
  async getUserByBlueskyId(did: string) {
    try {
      return await pgAccountRepository.getProviderAccount('bluesky', did)
    } catch (error) {
      logger.logWarning(
        'Repository',
        'pgBlueskyRepository.getUserByBlueskyId',
        `Error getting user by Bluesky ID: ${did}`,
        'unknown',
        { did, error }
      )
      return null
    }
  },

  /**
   * Lie un compte Bluesky à un utilisateur
   * Crée une entrée dans la table accounts avec les tokens chiffrés
   */
  async linkBlueskyAccount(userId: string, blueskyData: BlueskySessionData): Promise<void> {
    try {
      await pgAccountRepository.upsertAccount({
        user_id: userId,
        provider: 'bluesky',
        provider_account_id: blueskyData.did,
        type: 'oauth',
        access_token: blueskyData.accessJwt,
        refresh_token: blueskyData.refreshJwt,
        token_type: ((blueskyData.token_type || 'bearer') as string).toLowerCase() as Lowercase<string>,
        scope: blueskyData.scope,
      })
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgBlueskyRepository.linkBlueskyAccount',
        errorString,
        userId,
        {
          did: blueskyData.did,
          context: 'Linking Bluesky account',
        }
      )
      throw error
    }
  },

  /**
   * Met à jour le profil Bluesky d'un utilisateur
   * Stocke les données du profil dans la table users (next-auth schema)
   */
  async updateBlueskyProfile(userId: string, profile: BlueskyProfile): Promise<void> {
    try {
      await queryPublic(
        `UPDATE "next-auth".users 
         SET bluesky_id = $1, 
             bluesky_username = $2, 
             bluesky_image = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [profile.did, profile.handle, profile.avatar, userId]
      )
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgBlueskyRepository.updateBlueskyProfile',
        errorString,
        userId,
        {
          did: profile.did,
          handle: profile.handle,
          context: 'Updating Bluesky profile',
        }
      )
      throw error
    }
  },

  /**
   * Met à jour le statut de suivi Bluesky pour une relation source-cible
   * Marque que l'utilisateur source suit la cible sur Bluesky
   */
  async updateFollowStatus(userId: string, targetTwitterId: string): Promise<void> {
    try {
      await queryPublic(
        `UPDATE sources_targets 
         SET has_follow_bluesky = true, updated_at = CURRENT_TIMESTAMP
         WHERE source_id = $1 AND target_twitter_id = $2`,
        [userId, targetTwitterId]
      )
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgBlueskyRepository.updateFollowStatus',
        errorString,
        userId,
        {
          targetTwitterId,
          context: 'Updating follow status',
        }
      )
      throw error
    }
  },
}
