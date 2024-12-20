import { createClient } from "@supabase/supabase-js"
import type {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken
} from "next-auth/adapters"
import type { Profile } from "next-auth"

interface CustomAdapterUser extends Omit<AdapterUser, 'email' | 'emailVerified' | 'image'> {
  has_onboarded: boolean
  twitter_id?: string | null
  twitter_username?: string | null
  twitter_image?: string | null
  bluesky_id?: string | null
  bluesky_username?: string | null
  bluesky_image?: string | null
  mastodon_id?: string | null
  mastodon_username?: string | null
  mastodon_image?: string | null
  mastodon_instance?: string | null
}

export interface TwitterData extends Profile {
  data: {
    id: string
    name: string
    username: string
    profile_image_url: string
  }
}

export interface MastodonProfile extends Profile {
  id: string
  username: string
  display_name: string
  avatar: string
  url: string
}

export interface BlueskyProfile extends Profile {
  did?: string
  id?: string
  handle?: string
  username?: string
  displayName?: string
  name?: string
  avatar?: string
  identifier?: string
}

export type ProviderProfile = TwitterData | MastodonProfile | BlueskyProfile

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

const createUser = async (
  userData: Partial<CustomAdapterUser> & {
    provider?: 'twitter' | 'bluesky' | 'mastodon',
    profile?: ProviderProfile
  }
): Promise<CustomAdapterUser> => {
  console.log("\n=== [Adapter] Starting user creation ===")
  console.log("→ Input user data:", JSON.stringify(userData, null, 2))

  const userToCreate: Partial<CustomAdapterUser> = {
    name: userData.name,
    has_onboarded: false
  }

  // Remplir les champs spécifiques au provider avec les données brutes
  if (userData.provider === 'twitter' && userData.profile) {
    const twitterData = userData.profile as TwitterData
    userToCreate.twitter_id = twitterData.data.id
    userToCreate.twitter_username = twitterData.data.username
    userToCreate.twitter_image = twitterData.data.profile_image_url
    userToCreate.name = twitterData.data.name // Utiliser le nom Twitter comme nom principal

    // Chercher d'abord un utilisateur existant avec ce twitter_id
    const { data: existingUser } = await authClient
      .from('users')
      .select('*')
      .eq('twitter_id', twitterData.data.id)
      .single()

    if (existingUser) {
      console.log("→ Found existing user with Twitter ID:", existingUser.id)
      return existingUser as CustomAdapterUser
    }
  } 
  else if (userData.provider === 'mastodon' && userData.profile) {
    const mastodonData = userData.profile as MastodonProfile
    console.log("Mastodon data:", mastodonData)
    userToCreate.mastodon_id = mastodonData.id
    userToCreate.mastodon_username = mastodonData.username
    userToCreate.mastodon_image = mastodonData.avatar
    userToCreate.mastodon_instance = mastodonData.url ? new URL(mastodonData.url).origin : null
    userToCreate.name = mastodonData.display_name // Utiliser le display_name Mastodon comme nom principal

    // Chercher d'abord un utilisateur existant avec ce mastodon_id
    const { data: existingUser } = await authClient
      .from('users')
      .select('*')
      .eq('mastodon_id', mastodonData.id)
      .single()

    if (existingUser) {
      console.log("→ Found existing user with Mastodon ID:", existingUser.id)
      return existingUser as CustomAdapterUser
    }
  }
  else if (userData.provider === 'bluesky' && userData.profile) {
    const blueskyData = userData.profile as BlueskyProfile
    userToCreate.bluesky_id = blueskyData.did || blueskyData.id
    userToCreate.bluesky_username = blueskyData.handle || blueskyData.username
    userToCreate.bluesky_image = blueskyData.avatar
    userToCreate.name = blueskyData.displayName || blueskyData.name // Utiliser le displayName Bluesky comme nom principal

    // Chercher d'abord un utilisateur existant avec ce bluesky_id
    const { data: existingUser } = await authClient
      .from('users')
      .select('*')
      .eq('bluesky_id', userToCreate.bluesky_id)
      .single()

    if (existingUser) {
      console.log("→ Found existing user with Bluesky ID:", existingUser.id)
      return existingUser as CustomAdapterUser
    }
  }

  // Si aucun utilisateur existant n'a été trouvé, créer un nouveau
  console.log("→ Creating new user with data:", userToCreate)
  const { data: newUser, error: createError } = await authClient
    .from('users')
    .insert([userToCreate])
    .select()
    .single()

  if (createError) {
    console.error("Error creating user:", createError)
    throw new Error(createError.message)
  }

  return newUser as CustomAdapterUser
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
    mastodon_id: user.mastodon_id,
    mastodon_username: user.mastodon_username,
    mastodon_image: user.mastodon_image,
    mastodon_instance: user.mastodon_instance,
    has_onboarded: user.has_onboarded
  }
}

