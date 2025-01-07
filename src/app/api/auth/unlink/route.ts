import { NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { supabaseAdapter, UnlinkError } from "@/lib/supabase-adapter"

export async function POST(req: Request) {
  console.log("\n=== [Route] Starting unlink process ===")
  try {
    const session = await auth()
    if (!session?.user?.id) {
      console.log("❌ No session or user ID found")
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log("✓ User authenticated:", session.user.id)

    const { provider } = await req.json()
    console.log("→ Requested provider:", provider)
    
    if (!['twitter', 'bluesky', 'mastodon', 'piaille'].includes(provider)) {
      console.log("❌ Invalid provider requested:", provider)
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }
    console.log("✓ Provider is valid")

    if (!supabaseAdapter.unlinkAccount || !supabaseAdapter.getAccountsByUserId) {
      console.log("❌ Required adapter methods not found")
      throw new Error('Required adapter methods are not implemented')
    }
    console.log("✓ Required adapter methods found")

    // Get all accounts for the user
    console.log("→ Fetching user accounts...")
    const accounts = await supabaseAdapter.getAccountsByUserId(session.user.id)
    console.log("✓ Found accounts:", accounts.map(a => `${a.provider} (${a.providerAccountId})`))
    
    // Find the account to unlink
    console.log("→ Looking for account to unlink...")
    const accountToUnlink = accounts.find(account => account.provider === provider)
    if (!accountToUnlink) {
      console.log("❌ Account not found for provider:", provider)
      return NextResponse.json({ 
        error: 'Account not found', 
        code: 'NOT_LINKED' 
      }, { status: 400 })
    }
    console.log("✓ Found account to unlink:", accountToUnlink)

    console.log("→ Calling adapter unlinkAccount...")
    await supabaseAdapter.unlinkAccount({
      provider: accountToUnlink.provider,
      providerAccountId: accountToUnlink.providerAccountId
    })
    console.log("✓ Account unlinked successfully")

    console.log("=== [Route] Unlink process completed successfully ===\n")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("\n❌ [Route] Error during unlink process:", error)
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
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