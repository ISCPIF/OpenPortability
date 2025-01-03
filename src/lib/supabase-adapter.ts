import { createClient } from "@supabase/supabase-js"
import type {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken
} from "next-auth/adapters"
import type { Profile } from "next-auth"

export interface CustomAdapterUser extends Omit<AdapterUser, 'image'> {
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

export class UnlinkError extends Error {
  constructor(
    message: string,
    public code: 'LAST_ACCOUNT' | 'NOT_FOUND' | 'NOT_LINKED' | 'DATABASE_ERROR',
    public status: number = 400
  ) {
    super(message)
    this.name = 'UnlinkError'
  }
}

// Create Supabase clients
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

export async function createUser(user: Partial<AdapterUser>): Promise<CustomAdapterUser>;
export async function createUser(
  userData: Partial<AdapterUser> | (Partial<CustomAdapterUser> & {
    provider?: 'twitter' | 'bluesky' | 'mastodon',
    profile?: ProviderProfile
  })
): Promise<CustomAdapterUser> {
  console.log("\n=== [Adapter] Starting user creation ===")
  console.log("→ Input user data:", JSON.stringify(userData, null, 2))

  // Type guard for provider data
  if ('provider' in userData && userData.provider && 'profile' in userData) {
    const provider = userData.provider
    const profile = userData.profile


const providerIdField = `${provider}_id` as keyof CustomAdapterUser
    const providerId = provider === 'twitter' 
      ? (profile as TwitterData).data.id
      : provider === 'mastodon'
      ? (profile as MastodonProfile).id
      : (userData as any).bluesky_id || (userData as any).did // Try both fields

    console.log('Looking for existing user with provider ID:', providerId)
    const { data: existingUser } = await authClient
      .from('users')
      .select('*')
      .eq(providerIdField, providerId)
      .single()

    if (existingUser) {
      console.log(`→ Found existing user with ${provider} ID:`, existingUser.id)
      return existingUser as CustomAdapterUser
    }

 // Créer les données utilisateur selon le provider
    const userToCreate: Partial<CustomAdapterUser> = {
      name: provider === 'twitter' 
        ? (profile as TwitterData).data.name
        : provider === 'mastodon'
        ? (profile as MastodonProfile).display_name
        : (userData as BlueskyProfile).displayName || (userData as BlueskyProfile).name,
      has_onboarded: false,
      email: undefined
    }

    // Ajouter les champs spécifiques au provider
    if (provider === 'twitter') {
      const twitterData = profile as TwitterData
      Object.assign(userToCreate, {
        twitter_id: twitterData.data.id,
        twitter_username: twitterData.data.username,
        twitter_image: twitterData.data.profile_image_url
      })
    } else if (provider === 'mastodon') {
      const mastodonData = profile as MastodonProfile
      Object.assign(userToCreate, {
        mastodon_id: mastodonData.id,
        mastodon_username: mastodonData.username,
        mastodon_image: mastodonData.avatar,
        mastodon_instance: mastodonData.url ? new URL(mastodonData.url).origin : null
      })
    } else if (provider === 'bluesky') {
      const blueskyData = profile as BlueskyProfile
      Object.assign(userToCreate, {
        bluesky_id: blueskyData.did,
        bluesky_username: blueskyData.handle,
        bluesky_image: blueskyData.avatar
      })
    }

    console.log(`→ Creating new ${provider} user with data:`, userToCreate)
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

  // Fallback pour la création d'utilisateur sans provider
  const userToCreate: Partial<CustomAdapterUser> = {
    name: userData.name,
    has_onboarded: false,
    email: 'none'
  }

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

export async function getUser(id: string): Promise<CustomAdapterUser | null> {
  const { data: user, error: userError } = await authClient
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (userError) {
    console.error("Error fetching user:", userError)
    return null
  }

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
    has_onboarded: user.has_onboarded,
    email: "none",
    emailVerified: null
  }
}

export async function getUserByEmail(email: string): Promise<CustomAdapterUser | null> {
  return null
}

export async function getUserByAccount({ providerAccountId, provider }): Promise<CustomAdapterUser | null> {
  let column: string
  if (provider === 'twitter') {
    column = 'twitter_id'
  } else if (provider === 'mastodon') {
    column = 'mastodon_id'
  } else if (provider === 'bluesky') {
    column = 'bluesky_id'
  } else {
    return null
  }

  const { data: user, error: userError } = await authClient
    .from('users')
    .select('*')
    .eq(column, providerAccountId)
    .single()

  if (userError) {
    console.error("Error fetching user by account:", userError)
    return null
  }

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
    has_onboarded: user.has_onboarded,
    email: "none",
    emailVerified: null
  }
}

export async function updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<CustomAdapterUser>;
export async function updateUser(
  userId: string,
  providerData?: {
    provider: 'twitter' | 'bluesky' | 'mastodon',
    profile: ProviderProfile
  }
): Promise<CustomAdapterUser>;
export async function updateUser(
  userOrId: (Partial<AdapterUser> & Pick<AdapterUser, "id">) | string,
  providerData?: {
    provider: 'twitter' | 'bluesky' | 'mastodon',
    profile: ProviderProfile
  }
): Promise<CustomAdapterUser> {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
  console.log("\n=== [Adapter] Starting user update ===")
  console.log("→ User ID:", userId)
  console.log("→ Provider data:", JSON.stringify(providerData, null, 2))

  if (!userId) {
    throw new Error("User ID is required")
  }

  const updates: Partial<CustomAdapterUser> = {}

  if (providerData?.provider === 'twitter' && providerData.profile && 'data' in providerData.profile) {
    const twitterData = providerData.profile as TwitterData
    if (twitterData.data) {
      updates.twitter_id = twitterData.data.id
      updates.twitter_username = twitterData.data.username
      updates.twitter_image = twitterData.data.profile_image_url
      updates.name = twitterData.data.name
    }
  }
  else if (providerData?.provider === 'mastodon' && providerData.profile) {
    const mastodonData = providerData.profile as MastodonProfile
    updates.mastodon_id = mastodonData.id
    updates.mastodon_username = mastodonData.username
    updates.mastodon_image = mastodonData.avatar
    updates.mastodon_instance = new URL(mastodonData.url).origin
    updates.name = mastodonData.display_name || mastodonData.username
  }
  else if (providerData?.provider === 'bluesky' && providerData.profile) {
    const blueskyData = providerData.profile as BlueskyProfile
    updates.bluesky_id = blueskyData.did || blueskyData.id
    updates.bluesky_username = blueskyData.handle || blueskyData.username
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
    // Check if user exists
    const { data: existingUser, error: checkError } = await authClient
      .from("users")
      .select()
      .eq("id", userId)
      .single()
    
    if (checkError) {
      console.error("Error checking user existence:", checkError)
    } else {
      console.log("Existing user:", existingUser)
    }
    throw updateError
  }

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
    has_onboarded: user.has_onboarded,
    email: "none",
    emailVerified: null
  }
}

