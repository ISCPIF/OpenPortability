import { NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { supabase, authClient } from '@/lib/supabase'
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