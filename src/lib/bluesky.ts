import { BskyAgent } from '@atproto/api'

const BSKY_SERVICE = 'https://bsky.social'

type BlueSkySession = {
  accessToken: string
  refreshToken: string
  handle: string
}

export async function getProfileInfo(handle: string, session?: BlueSkySession) {
  const agent = new BskyAgent({ service: BSKY_SERVICE })
  
  try {
    if (session?.accessToken) {
      await agent.resumeSession({
        accessJwt: session.accessToken,
        refreshJwt: session.refreshToken,
        handle: session.handle,
        did: `did:plc:${session.handle.replace('.', '')}`,
        active: true
      })
    }
    
    const response = await agent.getProfile({ actor: handle })
    return {
      handle: response.data.handle,
      displayName: response.data.displayName,
      avatar: response.data.avatar,
      description: response.data.description
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération du profil ${handle}:`, error)
    return null
  }
}