const getUserByEmail = async (email) => {
  try {
    console.log("\n=== [Adapter] getUserByEmail ===")
    console.log("→ Looking for user with email:", email)

    const { data, error } = await authClient
      .from("users")
      .select()
      .eq("email", email)
      .single()

    if (error) {
      console.log("❌ User not found:", error.message)
      return null
    }

    console.log("✅ User found:", data)
    return data as CustomAdapterUser
  } catch (error) {
    console.error(" [Adapter] Error getting user by email:", error)
    return null
  }
}

const getUserByAccount = async ({ providerAccountId, provider }): Promise<CustomAdapterUser | null> => {
  try {
    console.log("\n=== [Adapter] getUserByAccount ===")
    console.log("→ Looking for account with:", { provider, providerAccountId })

    const { data: account, error: accountError } = await authClient
      .from("accounts")
      .select("user_id")
      .eq("provider", provider)
      .eq("provider_account_id", providerAccountId)
      .single()

    if (accountError) {
      console.log("❌ Account not found:", accountError.message)
      return null
    }
    if (!account) {
      console.log("❌ No account found")
      return null
    }

    console.log("✅ Account found:", account)

    const { data: user, error: userError } = await authClient
      .from("users")
      .select("*")
      .eq("id", account.user_id)
      .single()

    if (userError) {
      console.log("❌ User not found:", userError.message)
      return null
    }
    if (!user) {
      console.log("❌ No user found")
      return null
    }

    console.log("✅ User found:", user)
    return {
      id: user.id,
      name: user.name,
      twitter_id: user.twitter_id,
      twitter_username: user.twitter_username,
      twitter_image: user.twitter_image,
      bluesky_id: user.bluesky_id,
      bluesky_username: user.bluesky_username,
      bluesky_image: user.bluesky_image,
      mastodon_id: user.mastodon_id,
      mastodon_username: user.mastodon_username,
      mastodon_image: user.mastodon_image,
      mastodon_instance: user.mastodon_instance,
      has_onboarded: user.has_onboarded
    }
  } catch (error) {
    console.error("❌ [Adapter] Error getting user by account:", error)
    return null
  }
}

const updateUser = async (
  userId: string,
  providerData?: {
    provider: 'twitter' | 'bluesky' | 'mastodon',
    profile: ProviderProfile
  }
): Promise<CustomAdapterUser> => {
  console.log("\n=== [Adapter] Starting user update ===")
  console.log("→ User ID:", userId)
  console.log("→ Provider data:", JSON.stringify(providerData, null, 2))

  if (!userId) {
    throw new Error("User ID is required")
  }

  const updates: Partial<CustomAdapterUser> = {}

  if (providerData?.provider === 'twitter' && providerData.profile && 'data' in providerData.profile) {
    const twitterData = providerData.profile.data
    updates.twitter_id = twitterData.id
    updates.twitter_username = twitterData.username
    updates.twitter_image = twitterData.profile_image_url
    updates.name = twitterData.name
  }
  else if (providerData?.provider === 'mastodon' && providerData.profile && 'url' in providerData.profile) {
    const mastodonData = providerData.profile
    updates.mastodon_id = mastodonData.id
    updates.mastodon_username = mastodonData.username
    updates.mastodon_image = mastodonData.avatar
    updates.mastodon_instance = mastodonData.url ? new URL(mastodonData.url).origin : null
    updates.name = mastodonData.display_name
  }
  else if (providerData?.provider === 'bluesky' && providerData.profile) {
    const blueskyData = providerData.profile as BlueskyProfile
    updates.bluesky_id = blueskyData.did || blueskyData.id
    updates.bluesky_username = blueskyData.handle || blueskyData.username || blueskyData.identifier
    updates.bluesky_image = blueskyData.avatar
    updates.name = blueskyData.displayName || blueskyData.name
  }

  const { data: user, error: updateError } = await authClient
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select()
    .single()

  if (updateError) {
    console.error("Error updating user:", updateError)
    throw new Error(updateError.message)
  }

  return user as CustomAdapterUser
}

