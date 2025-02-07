import { NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { AccountService } from "@/lib/services/accountService"
import { unlinkAccount } from "@/lib/supabase-adapter"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountService = new AccountService()
    const results: { bluesky?: any; mastodon?: any } = {}
    const invalidProviders: string[] = []
    
    // Vérifier Bluesky si l'utilisateur a un compte
    if (session.user.bluesky_username) {
      console.log('🔄 [POST /api/auth/refresh] Checking Bluesky token for user:', session.user.bluesky_username)
      results.bluesky = await accountService.verifyAndRefreshBlueskyToken(session.user.id)
      if (results.bluesky.requiresReauth) {
        invalidProviders.push('bluesky')
      }
    }

    // Vérifier Mastodon si l'utilisateur a un compte
    if (session.user.mastodon_username) {
      console.log('🔄 [POST /api/auth/refresh] Checking Mastodon token for user:', session.user.mastodon_username)
      results.mastodon = await accountService.verifyAndRefreshMastodonToken(session.user.id)
      if (results.mastodon.requiresReauth) {
        invalidProviders.push('mastodon')
        // Déconnecter le compte Mastodon pour permettre une reconnexion
        // await unlinkAccount({
        //   provider: "mastodon",
        //   providerAccountId: session.user.id
        // })
      }
    }

    // Si aucun compte n'est configuré
    if (!session.user.bluesky_username && !session.user.mastodon_username) {
      // console.log('ℹ️ [POST /api/auth/refresh] No social accounts configured for user:', session.user.id)
      return NextResponse.json({ 
        success: false,
        error: 'No social accounts configured'
      })
    }

    // Si des providers nécessitent une réauthentification
    if (invalidProviders.length > 0) {
      console.log('⚠️ [POST /api/auth/refresh] Reauth required for providers:', invalidProviders)
      return NextResponse.json(
        { 
          success: false,
          error: 'Token refresh failed',
          providers: invalidProviders,
          // ...results
        }, 
        // { status: 401 }
      )
    }

    console.log('✅ [POST /api/auth/refresh] All tokens checked successfully:', results)
    return NextResponse.json({ 
      success: true,
      ...results 
    })
  } catch (error) {
    console.error('❌ [POST /api/auth/refresh]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}