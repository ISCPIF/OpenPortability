import { NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { supabaseAdapter, UnlinkError } from "@/lib/supabase-adapter"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { provider } = await req.json()
    if (!['twitter', 'bluesky', 'mastodon'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    await supabaseAdapter.unlinkAccount(
      session.user.id,
      provider as 'twitter' | 'bluesky' | 'mastodon'
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unlink error:', error)
    
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