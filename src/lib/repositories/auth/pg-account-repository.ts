import { queryNextAuth } from '../../database'
import type { DBAccount } from '../../types/database'
import logger from '../../log_utils'
import { encrypt, decrypt } from '../../encryption'

/**
 * Helper pour parser expires_at qui est retourné comme string par PostgreSQL bigint
 */
function parseAccount(account: any): DBAccount {
  return {
    ...account,
    expires_at: account.expires_at ? parseInt(account.expires_at, 10) : null
  }
}

/**
 * Helper pour décrypter les tokens sensibles
 * Gère le cas où les tokens ne sont pas chiffrés (retourne le token tel quel)
 */
function decryptTokens(account: DBAccount): DBAccount {
  const safeDecrypt = (token: string | null): string | null => {
    if (!token) return null
    try {
      const decrypted = decrypt(token)
      // Si le déchiffrement retourne une chaîne vide, c'est que le token n'était pas chiffré
      return decrypted || token
    } catch (error) {
      // Si erreur de déchiffrement, le token n'était probablement pas chiffré
      return token
    }
  }

  return {
    ...account,
    access_token: safeDecrypt(account.access_token),
    refresh_token: safeDecrypt(account.refresh_token),
    id_token: safeDecrypt(account.id_token),
  }
}

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
        'SELECT * FROM "next-auth".accounts WHERE provider = $1 AND provider_account_id = $2',
        [provider, providerAccountId]
      )
      return result.rows[0] ? parseAccount(result.rows[0]) : null
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
   * Les tokens retournés sont DÉCRYPTÉS
   * Priorise les comptes avec access_token valide, puis les plus récents
   */
  async getProviderAccount(provider: string, userId: string): Promise<DBAccount | null> {
    try {
      // Order by: accounts with access_token first, then by most recent
      const result = await queryNextAuth<DBAccount>(
        `SELECT * FROM "next-auth".accounts 
         WHERE provider = $1 AND user_id = $2 
         ORDER BY 
           CASE WHEN access_token IS NOT NULL THEN 0 ELSE 1 END,
           updated_at DESC NULLS LAST,
           created_at DESC NULLS LAST
         LIMIT 1`,
        [provider, userId]
      )
      if (!result.rows[0]) return null
      const account = parseAccount(result.rows[0])
      return decryptTokens(account)
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
        'SELECT * FROM "next-auth".accounts WHERE user_id = $1',
        [userId]
      )
      return result.rows.map(parseAccount)
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
        INSERT INTO "next-auth".accounts (${fields.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (provider, provider_account_id)
        DO UPDATE SET ${updateClauses}, updated_at = NOW()
        RETURNING *
      `
      
      const result = await queryNextAuth<DBAccount>(sql, values)
      
      if (!result.rows[0]) {
        throw new Error('Failed to upsert account')
      }
      
      return parseAccount(result.rows[0])
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
   * Les tokens passés en paramètre sont ENCRYPTÉS avant insertion
   * Les tokens retournés sont DÉCRYPTÉS
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
      // Encrypt sensitive tokens before update
      const encryptedTokens = {
        ...tokens,
        access_token: tokens.access_token ? encrypt(tokens.access_token) : null,
        refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        id_token: tokens.id_token ? encrypt(tokens.id_token) : null,
      }
      
      const fields = Object.keys(encryptedTokens)
      const setClauses = fields.map((field, i) => `${field} = $${i + 3}`).join(', ')
      const values = [provider, providerAccountId, ...fields.map(field => encryptedTokens[field as keyof typeof encryptedTokens])]
      
      const sql = `
        UPDATE "next-auth".accounts
        SET ${setClauses}, updated_at = NOW()
        WHERE provider = $1 AND provider_account_id = $2
        RETURNING *
      `
      
      const result = await queryNextAuth<DBAccount>(sql, values)
      
      if (!result.rows[0]) {
        throw new Error('Account not found')
      }
      
      const account = parseAccount(result.rows[0])
      return decryptTokens(account)
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
        'DELETE FROM "next-auth".accounts WHERE provider = $1 AND provider_account_id = $2',
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
      await queryNextAuth('DELETE FROM "next-auth".accounts WHERE user_id = $1', [userId])
    } catch (error) {
      logger.logError('Repository', 'pgAccountRepository.deleteAccountsByUserId', 'Error deleting accounts', userId, { error })
      throw error
    }
  },
}
