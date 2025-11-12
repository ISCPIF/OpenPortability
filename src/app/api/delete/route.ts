import { NextResponse } from "next/server"
import { redis } from '@/lib/redis'
import logger from '@/lib/log_utils'
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"
import { queryPublic } from '@/lib/database'
import { pgUserRepository } from '@/lib/repositories/auth/pg-user-repository'

// Schéma vide car cette route ne nécessite pas de body
const EmptySchema = z.object({}).strict()

async function deleteHandler(_request: Request, _validatedData: {}, session: any) {
  try {
    if (!session?.user?.id) {
      logger.logWarning('API', 'DELETE /api/delete', 'Unauthorized deletion attempt: No valid session')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // 1. Si l'utilisateur a has_onboarded = true
    if (session.user.has_onboarded) {
      logger.logInfo('API', 'DELETE /api/delete', 'User has onboarded, cleaning up public schema data', userId)
      try {
        await queryPublic(`DELETE FROM sources WHERE id = $1`, [userId])
      } catch (e: any) {
        logger.logError('API', 'DELETE /api/delete', e instanceof Error ? e : new Error(String(e)), userId, { context: 'Deleting source' })
        throw e
      }
      logger.logInfo('API', 'DELETE /api/delete', 'Successfully deleted source', userId)

      // Mettre à jour has_onboarded à false dans next-auth
      try {
        await pgUserRepository.updateUser(session.user.id, { has_onboarded: false })
      } catch (e: any) {
        logger.logError('API', 'DELETE /api/delete', e instanceof Error ? e : new Error(String(e)), userId, { context: 'Updating has_onboarded' })
        throw e
      }
      logger.logInfo('API', 'DELETE /api/delete', 'Successfully updated has_onboarded to false', userId)
    }

    // 2. Nettoyer Redis - Supprimer toutes les clés liées à l'utilisateur
    try {
      logger.logInfo('API', 'DELETE /api/delete', 'Cleaning up Redis cache for user', userId)
      
      // Supprimer les stats utilisateur
      const userStatsKey = `user:stats:${userId}`;
      await redis.del(userStatsKey);
      
      // Optionnel : Supprimer d'autres clés liées à l'utilisateur si elles existent
      // Par exemple : user:preferences:${userId}, user:cache:${userId}, etc.
      
      logger.logInfo('API', 'DELETE /api/delete', 'Successfully cleaned up Redis cache', userId)
    } catch (redisError) {
      // Ne pas faire échouer la suppression si Redis échoue
      logger.logWarning('API', 'DELETE /api/delete', 'Failed to clean Redis cache (non-critical)', userId, {
        context: 'Redis cleanup failed but continuing with user deletion',
        error: redisError instanceof Error ? redisError.message : 'Unknown Redis error'
      })
    }

    // 3. Supprimer l'utilisateur de next-auth
    try {
      await pgUserRepository.deleteUser(userId)
    } catch (e: any) {
      logger.logError('API', 'DELETE /api/delete', e instanceof Error ? e : new Error(String(e)), userId, { context: 'Deleting user' })
      throw e
    }
    logger.logInfo('API', 'DELETE /api/delete', 'Successfully deleted user', userId)
    
    return NextResponse.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    const userId = session?.user?.id || 'unknown'
    const err = error instanceof Error ? error : new Error(String(error))

    logger.logError('API', 'DELETE /api/delete', err, userId, { context: 'Account deletion process' })
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}

// Configuration du middleware de validation
// - requireAuth: true car la suppression de compte nécessite une authentification
// - applySecurityChecks: false car pas de données à valider (requête DELETE sans body)
// - skipRateLimit: false pour protéger contre les abus
export const DELETE = withValidation(EmptySchema, deleteHandler, {
  requireAuth: true,
  applySecurityChecks: false,
  skipRateLimit: false
})