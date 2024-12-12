import { createClient } from "@supabase/supabase-js"
import type {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken
} from "next-auth/adapters"

interface CustomAdapterUser extends Omit<AdapterUser, 'email' | 'emailVerified' | 'image'> {
  has_onboarded: boolean
  twitter_id?: string | null
  twitter_username?: string | null
  twitter_image?: string | null
  bluesky_id?: string | null
  bluesky_username?: string | null
  bluesky_image?: string | null
}

// Créer deux clients Supabase distincts
const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: "next-auth"
    }
  }
)

const publicClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const createUser = async (user) => {
  console.log("\n=== [Adapter] Starting user creation ===")
  console.log("→ Input user data:", JSON.stringify(user, null, 2))
  try {
    console.log("→ Attempting to insert user into next-auth.users...")
    // 1. Créer l'utilisateur dans next-auth.users avec uniquement les infos Twitter
    const { data: authUser, error: authError } = await authClient
      .from("users")
      .insert([
        {
          name: user.name,
          twitter_id: user.twitter_id,
          twitter_username: user.twitter_username,
          twitter_image: user.twitter_image,
          has_onboarded: false
        }
      ])
      .select()
      .single()

    if (authError) {
      console.error("❌ [Adapter] Error creating user in next-auth:")
      console.error("  Error code:", authError.code)
      console.error("  Error message:", authError.message)
      console.error("  Error details:", authError.details)
      throw authError
    }

    console.log("✅ [Adapter] User successfully created in next-auth:")
    console.log("  User ID:", authUser.id)
    console.log("  Full user data:", JSON.stringify(authUser, null, 2))

    return {
      id: authUser.id,
      name: authUser.name,
      twitter_id: authUser.twitter_id,
      twitter_username: authUser.twitter_username,
      twitter_image: authUser.twitter_image,
      has_onboarded: authUser.has_onboarded
    }
  } catch (error) {
    console.error("❌ [Adapter] Unexpected error during user creation:", error)
    throw error
  }
}

const getUser = async (id: string): Promise<CustomAdapterUser | null> => {
  const { data: user, error: userError } = await authClient
    .from("users")
    .select("*")
    .eq("id", id)
    .single()

  if (userError) return null
  if (!user) return null

  return {
    id: user.id,
    name: user.name,
    twitter_id: user.twitter_id,
    twitter_username: user.twitter_username,
    twitter_image: user.twitter_image,
    bluesky_id: user.bluesky_id,
    bluesky_username: user.bluesky_username,
    bluesky_image: user.bluesky_image,
    has_onboarded: user.has_onboarded
  }
}

const getUserByEmail = async (email) => {
  try {
    const { data, error } = await authClient
      .from("users")
      .select()
      .eq("email", email)
      .single()

    if (error) return null
    return data as CustomAdapterUser
  } catch (error) {
    console.error(" [Adapter] Error getting user by email:", error)
    return null
  }
}

const getUserByAccount = async ({ providerAccountId, provider }): Promise<CustomAdapterUser | null> => {
  try {
    const { data: account, error: accountError } = await authClient
      .from("accounts")
      .select("user_id")
      .eq("provider", provider)
      .eq("provider_account_id", providerAccountId)
      .single()

    if (accountError) return null
    if (!account) return null

    const { data: user, error: userError } = await authClient
      .from("users")
      .select("*")
      .eq("id", account.user_id)
      .single()

    if (userError) return null
    if (!user) return null

    return {
      id: user.id,
      name: user.name,
      twitter_id: user.twitter_id,
      twitter_username: user.twitter_username,
      twitter_image: user.twitter_image,
      bluesky_id: user.bluesky_id,
      bluesky_username: user.bluesky_username,
      bluesky_image: user.bluesky_image,
      has_onboarded: user.has_onboarded
    }
  } catch (error) {
    console.error(" [Adapter] Error getting user by account:", error)
    return null
  }
}

const updateUser = async (user: Partial<CustomAdapterUser>): Promise<CustomAdapterUser> => {
  const { data: updatedUser, error: userError } = await authClient
    .from("users")
    .update({
      name: user.name,
      twitter_id: user.twitter_id,
      twitter_username: user.twitter_username,
      twitter_image: user.twitter_image,
      bluesky_id: user.bluesky_id,
      bluesky_username: user.bluesky_username,
      bluesky_image: user.bluesky_image,
      has_onboarded: user.has_onboarded
    })
    .eq("id", user.id)
    .select()
    .single()

  if (userError) throw userError

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    twitter_id: updatedUser.twitter_id,
    twitter_username: updatedUser.twitter_username,
    twitter_image: updatedUser.twitter_image,
    bluesky_id: updatedUser.bluesky_id,
    bluesky_username: updatedUser.bluesky_username,
    bluesky_image: updatedUser.bluesky_image,
    has_onboarded: updatedUser.has_onboarded
  }
}

const linkAccount = async (account: any) => {
  try {
    // Créer le compte dans next-auth.accounts
    const { error: accountError } = await authClient
      .from("accounts")
      .insert([
        {
          user_id: account.userId,
          type: account.type,
          provider: account.provider,
          provider_account_id: account.providerAccountId,
          refresh_token: account.refresh_token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          id_token: account.id_token,
          session_state: account.session_state,
        }
      ])

    if (accountError) throw accountError

    return account
  } catch (error) {
    console.error(" [Adapter] Error linking account:", error)
    throw error
  }
}

const createSession = async (session) => {
  try {
    const { data, error } = await authClient
      .from("sessions")
      .insert([session])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error(" [Adapter] Error creating session:", error)
    throw error
  }
}

const getSessionAndUser = async (sessionToken: string): Promise<{ session: AdapterSession; user: CustomAdapterUser } | null> => {
  const { data: session, error: sessionError } = await authClient
    .from("sessions")
    .select("*, user:user_id(*)")
    .eq("session_token", sessionToken)
    .single()

  if (sessionError) return null
  if (!session) return null

  const user = session.user as any

  return {
    session: {
      sessionToken: session.session_token,
      userId: session.user_id,
      expires: session.expires
    },
    user: {
      id: user.id,
      name: user.name,
      twitter_id: user.twitter_id,
      twitter_username: user.twitter_username,
      twitter_image: user.twitter_image,
      bluesky_id: user.bluesky_id,
      bluesky_username: user.bluesky_username,
      bluesky_image: user.bluesky_image,
      has_onboarded: user.has_onboarded
    }
  }
}

const updateSession = async (session) => {
  try {
    const { data, error } = await authClient
      .from("sessions")
      .update(session)
      .eq("session_token", session.session_token)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error(" [Adapter] Error updating session:", error)
    throw error
  }
}

const deleteSession = async (sessionToken) => {
  try {
    await authClient
      .from("sessions")
      .delete()
      .eq("session_token", sessionToken)
  } catch (error) {
    console.error(" [Adapter] Error deleting session:", error)
    throw error
  }
}

const getAccountsByUserId = async (userId: string) => {
  try {
    const { data: accounts, error } = await authClient
      .from("accounts")
      .select("*")
      .eq("user_id", userId)

    if (error) throw error
    return accounts
  } catch (error) {
    console.error(" [Adapter] Error getting accounts by user ID:", error)
    return []
  }
}

export const supabaseAdapter = {
  createUser,
  getUser,
  getUserByEmail,
  getUserByAccount,
  updateUser,
  linkAccount,
  createSession,
  getSessionAndUser,
  updateSession,
  deleteSession,
  getAccountsByUserId
}