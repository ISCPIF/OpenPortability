import type {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken
} from "next-auth/adapters"
import type { Profile } from "next-auth"
import { encrypt, decrypt } from './encryption'
import { auth } from '@/app/auth'
import logger from '@/lib/log_utils'
import { pgUserRepository } from './repositories/auth/pg-user-repository'
import { pgAccountRepository } from './repositories/auth/pg-account-repository'
import { pgMastodonInstanceRepository } from './repositories/auth/pg-mastodon-instance-repository'
import type { DBUser } from './types/database'

export interface CustomAdapterUser extends Omit<AdapterUser, 'image'> {
  has_onboarded: boolean
  hqx_newsletter: boolean
  oep_accepted: boolean
  have_seen_newsletter: boolean
  research_accepted: boolean
  automatic_reconnect: boolean
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

/**
 * Convertit un DBUser en CustomAdapterUser
 */
function dbUserToAdapterUser(user: DBUser): CustomAdapterUser {
  return {
    id: user.id,
    name: user.name,
    email: "none",
    emailVerified: null,
    has_onboarded: user.has_onboarded,
    hqx_newsletter: user.hqx_newsletter,
    oep_accepted: user.oep_accepted,
    have_seen_newsletter: user.have_seen_newsletter,
    research_accepted: user.research_accepted,
    automatic_reconnect: user.automatic_reconnect,
    twitter_id: user.twitter_id,
    twitter_username: user.twitter_username,
    twitter_image: user.twitter_image,
    bluesky_id: user.bluesky_id,
    bluesky_username: user.bluesky_username,
    bluesky_image: user.bluesky_image,
    mastodon_id: user.mastodon_id,
    mastodon_username: user.mastodon_username,
    mastodon_image: user.mastodon_image,
    mastodon_instance: user.mastodon_instance
  }
}

export async function createUser(user: Partial<AdapterUser>): Promise<CustomAdapterUser>
export async function createUser(
  userData: Partial<AdapterUser> | (Partial<CustomAdapterUser> & {
    provider?: 'twitter' | 'bluesky' | 'mastodon',
    profile?: ProviderProfile
  })
): Promise<CustomAdapterUser> {

  // Type guard for provider data
  let provider: 'twitter' | 'bluesky' | 'mastodon' | undefined = undefined
  let profile: ProviderProfile | undefined = undefined
  let providerId: string | undefined = undefined
  let mastodonInstance: string | undefined = undefined

  if ('provider' in userData && userData.provider && 'profile' in userData) {
    provider = userData.provider
    profile = userData.profile

    // Extraction de l'ID selon le provider
    if (provider === 'twitter') {
      providerId = (profile as TwitterData).data.id
    } else if (provider === 'mastodon') {
      const mastodonProfile = profile as MastodonProfile
      providerId = mastodonProfile.id
      
      // Parse instance for Mastodon
      try {
        mastodonInstance = new URL(mastodonProfile.url).origin
      } catch (urlError) {
        logger.logError('Auth', 'createUser', 'Error parsing Mastodon URL', undefined, { 
          url: mastodonProfile.url, 
          error: urlError 
        })
        throw new Error(`Invalid Mastodon URL: ${mastodonProfile.url}`)
      }
    } else {
      // Bluesky case
      providerId = (userData as any).bluesky_id || (userData as any).did || (userData as any).profile?.did
    }

    if (!providerId) {
      logger.logError('Auth', 'createUser', 'No provider ID found', undefined, { 
        provider, 
        profile, 
        userData 
      })
      throw new Error(`Could not extract provider ID for ${provider}`)
    }

    const existingUser = await pgUserRepository.getUserByProviderId(provider, providerId)

    // For Mastodon, check if the instance matches
    if (existingUser) {
      if (provider === 'mastodon' && existingUser.mastodon_instance !== mastodonInstance) {
        // Different instance, continue to create new user
      } else {
        return dbUserToAdapterUser(existingUser)
      }
    }

    // If the user is already authenticated and is linking Bluesky, attach Bluesky to the current user
    if (provider === 'bluesky') {
      try {
        const session = await auth()
        const currentUserId = session?.user?.id

        if (currentUserId) {
          // Merge Bluesky data into the existing session user
          const blueskyData = (profile as BlueskyProfile) || (userData as any)
          const updates: Partial<DBUser> = {
            bluesky_id: providerId,
            bluesky_username: (blueskyData as any)?.handle || (blueskyData as any)?.username,
            bluesky_image: (blueskyData as any)?.avatar,
            name: (blueskyData as any)?.displayName || (blueskyData as any)?.name || undefined
          }

          const mergedUser = await pgUserRepository.updateUser(currentUserId, updates)
          return dbUserToAdapterUser(mergedUser)
        }
      } catch (sessionError) {
        logger.logError('Auth', 'createUser', 'Bluesky linking flow - session retrieval failed, will fallback to creation', undefined, { sessionError })
      }
    }

    // Créer les données utilisateur selon le provider
    const userToCreate: Partial<DBUser> = {
      has_onboarded: false,
      hqx_newsletter: false,
      oep_accepted: false,
      have_seen_newsletter: false,
      research_accepted: false,
      automatic_reconnect: false,
    }

    // Extraction du nom selon le provider
    if (provider === 'twitter') {
      userToCreate.name = (profile as TwitterData).data.name
      const twitterData = profile as TwitterData
      Object.assign(userToCreate, {
        twitter_id: twitterData.data.id,
        twitter_username: twitterData.data.username,
        twitter_image: twitterData.data.profile_image_url
      })
    } else if (provider === 'mastodon') {
      userToCreate.name = (profile as MastodonProfile).display_name
      const mastodonData = profile as MastodonProfile
      Object.assign(userToCreate, {
        mastodon_id: mastodonData.id,
        mastodon_username: mastodonData.username,
        mastodon_image: mastodonData.avatar,
        mastodon_instance: mastodonInstance
      })
    } else if (provider === 'bluesky') {
      const blueskyData = profile as BlueskyProfile
      userToCreate.name = blueskyData.displayName || blueskyData.name
      Object.assign(userToCreate, {
        bluesky_id: blueskyData.did || blueskyData.id,
        bluesky_username: blueskyData.handle || blueskyData.username,
        bluesky_image: blueskyData.avatar
      })
    }

    const newUser = await pgUserRepository.createUser(userToCreate)
    return dbUserToAdapterUser(newUser)
  }

  // Fallback pour la création d'utilisateur sans provider
  const userToCreate: Partial<DBUser> = {
    name: userData.name,
    has_onboarded: false,
    hqx_newsletter: false,
    oep_accepted: false,
    have_seen_newsletter: false,
    research_accepted: false,
    automatic_reconnect: false,
    email: 'none'
  }

  const newUser = await pgUserRepository.createUser(userToCreate)
  return dbUserToAdapterUser(newUser)
}

export async function getUser(id: string): Promise<CustomAdapterUser | null> {
  const user = await pgUserRepository.getUser(id)
  if (!user) return null
  return dbUserToAdapterUser(user)
}

export async function getUserByEmail(email: string): Promise<CustomAdapterUser | null> {
  return null
}

export async function getUserByAccount(
  { providerAccountId, provider }: { providerAccountId: string; provider: 'twitter' | 'bluesky' | 'mastodon' | 'piaille' }
): Promise<CustomAdapterUser | null> {

  if (provider === 'mastodon' || provider === 'piaille') {
    // For Mastodon the next auth doesn't handle singularity so we have to overwrite
    return null
  }

  const user = await pgUserRepository.getUserByProviderId(provider, providerAccountId)
  if (!user) return null
  return dbUserToAdapterUser(user)
}

export async function updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<CustomAdapterUser>
export async function updateUser(
  userId: string,
  providerData?: {
    provider: 'twitter' | 'bluesky' | 'mastodon',
    profile: ProviderProfile
  }
): Promise<CustomAdapterUser>
export async function updateUser(
  userOrId: (Partial<AdapterUser> & Pick<AdapterUser, "id">) | string,
  providerData?: {
    provider: 'twitter' | 'bluesky' | 'mastodon',
    profile: ProviderProfile
  }
): Promise<CustomAdapterUser> {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id

  if (!userId) {
    logger.logError('Auth', 'updateUser', 'User ID is required', undefined, { userOrId })
    throw new Error("User ID is required")
  }

  const updates: Partial<DBUser> = {}

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

  const updatedUser = await pgUserRepository.updateUser(userId, updates)
  return dbUserToAdapterUser(updatedUser)
}

// Fonction utilitaire pour décoder les JWT
export function decodeJwt(token: string): { exp: number } | null {
  try {
    const jwt = token.split('.')
    if (jwt.length !== 3) {
      throw new Error('Invalid JWT format')
    }
    
    const payload = JSON.parse(Buffer.from(jwt[1], 'base64').toString())
    return payload
  } catch (error) {
    return null
  }
}

export async function linkAccount(account: AdapterAccount): Promise<void> {  
  // Décoder l'access token pour obtenir l'expiration
  let expires_at = account.expires_at
  if (account.access_token) {
    const payload = decodeJwt(account.access_token)
    if (payload?.exp) {
      expires_at = payload.exp
    }
  }
  
  await pgAccountRepository.upsertAccount({
    user_id: account.userId,
    type: account.type,
    provider: account.provider,
    provider_account_id: account.providerAccountId,
    refresh_token: account.refresh_token ? encrypt(account.refresh_token) : null,
    access_token: account.access_token ? encrypt(account.access_token) : null,
    expires_at,
    token_type: account.token_type,
    scope: account.scope,
    id_token: account.id_token ? encrypt(account.id_token) : null,
    session_state: account.session_state == null ? null : String(account.session_state),
  })
}

export async function createSession(session: {
  sessionToken: string
  userId: string
  expires: Date
}): Promise<AdapterSession> {
  // Sessions not used in this app
  return {
    sessionToken: session.sessionToken,
    userId: session.userId,
    expires: session.expires
  }
}

export async function getSessionAndUser(sessionToken: string): Promise<{ session: AdapterSession; user: CustomAdapterUser } | null> {
  // Sessions not used in this app
  return null
}

export async function updateSession(
  session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">
): Promise<AdapterSession | null | undefined> {
  // Sessions not used in this app
  return null
}

export async function deleteSession(sessionToken: string): Promise<void> {
  // Sessions not used in this app
}

export async function getAccountsByUserId(userId: string): Promise<AdapterAccount[]> {
  const accounts: AdapterAccount[] = []
  const user = await getUser(userId)

  if (!user) {
    logger.logError('Auth', 'getAccountsByUserId', 'User not found', userId)
    return accounts
  }

  if (user.twitter_id) {
    accounts.push({
      provider: 'twitter',
      type: 'oauth',
      providerAccountId: user.twitter_id,
      userId: user.id
    })
  }

  if (user.bluesky_id) {
    accounts.push({
      provider: 'bluesky',
      type: 'oauth',
      providerAccountId: user.bluesky_id,
      userId: user.id
    })
  }

  if (user.mastodon_id) {
    accounts.push({
      provider: 'mastodon',
      type: 'oauth',
      providerAccountId: user.mastodon_id,
      userId: user.id
    })

    // If it's a piaille.fr account, add it as a separate provider
    if (user.mastodon_instance === 'piaille.fr') {
      accounts.push({
        provider: 'piaille',
        type: 'oauth',
        providerAccountId: user.mastodon_id,
        userId: user.id
      })
    }
  }

  return accounts
}

async function unlinkAccountImpl(
  userId: string,
  provider: 'twitter' | 'bluesky' | 'mastodon' | 'piaille'
): Promise<void> {

  const user = await pgUserRepository.getUser(userId)

  if (!user) {
    logger.logError('Auth', 'unlinkAccountImpl', 'Error fetching user', userId, { provider })
    throw new UnlinkError("User not found", "NOT_FOUND", 404)
  }

  // For Piaille, we check mastodon_id
  const dbProvider = provider === 'piaille' ? 'mastodon' : provider
  const providerIdField = `${dbProvider}_id` as keyof DBUser
  if (!user[providerIdField]) {
    throw new UnlinkError("Account not linked", "NOT_LINKED", 400)
  }

  // For Piaille, verify the instance
  if (provider === 'piaille' && user.mastodon_instance !== 'piaille.fr') {
    throw new UnlinkError("Account not linked", "NOT_LINKED", 400)
  }

  // Count linked accounts
  let linkedAccounts = 0
  if (user.twitter_id) linkedAccounts++
  if (user.bluesky_id) linkedAccounts++
  if (user.mastodon_id) linkedAccounts++

  // Prevent unlinking the last account
  if (linkedAccounts === 1) {
    logger.logError('Auth', 'unlinkAccountImpl', 'Cannot unlink the last account', userId, { provider })
    throw new UnlinkError(
      "Cannot unlink the last account. Add another account first.",
      "LAST_ACCOUNT",
      400
    )
  }

  // Delete account entry
  await pgAccountRepository.deleteAccount(provider, user[providerIdField] as string)

  // Update user fields
  const updates: Partial<DBUser> = {
    [`${dbProvider}_id`]: null,
    [`${dbProvider}_username`]: null,
    [`${dbProvider}_image`]: null
  } as any

  if (dbProvider === 'mastodon') {
    updates.mastodon_instance = null
  }

  await pgUserRepository.updateUser(userId, updates)
}

export async function unlinkAccount(
  account: Pick<AdapterAccount, "provider" | "providerAccountId">
): Promise<void> {

  const session = await auth()
  if (!session?.user?.id) {
    logger.logError('Auth', 'unlinkAccount', 'User not found', session?.user?.id, { provider: account.provider, providerAccountId: account.providerAccountId })
    throw new UnlinkError("User not found", "NOT_FOUND", 404)
  }

  const user = await getUser(session.user.id)
  if (!user) {
    logger.logError('Auth', 'unlinkAccount', 'User not found', session?.user?.id, { provider: account.provider, providerAccountId: account.providerAccountId })
    throw new UnlinkError("User not found", "NOT_FOUND", 404)
  }

  await unlinkAccountImpl(user.id, account.provider as 'twitter' | 'bluesky' | 'mastodon')
}

type CustomPgAdapter = Omit<Adapter, 'getUserByAccount' | 'updateUser' | 'createUser' | 'linkAccount'> & {
  getUserByAccount: NonNullable<Adapter['getUserByAccount']>
  updateUser: {
    (user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<CustomAdapterUser>
    (userId: string, providerData?: {
      provider: 'twitter' | 'bluesky' | 'mastodon',
      profile: ProviderProfile
    }): Promise<CustomAdapterUser>
  }
  createUser: {
    (user: Partial<AdapterUser>): Promise<CustomAdapterUser>
    (userData: Partial<AdapterUser> | (Partial<CustomAdapterUser> & {
      provider?: 'twitter' | 'bluesky' | 'mastodon',
      profile?: ProviderProfile
    })): Promise<CustomAdapterUser>
  }
  linkAccount: NonNullable<Adapter['linkAccount']>
  getAccountsByUserId: (userId: string) => Promise<AdapterAccount[]>
}

export const pgAdapter: CustomPgAdapter = {
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
  unlinkAccount,
  getAccountsByUserId
}
