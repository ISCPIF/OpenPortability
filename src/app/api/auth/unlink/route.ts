 import { NextResponse } from "next/server"
 import logger from '@/lib/log_utils'
 import { withValidation } from "@/lib/validation/middleware"
 import { z } from "zod"
 import { authClient } from "@/lib/supabase"

 // Classe d'erreur pour la déliaison de compte (interne au module)
 class UnlinkError extends Error {
  constructor(
    message: string,
    public code: 'LAST_ACCOUNT' | 'NOT_FOUND' | 'NOT_LINKED' | 'DATABASE_ERROR',
    public status: number = 400
  ) {
    super(message)
    this.name = 'UnlinkError'
  }
}

// Schéma de validation pour la requête de déliaison de compte
const UnlinkSchema = z.object({
  provider: z.string().refine(
    (val) => ['twitter', 'bluesky', 'mastodon'].includes(val),
    { message: "Provider must be one of: twitter, bluesky, mastodon" }
  )
}).strict()

// Type pour les données validées
type UnlinkRequest = z.infer<typeof UnlinkSchema>

async function unlinkHandler(_req: Request, data: UnlinkRequest, session: any) {
  try {
    if (!session?.user?.id) {
      logger.logWarning('API', 'POST /api/auth/unlink', 'Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = session.user.id
    const { provider } = data
    
    // Récupérer l'utilisateur pour vérifier les comptes liés
    const { data: user, error: userError } = await authClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (userError || !user) {
      logger.logError('API', 'POST /api/auth/unlink', 'Error fetching user', userId, { provider, error: userError })
      throw new UnlinkError("User not found", "NOT_FOUND", 404)
    }
    
    // Vérifier si le compte est lié
    const providerIdField = `${provider}_id`
    if (!user[providerIdField]) {
      logger.logWarning('API', 'POST /api/auth/unlink', 'Account not found for provider', userId, { provider })
      return NextResponse.json({ 
        error: 'Account not found', 
        code: 'NOT_LINKED' 
      }, { status: 400 })
    }
    
    // Vérifier si c'est le dernier compte lié
    const linkedProviders = ['twitter_id', 'bluesky_id', 'mastodon_id']
      .filter(field => user[field])
      .length
    
    if (linkedProviders <= 1) {
      logger.logWarning('API', 'POST /api/auth/unlink', 'Cannot unlink last account', userId, { provider })
      throw new UnlinkError("Cannot unlink last account", "LAST_ACCOUNT", 400)
    }
    
    // Vérifier si c'est une instance Piaille pour Mastodon
    const isPiaille = provider === 'mastodon' && user.mastodon_instance === 'piaille.fr'
    
    // Supprimer le compte de la table accounts
    const { error: deleteError } = await authClient
      .from('accounts')
      .delete()
      .eq('user_id', userId)
      .eq('provider', isPiaille ? 'piaille' : provider)
    
    if (deleteError) {
      logger.logError('API', 'POST /api/auth/unlink', 'Error deleting account', userId, { provider, error: deleteError })
      // On continue même en cas d'erreur car le compte pourrait ne pas exister dans la table accounts
    }
    
    // Mettre à jour les champs dans la table users
    const dbProvider = provider
    const updates: any = {
      [`${dbProvider}_id`]: null,
      [`${dbProvider}_username`]: null,
      [`${dbProvider}_image`]: null
    }
    
    if (dbProvider === 'mastodon') {
      updates.mastodon_instance = null
    }
    
    // Mettre à jour l'utilisateur
    const { error: updateError } = await authClient
      .from('users')
      .update(updates)
      .eq('id', userId)
    
    if (updateError) {
      logger.logError('API', 'POST /api/auth/unlink', 'Error updating user', userId, { provider, error: updateError })
      throw new UnlinkError("Database error", "DATABASE_ERROR", 500)
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    const userId = session?.user?.id || 'unknown'
    const err = error instanceof Error ? error : new Error(String(error))
    logger.logError('API', 'POST /api/auth/unlink', err, userId, {
      name: err.name,
      message: err.message
    })
    if (error instanceof UnlinkError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to unlink account' },
      { status: 500 }
    )
  }
}

// Configuration du middleware de validation
export const POST = withValidation(
  UnlinkSchema,
  unlinkHandler,
  {
    requireAuth: true,
    applySecurityChecks: true,
    skipRateLimit: false
  }
)