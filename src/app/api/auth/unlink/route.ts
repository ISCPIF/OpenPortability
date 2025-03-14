import { NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { supabaseAdapter, UnlinkError } from "@/lib/supabase-adapter"
import logger, { withLogging } from '@/lib/log_utils'

async function unlinkHandler(req: Request) {
  try {    
    const session = await auth()
    if (!session?.user?.id) {
      logger.logWarning('API', 'POST /api/auth/unlink', 'Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { provider } = await req.json()    
    if (!['twitter', 'bluesky', 'mastodon', 'piaille'].includes(provider)) {
      logger.logWarning('API', 'POST /api/auth/unlink', 'Invalid provider requested', session.user.id, { provider })
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }
    if (!supabaseAdapter.unlinkAccount || !supabaseAdapter.getAccountsByUserId) {
      logger.logError('API', 'POST /api/auth/unlink', new Error('Required adapter methods are not implemented'), session.user.id)
      throw new Error('Required adapter methods are not implemented')
    }
    const accounts = await supabaseAdapter.getAccountsByUserId(session.user.id)

    // Find the account to unlink
    const accountToUnlink = accounts.find(account => account.provider === provider)
    if (!accountToUnlink) {
      logger.logWarning('API', 'POST /api/auth/unlink', 'Account not found for provider', session.user.id, { provider })
      return NextResponse.json({ 
        error: 'Account not found', 
        code: 'NOT_LINKED' 
      }, { status: 400 })
    }
    await supabaseAdapter.unlinkAccount({
      provider: accountToUnlink.provider,
      providerAccountId: accountToUnlink.providerAccountId
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown'
    logger.logError('API', 'POST /api/auth/unlink', error, userId, {
      name: error.name,
      message: error.message
    })
    
    if (error instanceof UnlinkError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}

export const POST = withLogging(unlinkHandler)