export async function linkAccount(account: AdapterAccount): Promise<void>
{
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

export async function createSession(session: {
  sessionToken: string
  userId: string
  expires: Date
}): Promise<AdapterSession> {
  const { data: newSession, error: createError } = await authClient
    .from('sessions')
    .insert([session])
    .select()
    .single()

  if (createError) throw createError

  return newSession
}

export async function getSessionAndUser(sessionToken: string): Promise<{ session: AdapterSession; user: CustomAdapterUser } | null> {
  const { data: session, error: sessionError } = await authClient
    .from('sessions')
    .select('*, user:users(*)')
    .eq('sessionToken', sessionToken)
    .single()

  if (sessionError) return null
  if (!session) return null

  const { user, ...sessionData } = session

  return {
    session: sessionData,
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
      has_onboarded: user.has_onboarded,
      email: "none",
      emailVerified: null
    }
  }
}

export async function updateSession(
  session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">
): Promise<AdapterSession | null | undefined> {
  const { data: updatedSession, error: updateError } = await authClient
    .from('sessions')
    .update(session)
    .eq('sessionToken', session.sessionToken)
    .select()
    .single()

  if (updateError) throw updateError

  return updatedSession
}

export async function deleteSession(sessionToken: string): Promise<void> {
  const { error: deleteError } = await authClient
    .from('sessions')
    .delete()
    .eq('sessionToken', sessionToken)

  if (deleteError) throw deleteError
}

