export interface BlueskyProfile {
  did: string
  handle: string
  displayName?: string
  avatar?: string
}

export interface BlueskySessionData {
  accessJwt: string
  refreshJwt: string
  handle: string
  did: string
}

export interface BlueskyAuthResult {
  success: boolean
  data?: BlueskySessionData
  error?: string
}

export interface BatchFollowResult {
  attempted: number
  succeeded: number
  failures: Array<{
    handle: string
    error: string
  }>
}

export interface IBlueskyRepository {
  getUserByBlueskyId(did: string): Promise<User | null>
  linkBlueskyAccount(userId: string, blueskyData: BlueskySessionData): Promise<void>
  updateBlueskyProfile(userId: string, profile: BlueskyProfile): Promise<void>
}

export interface IBlueskyService {
  login(identifier: string, password: string): Promise<BlueskyAuthResult>
  resumeSession(sessionData: BlueskySessionData): Promise<void>
  logout(): Promise<void>
  getProfile(handle: string): Promise<BlueskyProfile>
  follow(did: string): Promise<void>
  batchFollow(handles: string[]): Promise<BatchFollowResult>
}