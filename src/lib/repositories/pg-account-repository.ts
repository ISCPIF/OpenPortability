import { queryNextAuth } from '../database'
import type { DBAccount } from '../types/database'
import logger from '../log_utils'

/**
 * Repository pour les opérations sur les comptes OAuth (schéma next-auth)
 */
export const pgAccountRepository = {
  /**
   * Récupère un compte par provider et provider_account_id
   */
  async getAccount(provider: string, providerAccountId: string): Promise<DBAccount | null> {
    try {
      const result = await queryNextAuth<DBAccount>(
        'SELECT * FROM accounts WHERE provider = $1 AND provider_account_id = $2',
        [provider, providerAccountId]
      )
      return result.rows[0] || null
    } catch (error) {
      logger.logError('Repository', 'pgAccountRepository.getAccount', 'Error fetching account', undefined, {
        provider,
        providerAccountId,
        error
      })
      throw error
    }
  },

  /**
   * Récupère un compte par provider et user_id
   */
  async getProviderAccount(provider: string, userId: string): Promise<DBAccount | null> {
    try {
      const result = await queryNextAuth<DBAccount>(
        'SELECT * FROM accounts WHERE provider = $1 AND user_id = $2',
        [provider, userId]
      )
      return result.rows[0] || null
    } catch (error) {
      logger.logError('Repository', 'pgAccountRepository.getProviderAccount', 'Error fetching provider account', userId, {
        provider,
        error
      })
      throw error
    }
  },

  /**
   * Récupère tous les comptes d'un utilisateur
   */
  async getAccountsByUserId(userId: string): Promise<DBAccount[]> {
    try {
      const result = await queryNextAuth<DBAccount>(
        'SELECT * FROM accounts WHERE user_id = $1',
        [userId]
      )
      return result.rows
    } catch (error) {
      logger.logError('Repository', 'pgAccountRepository.getAccountsByUserId', 'Error fetching accounts', userId, { error })
      throw error
    }
  },

  /**
   * Crée ou met à jour un compte (upsert)
   */
  async upsertAccount(accountData: Partial<DBAccount>): Promise<DBAccount> {
    try {
      const fields = Object.keys(accountData).filter(key => key !== 'id')
      const values = fields.map(field => accountData[field as keyof DBAccount])
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ')
      
      // Pour l'upsert, on utilise ON CONFLICT
      const updateClauses = fields
        .filter(f => f !== 'provider' && f !== 'provider_account_id')
        .map(field => `${field} = EXCLUDED.${field}`)
        .join(', ')
      
      const sql = `
        INSERT INTO accounts (${fields.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (provider, provider_account_id)
        DO UPDATE SET ${updateClauses}, updated_at = NOW()
        RETURNING *
      `
      
      const result = await queryNextAuth<DBAccount>(sql, values)
      
      if (!result.rows[0]) {
        throw new Error('Failed to upsert account')
      }
      
      return result.rows[0]
    } catch (error) {
      logger.logError('Repository', 'pgAccountRepository.upsertAccount', 'Error upserting account', accountData.user_id, {
        accountData,
        error
      })
      throw error
    }
  },

  /**
   * Met à jour les tokens d'un compte
   */
  async updateTokens(
    provider: string,
    providerAccountId: string,
    tokens: {
      access_token?: string | null
      refresh_token?: string | null
      expires_at?: number | null
      id_token?: string | null
    }
  ): Promise<DBAccount> {
    try {
      const fields = Object.keys(tokens)
      const setClauses = fields.map((field, i) => `${field} = $${i + 3}`).join(', ')
      const values = [provider, providerAccountId, ...fields.map(field => tokens[field as keyof typeof tokens])]
      
      const sql = `
        UPDATE accounts
        SET ${setClauses}, updated_at = NOW()
        WHERE provider = $1 AND provider_account_id = $2
        RETURNING *
      `
      
      const result = await queryNextAuth<DBAccount>(sql, values)
      
      if (!result.rows[0]) {
        throw new Error('Account not found')
      }
      
      return result.rows[0]
    } catch (error) {
      logger.logError('Repository', 'pgAccountRepository.updateTokens', 'Error updating tokens', undefined, {
        provider,
        providerAccountId,
        error
      })
      throw error
    }
  },

  /**
   * Supprime un compte
   */
  async deleteAccount(provider: string, providerAccountId: string): Promise<void> {
    try {
      await queryNextAuth(
        'DELETE FROM accounts WHERE provider = $1 AND provider_account_id = $2',
        [provider, providerAccountId]
      )
    } catch (error) {
      logger.logError('Repository', 'pgAccountRepository.deleteAccount', 'Error deleting account', undefined, {
        provider,
        providerAccountId,
        error
      })
      throw error
    }
  },

  /**
   * Supprime tous les comptes d'un utilisateur
   */
  async deleteAccountsByUserId(userId: string): Promise<void> {
    try {
      await queryNextAuth('DELETE FROM accounts WHERE user_id = $1', [userId])
    } catch (error) {
      logger.logError('Repository', 'pgAccountRepository.deleteAccountsByUserId', 'Error deleting accounts', userId, { error })
      throw error
    }
  },
}