const linkAccount = async (account: AdapterAccount): Promise<void> => {
  console.log("\n=== [Adapter] linkAccount ===")
  console.log("→ Linking account:", JSON.stringify(account, null, 2))
  
  const { error } = await authClient
    .from("accounts")
    .insert([{
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
    }])

  if (error) {
    console.log("❌ Error linking account:", error)
    throw error
  }

  console.log("✅ Account linked successfully")
}

const createSession = async (session) => {
  try {
    console.log("\n=== [Adapter] createSession ===")
    console.log("→ Creating session:", session)

    const { data, error } = await authClient
      .from("sessions")
      .insert([session])
      .select()
      .single()

    if (error) {
      console.log("❌ Error creating session:", error)
      throw error
    }

    console.log("✅ Session created:", data)
    return data
  } catch (error) {
    console.error("❌ [Adapter] Error creating session:", error)
    throw error
  }
}

const getSessionAndUser = async (sessionToken: string): Promise<{ session: AdapterSession; user: CustomAdapterUser } | null> => {
  console.log("\n=== [Adapter] getSessionAndUser ===")
  console.log("→ Looking for session with token:", sessionToken)

  const { data: session, error: sessionError } = await authClient
    .from("sessions")
    .select("*, user:user_id(*)")
    .eq("session_token", sessionToken)
    .single()

  if (sessionError) {
    console.log("❌ Session not found:", sessionError.message)
    return null
  }
  if (!session) {
    console.log("❌ No session found")
    return null
  }

  console.log("✅ Session found:", session)

  const user = session.user as any

  console.log("✅ User found:", user)
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
      mastodon_id: user.mastodon_id,
      mastodon_username: user.mastodon_username,
      mastodon_image: user.mastodon_image,
      mastodon_instance: user.mastodon_instance,
      has_onboarded: user.has_onboarded
    }
  }
}

const updateSession = async (session) => {
  console.log("\n=== [Adapter] updateSession ===")
  console.log("→ Updating session with token:", session.session_token)

  try {
    const { data, error } = await authClient
      .from("sessions")
      .update(session)
      .eq("session_token", session.session_token)
      .select()
      .single()

    if (error) {
      console.log("❌ Error updating session:", error)
      throw error
    }

    console.log("✅ Session updated:", data)
    return data
  } catch (error) {
    console.error("❌ [Adapter] Error updating session:", error)
    throw error
  }
}

const deleteSession = async (sessionToken) => {
  console.log("\n=== [Adapter] deleteSession ===")
  console.log("→ Deleting session with token:", sessionToken)

  try {
    await authClient
      .from("sessions")
      .delete()
      .eq("session_token", sessionToken)
  } catch (error) {
    console.error("❌ [Adapter] Error deleting session:", error)
    throw error
  }
}

const getAccountsByUserId = async (userId: string) => {
  console.log("\n=== [Adapter] getAccountsByUserId ===")
  console.log("→ Looking for accounts with user ID:", userId)

  try {
    const { data: accounts, error } = await authClient
      .from("accounts")
      .select("*")
      .eq("user_id", userId)

    if (error) {
      console.log("❌ Error getting accounts:", error.message)
      throw error
    }

    console.log("✅ Accounts found:", accounts)
    return accounts
  } catch (error) {
    console.error("❌ [Adapter] Error getting accounts by user ID:", error)
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