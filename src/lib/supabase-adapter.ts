import { createClient } from "@supabase/supabase-js"
import { authClient } from "@/lib/supabase"
import type {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken
} from "next-auth/adapters"
import type { Profile } from "next-auth"
import { encrypt, decrypt } from './encryption';
import { auth } from '@/app/auth';
import logger, {logInfo, withLogging } from '@/lib/log_utils';

export interface CustomAdapterUser extends Omit<AdapterUser, 'image'> {
  has_onboarded: boolean
  hqx_newsletter: boolean
  oep_accepted: boolean
  have_seen_newsletter: boolean
  // have_seen_bot_newsletter: boolean
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
  facebook_id?: string | null
  facebook_image?: string | null
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

export interface FacebookProfile extends Profile {
  id: string;
  name: string;
  email?: string;  
  picture?: {
    data: {
      url: string;
    }
  };
}


export type ProviderProfile = TwitterData | MastodonProfile | BlueskyProfile | FacebookProfile

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


export async function createUser(user: Partial<AdapterUser>): Promise<CustomAdapterUser>;
export async function createUser(
  userData: Partial<AdapterUser> | (Partial<CustomAdapterUser> & {
    provider?: 'twitter' | 'bluesky' | 'mastodon' | 'facebook',
    profile?: ProviderProfile
  })
): Promise<CustomAdapterUser> {
  console.log('Auth', 'createUser', 'Starting user creation', undefined, { userData })
  console.log('Auth', 'createUser', 'userData type check', undefined, { 
    hasProvider: 'provider' in userData,
    hasProfile: 'profile' in userData,
    provider: ('provider' in userData) ? userData.provider : 'N/A'
  })

  // Vérification spéciale pour Mastodon
  if ('provider' in userData && 
    'profile' in userData && 
    userData.provider === 'mastodon' && 
    userData.profile) {
    
    console.log('Auth', 'createUser', 'Entering Mastodon-specific flow', undefined)
    
    const mastodonProfile = userData.profile as MastodonProfile
    console.log('Auth', 'createUser', 'Mastodon profile extracted', undefined, { mastodonProfile })
    
    let instance: string;
    try {
      instance = new URL(mastodonProfile.url).origin
      console.log('Auth', 'createUser', 'Mastodon instance parsed successfully', undefined, { 
        originalUrl: mastodonProfile.url, 
        parsedInstance: instance 
      })
    } catch (urlError) {
      console.error('Auth', 'createUser', 'Error parsing Mastodon URL', undefined, { 
        url: mastodonProfile.url, 
        error: urlError 
      })
      throw new Error(`Invalid Mastodon URL: ${mastodonProfile.url}`)
    }

    console.log('Auth', 'createUser', 'Starting Mastodon user existence check', undefined, { 
      mastodonId: mastodonProfile.id, 
      instance 
    })

    // Vérifier si un utilisateur existe déjà avec cet ID et cette instance
    const { data: existingUser, error } = await authClient
      .from('users')
      .select('*, twitter_id::text')
      .eq('mastodon_id', mastodonProfile.id)
      .eq('mastodon_instance', instance)
      .single()

    console.log('Auth', 'createUser', 'Mastodon user existence check completed', undefined, { 
      foundUser: !!existingUser,
      hasError: !!error,
      errorType: error?.code || 'none'
    })

    if (error) {
      if (error.details?.includes('The result contains 0 rows')) {
        logger.logWarning('Auth', 'createUser', 
          `No existing user found with Mastodon ID: ${mastodonProfile.id} and instance: ${instance}`, 
          undefined, 
          { mastodonProfile, instance }
        );
        console.log('Auth', 'createUser', 'No existing Mastodon user found (expected)', undefined)
      } else {
        logger.logError('Auth', 'createUser', 'Error checking for existing Mastodon user', undefined, { error });
        console.error('Auth', 'createUser', 'Unexpected error during Mastodon user check', undefined, { error })
      }
    }

    if (existingUser) {
      console.log('Auth', 'createUser', 'Returning existing Mastodon user', undefined, { 
        userId: existingUser.id,
        username: existingUser.mastodon_username 
      })
      
      return {
        id: existingUser.id,
        name: existingUser.name || null,
        email: "none",
        emailVerified: null,
        has_onboarded: existingUser.has_onboarded,
        hqx_newsletter: existingUser.hqx_newsletter,
        oep_accepted: existingUser.oep_accepted,
        have_seen_newsletter: existingUser.have_seen_newsletter,
        research_accepted: existingUser.research_accepted,
        automatic_reconnect: existingUser.automatic_reconnect,
        twitter_id: existingUser.twitter_id,
        twitter_username: existingUser.twitter_username,
        twitter_image: existingUser.twitter_image,
        bluesky_id: existingUser.bluesky_id,
        bluesky_username: existingUser.bluesky_username,
        bluesky_image: existingUser.bluesky_image,
        mastodon_id: existingUser.mastodon_id,
        mastodon_username: existingUser.mastodon_username,
        mastodon_image: existingUser.mastodon_image,
        mastodon_instance: existingUser.mastodon_instance,
        facebook_id: existingUser.facebook_id
      }
    }
    
    console.log('Auth', 'createUser', 'No existing Mastodon user found, continuing to general flow', undefined)
  }

  console.log('Auth', 'createUser', 'Starting general provider flow', undefined)

  // Type guard for provider data
  let provider: 'twitter' | 'bluesky' | 'mastodon' | 'facebook' | undefined = undefined;
  let profile: ProviderProfile | undefined = undefined;
  let providerId: string | undefined = undefined;
  let providerIdField: keyof CustomAdapterUser | undefined = undefined;

  if ('provider' in userData && userData.provider && 'profile' in userData) {
    provider = userData.provider;
    profile = userData.profile;
    
    console.log('Auth', 'createUser', 'Provider and profile detected', undefined, { 
      provider,
      profileKeys: profile ? Object.keys(profile) : 'no profile'
    })

    providerIdField = `${provider}_id` as keyof CustomAdapterUser;
    
    console.log('Auth', 'createUser', 'Determining provider ID', undefined, { 
      provider,
      providerIdField
    })

    // Extraction de l'ID selon le provider
    if (provider === 'twitter') {
      providerId = (profile as TwitterData).data.id;
      console.log('Auth', 'createUser', 'Twitter ID extracted', undefined, { 
        providerId,
        twitterData: (profile as TwitterData).data
      })
    } else if (provider === 'mastodon') {
      providerId = (profile as MastodonProfile).id;
      console.log('Auth', 'createUser', 'Mastodon ID extracted', undefined, { 
        providerId,
        mastodonProfile: profile as MastodonProfile
      })
    } else if (provider === 'facebook') {
      providerId = (profile as FacebookProfile).id;
      console.log('Auth', 'createUser', 'Facebook ID extracted', undefined, { 
        providerId,
        facebookProfile: profile as FacebookProfile
      })
    } else {
      // Bluesky case - handle both possible data structures
      console.log("userData from BS -->", userData)
      providerId = (userData as any).bluesky_id || (userData as any).did || (userData as any).profile?.did;
      console.log('Auth', 'createUser', 'Bluesky ID extracted', undefined, { 
        providerId,
        blueskyId: (userData as any).bluesky_id,
        did: (userData as any).did,
        profileDid: (userData as any).profile?.did,
        userData: userData
      })
    }

    console.log('Auth', 'createUser', 'Final provider info', undefined, { 
      provider, 
      providerId, 
      providerIdField,
      hasValidProviderId: !!providerId
    })

    if (!providerId) {
      console.error('Auth', 'createUser', 'No provider ID found', undefined, { 
        provider, 
        profile, 
        userData 
      })
      throw new Error(`Could not extract provider ID for ${provider}`)
    }

    console.log('Auth', 'createUser', 'Checking for existing user with provider ID', undefined, { 
      provider, 
      providerId, 
      providerIdField 
    })

    const { data: existingUser, error: existingUserError } = await authClient
      .from('users')
      .select('*, twitter_id::text')
      .eq(providerIdField, providerId)
      .single()

    console.log('Auth', 'createUser', 'Provider user existence check completed', undefined, { 
      foundUser: !!existingUser,
      hasError: !!existingUserError,
      errorCode: existingUserError?.code,
      errorMessage: existingUserError?.message
    })

    if (existingUser) {
      console.log('Auth', 'createUser', 'Returning existing provider user', undefined, { 
        userId: existingUser.id,
        provider
      })
      return existingUser as CustomAdapterUser
    }
    else if (existingUserError) {
      if (existingUserError.details?.includes('The result contains 0 rows')) {
        logger.logWarning('Auth', 'createUser', 
          `No existing user found with ${provider} ID: ${providerId}`, 
          undefined, 
          { provider, providerId }
        );
        console.log('Auth', 'createUser', 'No existing provider user found (expected)', undefined)
      } else {
        logger.logError('Auth', 'createUser', 'Error checking for existing user', undefined, { 
          provider, 
          providerId, 
          error: existingUserError 
        })
        console.error('Auth', 'createUser', 'Unexpected error during provider user check', undefined, { 
          existingUserError 
        })
      }
    }

    // If the user is already authenticated and is linking Bluesky, attach Bluesky to the current user
    if (provider === 'bluesky') {
      try {
        const session = await auth();
        const currentUserId = session?.user?.id;
        console.log('Auth', 'createUser', 'Bluesky linking flow - session check', currentUserId, { hasSession: !!currentUserId });

        if (currentUserId) {
          // Merge Bluesky data into the existing session user instead of creating a new user
          const blueskyData = (profile as BlueskyProfile) || (userData as any);
          const updates: Partial<CustomAdapterUser> = {
            bluesky_id: providerId,
            bluesky_username: (blueskyData as any)?.handle || (blueskyData as any)?.username,
            bluesky_image: (blueskyData as any)?.avatar,
            name: (blueskyData as any)?.displayName || (blueskyData as any)?.name || undefined
          };

          const { data: mergedUser, error: mergeError } = await authClient
            .from('users')
            .update(updates)
            .eq('id', currentUserId)
            .select('*, twitter_id::text')
            .single();

          if (mergeError) {
            logger.logError('Auth', 'createUser', 'Error merging Bluesky into existing user', currentUserId, { providerId, mergeError, updates });
            throw mergeError;
          }

          console.log('Auth', 'createUser', 'Bluesky linked to existing user', currentUserId, { providerId });
          return mergedUser as CustomAdapterUser;
        }
      } catch (sessionError) {
        console.log('Auth', 'createUser', 'Bluesky linking flow - session retrieval failed, will fallback to creation', undefined, { sessionError });
      }
    }

    console.log('Auth', 'createUser', 'Creating new user data for provider', undefined, { provider })

    // Créer les données utilisateur selon le provider
    const userToCreate: Partial<CustomAdapterUser> = {
      has_onboarded: false,
      hqx_newsletter: false,
      oep_accepted: false,
      have_seen_newsletter: false,
      research_accepted: false,
      automatic_reconnect: false,
    }

    // Extraction du nom selon le provider
    if (provider === 'twitter') {
      userToCreate.name = (profile as TwitterData).data.name;
      console.log('Auth', 'createUser', 'Twitter name extracted', undefined, { 
        name: userToCreate.name 
      })
    } else if (provider === 'mastodon') {
      userToCreate.name = (profile as MastodonProfile).display_name;
      console.log('Auth', 'createUser', 'Mastodon name extracted', undefined, { 
        name: userToCreate.name 
      })
    } else if (provider === 'facebook') {
      userToCreate.name = (profile as FacebookProfile).name;
      console.log('Auth', 'createUser', 'Facebook data extracted', undefined, { 
        name: userToCreate.name,
      })
    } else {
      // Bluesky
      userToCreate.name = (userData as BlueskyProfile).displayName || (userData as BlueskyProfile).name;
      console.log('Auth', 'createUser', 'Bluesky name extracted', undefined, { 
        name: userToCreate.name,
        displayName: (userData as BlueskyProfile).displayName,
        fallbackName: (userData as BlueskyProfile).name
      })
    }

    console.log('Auth', 'createUser', 'Adding provider-specific fields', undefined, { provider })

    // Ajouter les champs spécifiques au provider
    if (provider === 'twitter') {
      const twitterData = profile as TwitterData
      Object.assign(userToCreate, {
        twitter_id: twitterData.data.id,
        twitter_username: twitterData.data.username,
        twitter_image: twitterData.data.profile_image_url
      })
      console.log('Auth', 'createUser', 'Twitter fields added', undefined, { 
        twitter_id: twitterData.data.id,
        twitter_username: twitterData.data.username,
        has_image: !!twitterData.data.profile_image_url
      })
    } else if (provider === 'mastodon') {
      const mastodonData = profile as MastodonProfile
      const mastodonInstance = mastodonData.url ? new URL(mastodonData.url).origin : null
      Object.assign(userToCreate, {
        mastodon_id: mastodonData.id,
        mastodon_username: mastodonData.username,
        mastodon_image: mastodonData.avatar,
        mastodon_instance: mastodonInstance
      })
      console.log('Auth', 'createUser', 'Mastodon fields added', undefined, { 
        mastodon_id: mastodonData.id,
        mastodon_username: mastodonData.username,
        mastodon_instance: mastodonInstance,
        has_image: !!mastodonData.avatar
      })
    } else if (provider === 'facebook') {
      const facebookData = profile as FacebookProfile
      Object.assign(userToCreate, {
        facebook_id: facebookData.id,
        facebook_image: facebookData.picture?.data?.url
      })
      console.log('Auth', 'createUser', 'Facebook fields added', undefined, { 
        facebook_id: facebookData.id,
        has_image: !!facebookData.picture?.data?.url
      })
    } else if (provider === 'bluesky') {
      const blueskyData = profile as BlueskyProfile
      Object.assign(userToCreate, {
        bluesky_id: blueskyData.did,
        bluesky_username: blueskyData.handle,
        bluesky_image: blueskyData.avatar
      })
      console.log('Auth', 'createUser', 'Bluesky fields added', undefined, { 
        bluesky_id: blueskyData.did,
        bluesky_username: blueskyData.handle,
        has_image: !!blueskyData.avatar
      })
    }

    console.log('Auth', 'createUser', 'Final user data to create', undefined, { 
      userToCreate,
      fieldsCount: Object.keys(userToCreate).length
    })

    console.log('Auth', 'createUser', 'Attempting to insert new user into database', undefined)

    const { data: newUser, error: createError } = await authClient
      .from('users')
      .insert([userToCreate])
      .select('*, twitter_id::text')
      .single()

    console.log('Auth', 'createUser', 'Database insert completed', undefined, { 
      success: !!newUser,
      hasError: !!createError,
      newUserId: newUser?.id,
      errorCode: createError?.code,
      errorMessage: createError?.message
    })

    if (createError) {
      logger.logError('Auth', 'createUser', 'Error creating user', undefined, { 
        provider, 
        providerId, 
        error: createError,
        userToCreate
      })
      console.error('Auth', 'createUser', 'Database insert failed', undefined, { 
        createError,
        userToCreate
      })
      throw new Error(createError.message)
    }

    console.log('Auth', 'createUser', 'Successfully created new user', undefined, { 
      userId: newUser.id,
      provider
    })

    return newUser as CustomAdapterUser
  }

  console.log('Auth', 'createUser', 'Entering fallback user creation (no provider)', undefined)

  // Fallback pour la création d'utilisateur sans provider
  const userToCreate: Partial<CustomAdapterUser> = {
    name: userData.name,
    has_onboarded: false,
    hqx_newsletter: false,
    oep_accepted: false,
    have_seen_newsletter: false,
    research_accepted: false,
    automatic_reconnect: false,
    email: 'none'
  }

  console.log('Auth', 'createUser', 'Fallback user data prepared', undefined, { 
    userToCreate,
    originalUserData: userData
  })

  console.log('Auth', 'createUser', 'Attempting fallback user insert', undefined)

  const { data: newUser, error: createError } = await authClient
    .from('users')
    .insert([userToCreate])
    .select('*, twitter_id::text')
    .single()

  console.log('Auth', 'createUser', 'Fallback insert completed', undefined, { 
    success: !!newUser,
    hasError: !!createError,
    newUserId: newUser?.id,
    errorCode: createError?.code,
    errorMessage: createError?.message
  })

  if (createError) {
    logger.logError('Auth', 'createUser', 'Error creating fallback user', undefined, { 
      error: createError,
      userToCreate
    })
    console.error('Auth', 'createUser', 'Fallback insert failed', undefined, { 
      createError,
      userToCreate
    })
    throw new Error(createError.message)
  }

  console.log('Auth', 'createUser', 'Successfully created fallback user', undefined, { 
    userId: newUser.id
  })

  return newUser as CustomAdapterUser
}

export async function getUser(id: string): Promise<CustomAdapterUser | null> {
  const { data: user, error: userError } = await authClient
    .from('users')
    .select('*, twitter_id::text')
    .eq('id', id)
    .single()

  if (userError) {
    logger.logError('Auth', 'getUser', 'Error getting user', undefined, { id, error: userError })
    return null
  }

  if (!user) return null

  // console.log("🔍 [DEBUG] Raw user data from Supabase:", {
  //   id: user.id,
  //   twitter_id: user.twitter_id,
  //   twitter_id_type: typeof user.twitter_id,
  //   twitter_id_string: String(user.twitter_id)
  // });

  return {
    id: user.id,
    name: user.name,
    email: "none",
    emailVerified: null,
    twitter_id: user.twitter_id || null,
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
    hqx_newsletter: user.hqx_newsletter,
    oep_accepted: user.oep_accepted,
    have_seen_newsletter: user.have_seen_newsletter,
    // have_seen_bot_newsletter: user.have_seen_bot_newsletter,
    research_accepted: user.research_accepted,
    automatic_reconnect: user.automatic_reconnect,
    facebook_id: user.facebook_id,
    facebook_image: user.facebook_image
  }
}

export async function getUserByEmail(email: string): Promise<CustomAdapterUser | null> {
  return null
}

export async function getUserByAccount({ providerAccountId, provider }): Promise<CustomAdapterUser | null> {

  let column: string
  if (provider === 'twitter') {
    column = 'twitter_id'
  } else if (provider === 'mastodon' || provider === 'piaille') {
    //for Mastodon the next auth doesnt handle singularity so we have to overwrite
    return null;
  } else if (provider === 'bluesky') {
    column = 'bluesky_id'
  } else if (provider === 'facebook') {
    column = 'facebook_id'
  } else {
    return null
  }

  const { data: user, error: userError } = await authClient
    .from('users')
    .select('*, twitter_id::text')
    .eq(column, providerAccountId)
    .single()

  if (userError) {
    logger.logError('Auth', 'getUserByAccount', 'Error getting user by account', undefined, { provider, providerAccountId, error: userError })
    return null
  }

  if (!user) return null

  // For Piaille accounts, we need to verify the instance
  if (provider === 'piaille' && user.mastodon_instance !== 'piaille.fr') {
    return null
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
    hqx_newsletter: user.hqx_newsletter,
    oep_accepted: user.oep_accepted,
    have_seen_newsletter: user.have_seen_newsletter,
    // have_seen_bot_newsletter: user.have_seen_bot_newsletter,
    research_accepted: user.research_accepted,
    automatic_reconnect: user.automatic_reconnect,
    email: "none",
    emailVerified: null,
    facebook_id: user.facebook_id,
    facebook_image: user.facebook_image
  }
}

export async function updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<CustomAdapterUser>;
export async function updateUser(
  userId: string,
  providerData?: {
    provider: 'twitter' | 'bluesky' | 'mastodon' | 'facebook',
    profile: ProviderProfile
  }
): Promise<CustomAdapterUser>;
export async function updateUser(
  userOrId: (Partial<AdapterUser> & Pick<AdapterUser, "id">) | string,
  providerData?: {
    provider: 'twitter' | 'bluesky' | 'mastodon' | 'facebook',
    profile: ProviderProfile
  }
): Promise<CustomAdapterUser> {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;

  if (!userId) {
    logger.logError('Auth', 'updateUser', 'User ID is required', undefined, { userOrId })
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
  else if (providerData?.provider === 'facebook' && providerData.profile) {
    const facebookData = providerData.profile as FacebookProfile
    updates.facebook_id = facebookData.id
    updates.name = facebookData.name
    updates.facebook_image = facebookData.picture?.data?.url
  }
  const { data: user, error: updateError } = await authClient
    .from('users')
    .update(updates)
    .eq("id", userId)
    .select("*, twitter_id::text")
    .single()

  if (updateError) {
    logger.logError('Auth', 'updateUser', 'Error updating user', userId, { providerData, error: updateError })
    // Check if user exists
    const { data: existingUser, error: checkError } = await authClient
      .from('users')
      .select("*, twitter_id::text")
      .eq("id", userId)
      .single()
    
    if (checkError) {
      logger.logError('Auth', 'updateUser', 'Error checking user existence', userId, { providerData, error: checkError })
    } else {
      console.log('Auth', 'updateUser', 'Existing user', userId, { providerData, user: existingUser })
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
    hqx_newsletter: user.hqx_newsletter,
    oep_accepted: user.oep_accepted,
    have_seen_newsletter: user.have_seen_newsletter,
    // have_seen_bot_newsletter: user.have_seen_bot_newsletter,
    research_accepted: user.research_accepted,
    automatic_reconnect: user.automatic_reconnect,
    email: "none",
    emailVerified: null,
    facebook_id: user.facebook_id,
    facebook_image: user.facebook_image
  }
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
  console.log('Auth', 'linkAccount', 'Linking account', account.user_id, { account })
  
  // Décoder l'access token pour obtenir l'expiration
  let expires_at = account.expires_at
  if (account.access_token) {
    const payload = decodeJwt(account.access_token)
    if (payload?.exp) {
      expires_at = payload.exp
    }
  }
  
  const { error } = await authClient
    .from("accounts")
    .upsert([{
      user_id: account.userId,
      type: account.type,
      provider: account.provider,
      provider_account_id: account.providerAccountId,
      refresh_token: account.refresh_token ? encrypt(account.refresh_token) : null,
      access_token: account.access_token ? encrypt(account.access_token) : null,
      expires_at,  // Utiliser l'expiration décodée du JWT
      token_type: account.token_type,
      scope: account.scope,
      id_token: account.id_token ? encrypt(account.id_token) : null,
      session_state: account.session_state,
    }], {
      onConflict: 'provider,provider_account_id',
    })

  if (error) {
    logger.logError('Auth', 'linkAccount', 'Error linking account', account.user_id, { account, error })
    throw error
  }
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
      hqx_newsletter: user.hqx_newsletter,
      oep_accepted: user.oep_accepted,
      have_seen_newsletter: user.have_seen_newsletter,
      // have_seen_bot_newsletter: user.have_seen_bot_newsletter,
      research_accepted: user.research_accepted,
      automatic_reconnect: user.automatic_reconnect,
      email: "none",
      emailVerified: null,
      facebook_id: user.facebook_id,
      facebook_image: user.facebook_image
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
    // For mastodon.social
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

  if (user.facebook_id) {
    accounts.push({
      provider: 'facebook',
      type: 'oauth',
      providerAccountId: user.facebook_id,
      userId: user.id
    })
  }

  return accounts
}


async function unlinkAccountImpl(
  userId: string,
  provider: 'twitter' | 'bluesky' | 'mastodon' | 'piaille' | 'facebook'
): Promise<void> {
  console.log("\n=== [Adapter] Starting account unlinking ===")
  console.log("→ User ID:", userId)
  console.log("→ Provider:", provider)

  // Get current user
  const { data: user, error: userError } = await authClient
    .from('users')
    .select('*, twitter_id::text')
    .eq('id', userId)
    .single()

  if (userError || !user) {
    logger.logError('Auth', 'unlinkAccountImpl', 'Error fetching user', userId, { provider, error: userError })
    throw new UnlinkError("User not found", "NOT_FOUND", 404)
  }

  // For Piaille, we check mastodon_id
  const dbProvider = provider === 'piaille' ? 'mastodon' : provider
  const providerIdField = `${dbProvider}_id`
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
  if (user.facebook_id) linkedAccounts++

  // Prevent unlinking the last account
  if (linkedAccounts === 1) {
    logger.logError('Auth', 'unlinkAccountImpl', 'Cannot unlink the last account', userId, { provider })
    throw new UnlinkError(
      "Cannot unlink the last account. Add another account first.",
      "LAST_ACCOUNT",
      400
    )
  }

  // Delete account entry with the actual provider (piaille or mastodon)
  const { error: deleteError } = await authClient
    .from('accounts')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider)

  if (deleteError) {
    logger.logError('Auth', 'unlinkAccountImpl', 'Error deleting account', userId, { provider, error: deleteError })
    throw new UnlinkError("Database error", "DATABASE_ERROR", 500)
  }

  // Update user fields using the database provider (always mastodon for piaille)
  const updates: any = {
    [`${dbProvider}_id`]: null,
    [`${dbProvider}_username`]: null,
    [`${dbProvider}_image`]: null
  }
  if (dbProvider === 'mastodon') {
    updates.mastodon_instance = null
  }

  // Update user
  const { error: updateError } = await authClient
    .from('users')
    .update(updates)
    .eq('id', userId)

  if (updateError) {
    logger.logError('Auth', 'unlinkAccountImpl', 'Error updating user', userId, { provider, error: updateError })
    throw new UnlinkError("Database error", "DATABASE_ERROR", 500)
  }
}

export async function unlinkAccount(
  account: Pick<AdapterAccount, "provider" | "providerAccountId">
): Promise<void> {
  console.log("\n=== [Adapter] Starting account unlinking ===")
  console.log("Provider:", account.provider)
  console.log("Provider Account ID:", account.providerAccountId)

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


  await unlinkAccountImpl(user.id, account.provider as 'twitter' | 'bluesky' | 'mastodon' | 'facebook')
}

type CustomSupabaseAdapter = Omit<Adapter, 'getUserByAccount' | 'updateUser' | 'createUser' | 'linkAccount'> & {
  getUserByAccount: NonNullable<Adapter['getUserByAccount']>;
  updateUser: {
    (user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<CustomAdapterUser>;
    (userId: string, providerData?: {
      provider: 'twitter' | 'bluesky' | 'mastodon' | 'facebook',
      profile: ProviderProfile
    }): Promise<CustomAdapterUser>;
  };
  createUser: {
    (user: Partial<AdapterUser>): Promise<CustomAdapterUser>;
    (userData: Partial<AdapterUser> | (Partial<CustomAdapterUser> & {
      provider?: 'twitter' | 'bluesky' | 'mastodon' | 'facebook',
      profile?: ProviderProfile
    })): Promise<CustomAdapterUser>;
  };
  linkAccount: NonNullable<Adapter['linkAccount']>;
  getAccountsByUserId: (userId: string) => Promise<AdapterAccount[]>
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
  unlinkAccount,
  getAccountsByUserId
}