export async function getAccountsByUserId(userId: string): Promise<AdapterAccount[]> {
  const accounts: AdapterAccount[] = []
  const user = await getUser(userId)

  if (!user) return accounts

  if (user.twitter_id) {
    accounts.push({
      provider: 'twitter',
      type: 'oauth',
      providerAccountId: user.twitter_id,
      userId: user.id
    })
  }

  return accounts
}


// Internal implementation with your existing logic
async function unlinkAccountImpl(
  userId: string,
  provider: 'twitter' | 'bluesky' | 'mastodon'
): Promise<void> {
  console.log("\n=== [Adapter] Starting account unlinking ===")
  console.log("→ User ID:", userId)
  console.log("→ Provider:", provider)

  // Get current user
  const { data: user, error: userError } = await authClient
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (userError) {
    console.error("Error fetching user:", userError)
    throw new UnlinkError("User not found", "NOT_FOUND", 404)
  }

  if (!user) {
    throw new UnlinkError("User not found", "NOT_FOUND", 404)
  }

  // Check if the account is actually linked
  const providerIdField = `${provider}_id`
  if (!user[providerIdField]) {
    throw new UnlinkError("Account not linked", "NOT_LINKED", 400)
  }

  // Count linked accounts
  let linkedAccounts = 0
  if (user.twitter_id) linkedAccounts++
  if (user.bluesky_id) linkedAccounts++
  if (user.mastodon_id) linkedAccounts++

  // Prevent unlinking the last account
  if (linkedAccounts === 1) {
    throw new UnlinkError(
      "Cannot unlink the last account. Add another account first.",
      "LAST_ACCOUNT",
      400
    )
  }

    // Delete account entry
    const { error: deleteError } = await authClient
    .from('accounts')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider)

  if (deleteError) {
    console.error("Error deleting account:", deleteError)
    throw new UnlinkError("Database error", "DATABASE_ERROR", 500)
  }

  // Prepare update data
  const updates: any = {
    [`${provider}_id`]: null,
    [`${provider}_username`]: null,
    [`${provider}_image`]: null
  }
  if (provider === 'mastodon') {
    updates.mastodon_instance = null
  }

  // Update user
  const { error: updateError } = await authClient
    .from('users')
    .update(updates)
    .eq('id', userId)

  if (updateError) {
    console.error("Error updating user:", updateError)
    throw new UnlinkError("Database error", "DATABASE_ERROR", 500)
  }

  console.log("→ Account unlinked successfully")
}

export async function unlinkAccount(
  userId: string,
  provider: 'twitter' | 'bluesky' | 'mastodon'
): Promise<void> {
  console.log("\n=== [Adapter] Starting account unlinking ===")
  console.log("User ID:", userId)
  console.log("Provider:", provider)

  const user = await getUser(userId)
  if (!user) {
    throw new UnlinkError("User not found", "NOT_FOUND", 404)
  }

  await unlinkAccountImpl(userId, provider)
}

type CustomSupabaseAdapter = Omit<Adapter, 'getUserByAccount' | 'updateUser' | 'createUser' | 'linkAccount'> & {
  getUserByAccount: NonNullable<Adapter['getUserByAccount']>;
  updateUser: {
    (user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<CustomAdapterUser>;
    (userId: string, providerData?: {
      provider: 'twitter' | 'bluesky' | 'mastodon',
      profile: ProviderProfile
    }): Promise<CustomAdapterUser>;
  };
  createUser: {
    (user: Partial<AdapterUser>): Promise<CustomAdapterUser>;
    (userData: Partial<AdapterUser> | (Partial<CustomAdapterUser> & {
      provider?: 'twitter' | 'bluesky' | 'mastodon',
      profile?: ProviderProfile
    })): Promise<CustomAdapterUser>;
  };
  linkAccount: NonNullable<Adapter['linkAccount']>;
}


export const supabaseAdapter: CustomSupabaseAdapter = {
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
  unlinkAccount
}