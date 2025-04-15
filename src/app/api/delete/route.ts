import { NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import { supabase, authClient } from '@/lib/supabase'
import logger, { withLogging } from '@/lib/log_utils'

async function deleteHandler() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
        logger.logWarning('API', 'DELETE /api/delete', 'Unauthorized deletion attempt: No valid session')
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

    const userId = session.user.id

    // Supprimer d'abord les newsletter_consents pour tous les utilisateurs
    const { error: newsletterConsentError } = await supabase
      .from('newsletter_consents')
      .delete()
      .eq('user_id', userId)

    if (newsletterConsentError) {
      logger.logError('API', 'DELETE /api/delete', new Error(newsletterConsentError.message), userId, { context: 'Deleting newsletter_consent' })
      throw new Error(newsletterConsentError.message)
    }
    console.log('API', 'DELETE /api/delete', 'Successfully deleted newsletter_consent entries', userId)

    // Supprimer les python_tasks
    const { error: pythonTasksError } = await supabase
      .from('python_tasks')
      .delete()
      .eq('user_id', userId)

    if (pythonTasksError) {
      logger.logError('API', 'DELETE /api/delete', new Error(pythonTasksError.message), userId, { context: 'Deleting python_tasks' })
      throw new Error(pythonTasksError.message)
    }
    console.log('API', 'DELETE /api/delete', 'Successfully deleted python_tasks entries', userId)

    // 1. Si l'utilisateur a has_onboarded = true
    if (session.user.has_onboarded) {
        console.log('API', 'DELETE /api/delete', 'User has onboarded, cleaning up public schema data', userId)

        // Supprimer l'import_job dans le schema public
        const { error: importJobError } = await supabase
          .from('import_jobs')
          .delete()
          .eq('user_id', userId)
  
        if (importJobError) {
          logger.logError('API', 'DELETE /api/delete', new Error(importJobError.message), userId, { context: 'Deleting import_job' })
          throw new Error(importJobError.message)
        }
        console.log('API', 'DELETE /api/delete', 'Successfully deleted import_job', userId)

        const { error: userStatsError } = await supabase
        .from('user_stats_cache')
        .delete()
        .eq('user_id', userId)

      if (userStatsError) {
        logger.logError('API', 'DELETE /api/delete', new Error(userStatsError.message), userId, { context: 'Deleting user_stats_cache' })
        throw new Error(userStatsError.message)
      }
      console.log('API', 'DELETE /api/delete', 'Successfully deleted userStatsCache', userId)

        const { error: sourceError } = await supabase
        .from('sources')
        .delete()
        .eq('id', userId)

      if (sourceError) {
        logger.logError('API', 'DELETE /api/delete', new Error(sourceError.message), userId, { context: 'Deleting source' })
        throw new Error(sourceError.message)
      }
      console.log('API', 'DELETE /api/delete', 'Successfully deleted source', userId)

      // Mettre à jour has_onboarded à false dans next-auth
      const { error: hasBoardError } = await authClient
      .from('users')
      .update({ has_onboarded: false })
      .eq('id', session.user.id);

      if (hasBoardError) {
        logger.logError('API', 'DELETE /api/delete', new Error(hasBoardError.message), userId, { context: 'Updating has_onboarded' })
        throw new Error(hasBoardError.message)
      }
      console.log('API', 'DELETE /api/delete', 'Successfully updated has_onboarded to false', userId)
    }

    // Supprimer les entrées d'audit_log
    const { error: auditLogError } = await supabase
      .from('audit_log')
      .delete()
      .eq('user_id', userId)

    if (auditLogError) {
      logger.logError('API', 'DELETE /api/delete', new Error(auditLogError.message), userId, { context: 'Deleting audit_log entries' })
      throw new Error(auditLogError.message)
    }
    console.log('API', 'DELETE /api/delete', 'Successfully deleted audit_log entries', userId)

    const { error: deleteError } = await authClient
    .from('users')
    .delete()
    .eq('id', userId)

    if (deleteError) {
      logger.logError('API', 'DELETE /api/delete', new Error(deleteError.message), userId, { context: 'Deleting user' })
      throw new Error(deleteError.message)
    }
    console.log('API', 'DELETE /api/delete', 'Successfully deleted user', userId)
    
    return NextResponse.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown'
    logger.logError('API', 'DELETE /api/delete', error, userId, { context: 'Account deletion process' })
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}

export const DELETE = withLogging(deleteHandler)