import { NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { supabase, authClient } from '@/lib/supabase'
import { redis } from '@/lib/redis'
import logger from '@/lib/log_utils'
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"

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

      const { error: sourceError } = await supabase
        .from('sources')
        .delete()
        .eq('id', userId)

      if (sourceError) {
        logger.logError('API', 'DELETE /api/delete', new Error(sourceError.message), userId, { context: 'Deleting source' })
        throw new Error(sourceError.message)
      }
      logger.logInfo('API', 'DELETE /api/delete', 'Successfully deleted source', userId)

      // Mettre à jour has_onboarded à false dans next-auth
      const { error: hasBoardError } = await authClient
        .from('users')
        .update({ has_onboarded: false })
        .eq('id', session.user.id);

      if (hasBoardError) {
        logger.logError('API', 'DELETE /api/delete', new Error(hasBoardError.message), userId, { context: 'Updating has_onboarded' })
        throw new Error(hasBoardError.message)
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
    const { error: deleteError } = await authClient
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteError) {
      logger.logError('API', 'DELETE /api/delete', new Error(deleteError.message), userId, { context: 'Deleting user' })
      throw new Error(deleteError.message)
    }
    logger.logInfo('API', 'DELETE /api/delete', 'Successfully deleted user', userId)
    
    return NextResponse.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    const userId = session?.user?.id || 'unknown'
    logger.logError('API', 'DELETE /api/delete', error, userId, { context: 'Account deletion process' })
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