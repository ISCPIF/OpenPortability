// worker/src/repositories/usersRepository.ts
import { queryNextAuth } from '../database'

export const usersRepository = {
  /**
   * Met à jour le statut has_onboarded d'un utilisateur
   */
  async updateOnboardedStatus(userId: string): Promise<void> {
    try {
      await queryNextAuth(
        `UPDATE users 
         SET has_onboarded = true 
         WHERE id = $1`,
        [userId]
      )
    } catch (error) {
      console.log('UsersRepository', 'updateOnboardedStatus', 'Error updating onboarded status', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }
}
