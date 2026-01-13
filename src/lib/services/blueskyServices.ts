import { BskyAgent, Agent } from '@atproto/api'
import { 
  IBlueskyService, 
  BlueskyAuthResult, 
  BlueskySessionData, 
  BlueskyProfile,
  BatchFollowResult,
  IBlueskyRepository
} from '../types/bluesky'
import logger from '../log_utils';

export interface MigrationFollowResult extends BatchFollowResult {
  successfulHandles: string[];  // Pour pouvoir mettre à jour sources_targets
}

export interface RateLimitConfig {
  pointsPerHour: number;
  pointsPerDay: number;
  pointsPerCreate: number;
  maxWritesPerBatch: number;
}

const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  pointsPerHour: 5000,
  pointsPerDay: 35000,
  pointsPerCreate: 3,
  maxWritesPerBatch: 100 // Limite raisonnable par requête
};

export class BlueskyService implements IBlueskyService {
  private agent: BskyAgent
  private repository: IBlueskyRepository
  private rateLimits: RateLimitConfig = DEFAULT_RATE_LIMITS

  constructor(repository: IBlueskyRepository) {
    this.agent = new BskyAgent({ service: 'https://bsky.social' })
    this.repository = repository
  }

  async login(identifier: string, password: string): Promise<BlueskyAuthResult> {
    try {
      const session = await this.agent.login({ identifier, password })
      
      if (!session?.data) {
        throw new Error('Login failed: No session data received')
      }

      const sessionData: BlueskySessionData = {
        accessJwt: session.data.accessJwt,
        refreshJwt: session.data.refreshJwt,
        handle: session.data.handle,
        did: session.data.did
      }

      return {
        success: true,
        data: sessionData
      }
    } catch (error: any) {
      console.error('Bluesky authentication error:', error)
      return {
        success: false,
        error: this.formatError(error)
      }
    }
  }

  async resumeSession(sessionData: BlueskySessionData): Promise<void> {
    // If the provided tokens come from OAuth (DPoP), they are not compatible with BskyAgent.
    const isOAuth = (sessionData.token_type?.toUpperCase() === 'DPOP') ||
                    (typeof sessionData.scope === 'string' && sessionData.scope.includes('atproto'))
    if (isOAuth) {
      throw new Error(
        'Your Bluesky connection is OAuth-based (DPoP). This endpoint uses ATProto app-password sessions and cannot operate with OAuth tokens. ' +
        'Please connect Bluesky using an app password to perform follow operations.'
      )
    }

    await this.agent.resumeSession({
      accessJwt: sessionData.accessJwt,
      refreshJwt: sessionData.refreshJwt,
      handle: sessionData.handle,
      did: sessionData.did,
      active: true
    })
  }

  async logout(): Promise<void> {
    await this.agent.logout()
  }

  async getProfile(handle: string): Promise<BlueskyProfile> {
    const profile = await this.agent.getProfile({ actor: handle })
    
    if (!profile.success) {
      throw new Error(`Failed to get profile for ${handle}`)
    }

    return {
      did: profile.data.did,
      handle: profile.data.handle,
      displayName: profile.data.displayName,
      avatar: profile.data.avatar
    }
  }

  async follow(did: string): Promise<void> {
    await this.agent.follow(did)
  }

  async batchFollow(handles: string[]): Promise<BatchFollowResult> {
    return await this.batchFollowWithDetails(handles);
  }

  // ===== OAuth (DPoP) support via dpopFetch =====
  private async getOAuthSession(did: string): Promise<{ dpopFetch: any; scope?: string; token_type?: string } | null> {
    try {
      // Preferred: rehydrate a live session via the OAuth client restore() API (provides dpopFetch)
      const { createBlueskyOAuthClient } = await import('../services/blueskyOAuthClient');
      const client = await createBlueskyOAuthClient();
      const canRestore = typeof (client as any)?.restore === 'function';
      if (canRestore) {
        const liveSession: any = await (client as any).restore(did);
        if (liveSession) {
          // If the restored session has no tokenSet details, merge from Redis snapshot to get scope/token_type
          let scope: string | undefined = liveSession?.tokenSet?.scope;
          let token_type: string | undefined = liveSession?.tokenSet?.token_type;
          if (!scope || !token_type) {
            try {
              const { getRedis } = await import('../services/redisClient');
              const redis = getRedis();
              const key = `bsky:session:${did}`;
              const raw = await redis.get(key);
              if (raw) {
                const snap = JSON.parse(raw);
                scope = scope ?? snap?.tokenSet?.scope;
                token_type = token_type ?? snap?.tokenSet?.token_type;
              }
            } catch {}
          }
          return {
            dpopFetch: liveSession.dpopFetch,
            scope,
            token_type,
          };
        }
      }

      // Fallback: read raw JSON from Redis. Note: dpopFetch is not serializable; will be missing here.
      const { getRedis } = await import('../services/redisClient');
      const redis = getRedis();
      const key = `bsky:session:${did}`;
      const raw = await redis.get(key);
      if (!raw) return null;
      const sessionData = JSON.parse(raw);
      const tokenSet = sessionData?.tokenSet || {};
      return {
        dpopFetch: undefined,
        scope: tokenSet.scope,
        token_type: tokenSet.token_type,
      };
    } catch (e: any) {
      const errorString = e instanceof Error ? e.message : String(e);
      logger.logError('[BlueskyService.getOAuthSession] Failed to load OAuth session', errorString, "system");
      return null;
    }
  }

  private async dpopGetProfile(dpopFetch: any, actor: string): Promise<BlueskyProfile> {
    const origin = 'https://bsky.social';
    const url = new URL('/xrpc/app.bsky.actor.getProfile', origin);
    url.searchParams.set('actor', actor);
    const resp = await dpopFetch(url.toString());
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`OAuth getProfile failed (${resp.status}): ${txt}`);
    }
    const data = await resp.json();
    return {
      did: data.did,
      handle: data.handle,
      displayName: data.displayName,
      avatar: data.avatar,
    };
  }

  async batchFollowOAuth(userDid: string, handles: string[]): Promise<BatchFollowResult> {
    const timings: Record<string, number> = {};
    let t0 = Date.now();

    // Rehydrate a live OAuth session and use an OAuth-bound Agent (correct PDS and DPoP signing)
    const { createBlueskyOAuthClient } = await import('../services/blueskyOAuthClient');
    timings['import'] = Date.now() - t0; t0 = Date.now();

    const client = await createBlueskyOAuthClient();
    timings['createClient'] = Date.now() - t0; t0 = Date.now();

    const liveSession: any = await (client as any).restore?.(userDid);
    timings['restore'] = Date.now() - t0; t0 = Date.now();

    if (!liveSession) {
      throw new Error('Missing OAuth session (DPoP) to perform follow operations');
    }

    // Determine scope/token_type (may be absent on restored session; merge from Redis snapshot)
    let scope: string | undefined = liveSession?.tokenSet?.scope;
    let token_type: string | undefined = liveSession?.tokenSet?.token_type;
    if (!scope || !token_type) {
      try {
        const { getRedis } = await import('../services/redisClient');
        const redis = getRedis();
        const key = `bsky:session:${userDid}`;
        const raw = await redis.get(key);
        if (raw) {
          const snap = JSON.parse(raw);
          scope = scope ?? snap?.tokenSet?.scope;
          token_type = token_type ?? snap?.tokenSet?.token_type;
        }
      } catch {}
    }
    timings['scopeCheck'] = Date.now() - t0; t0 = Date.now();

    if (scope && !scope.includes('atproto')) {
      throw new Error(`Bad token scope for OAuth follows: expected atproto, got ${scope}`);
    }

    const agent = new Agent(liveSession);

    const result: MigrationFollowResult = {
      attempted: handles.length,
      succeeded: 0,
      failures: [],
      successfulHandles: []
    };

    try {
      // OPTIMIZED: Resolve DIDs using public API with Redis cache and concurrency limit
      const didResults = await this.resolveHandlesToDidsOptimized(handles);
      timings['resolveDIDs'] = Date.now() - t0; t0 = Date.now();

      const successes = didResults.filter((r): r is { ok: true; did: string; handle: string } => r.ok);
      const failures = didResults.filter((r): r is { ok: false; handle: string; error: string } => !r.ok);

      failures.forEach(f => result.failures.push({ handle: f.handle, error: f.error }));
      if (successes.length === 0) {
        console.log('[batchFollowOAuth] Timings:', timings);
        return result;
      }

      // Build applyWrites payload
      const writes = successes.map(s => ({
        $type: 'com.atproto.repo.applyWrites#create',
        collection: 'app.bsky.graph.follow',
        value: { subject: s.did, createdAt: new Date().toISOString() }
      }));

      const response = await agent.api.com.atproto.repo.applyWrites({
        repo: userDid,
        writes: writes as any,
        validate: true,
      });
      timings['applyWrites'] = Date.now() - t0;

      console.log('[batchFollowOAuth] Timings:', timings, 'handles:', handles.length);

      if (!response.success) {
        throw new Error('OAuth applyWrites failed');
      }

      result.succeeded += successes.length;
      result.successfulHandles.push(...successes.map(s => s.handle));
      return result;
    } catch (e: any) {
      console.log('[batchFollowOAuth] Timings before error:', timings);
      handles.forEach(h => result.failures.push({ handle: h, error: this.formatError(e) }));
      return result;
    }
  }

  /**
   * Optimized DID resolution with Redis cache and public API
   * - Uses public API (no auth needed, faster)
   * - Caches DIDs in Redis for 24h
   * - All requests in parallel with timeout
   */
  private async resolveHandlesToDidsOptimized(
    handles: string[]
  ): Promise<Array<{ ok: true; did: string; handle: string } | { ok: false; handle: string; error: string }>> {
    const { getRedis } = await import('../services/redisClient');
    const redis = getRedis();
    const CACHE_TTL = 60 * 60 * 24; // 24 hours
    const REQUEST_TIMEOUT = 5000; // 5 seconds per request

    // Step 1: Check Redis cache for all handles
    const cacheKeys = handles.map(h => `bsky:did:${h.toLowerCase()}`);
    const cachedDids = await redis.mget(...cacheKeys);

    const results: Array<{ ok: true; did: string; handle: string } | { ok: false; handle: string; error: string }> = [];
    const toResolve: string[] = [];
    const handleIndexMap = new Map<string, number>();

    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i];
      const cached = cachedDids[i];
      if (cached) {
        results.push({ ok: true, did: cached, handle });
      } else {
        handleIndexMap.set(handle.toLowerCase(), results.length);
        results.push({ ok: false, handle, error: 'pending' }); // Placeholder
        toResolve.push(handle);
      }
    }

    if (toResolve.length === 0) {
      return results;
    }

    // Step 2: Resolve ALL uncached handles in parallel with timeout
    const resolveOne = async (handle: string): Promise<{ handle: string; did?: string; error?: string }> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      
      try {
        const resp = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`, {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (resp.ok) {
          const data = await resp.json();
          return { handle, did: data.did };
        } else {
          return { handle, error: `Profile not found (${resp.status})` };
        }
      } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
          return { handle, error: 'Timeout' };
        }
        return { handle, error: e.message || 'Network error' };
      }
    };

    // All requests in parallel (public API can handle it)
    const resolved = await Promise.all(toResolve.map(resolveOne));

    // Step 3: Update results and cache successful resolutions
    const toCache: [string, string][] = [];
    for (const r of resolved) {
      const idx = handleIndexMap.get(r.handle.toLowerCase());
      if (idx !== undefined) {
        if (r.did) {
          results[idx] = { ok: true, did: r.did, handle: r.handle };
          toCache.push([`bsky:did:${r.handle.toLowerCase()}`, r.did]);
        } else {
          results[idx] = { ok: false, handle: r.handle, error: r.error || 'Unknown error' };
        }
      }
    }

    // Batch cache the resolved DIDs
    if (toCache.length > 0) {
      const pipeline = redis.multi();
      for (const [key, value] of toCache) {
        pipeline.set(key, value, 'EX', CACHE_TTL);
      }
      await pipeline.exec().catch(() => {}); // Ignore cache errors
    }

    return results;
  }

  private async batchApplyWrites(
    handles: string[],
    dids: string[]
  ): Promise<MigrationFollowResult> {

    const result: MigrationFollowResult = {
      attempted: handles.length,
      succeeded: 0,
      failures: [],
      successfulHandles: []
    };

    // Créer les opérations de follow
    const writes = dids.map(did => ({
      $type: 'com.atproto.repo.applyWrites#create',
      collection: 'app.bsky.graph.follow',
      value: {
        subject: did,
        createdAt: new Date().toISOString()
      }
    }));


    try {
      
      const response = await this.agent.api.com.atproto.repo.applyWrites({
        repo: this.agent.session?.did!,
        writes: writes as any,
        validate: true
      });

      // Si la requête réussit, tous les follows ont réussi
      if (response.success) {
        result.succeeded = handles.length;
        result.successfulHandles = [...handles];
      }
    } catch (error: any) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('[BlueskyService.batchApplyWrites] Batch follow error:', errorString, "system");
      
      // En cas d'erreur, on considère que tous les follows ont échoué
      handles.forEach(handle => {
        result.failures.push({
          handle,
          error: this.formatError(error)
        });
      });
    }
    return result;
  }

  private async processBatchesWithRateLimit(
    handles: string[]
  ): Promise<MigrationFollowResult> {
    const result: MigrationFollowResult = {
      attempted: handles.length,
      succeeded: 0,
      failures: [],
      successfulHandles: []
    };

    // Traiter par lots pour respecter les rate limits
    for (let i = 0; i < handles.length; i += this.rateLimits.maxWritesPerBatch) {
      const batchHandles = handles.slice(i, i + this.rateLimits.maxWritesPerBatch);
      
      // Résoudre tous les DIDs en parallèle
      const didResults = await Promise.all(
        batchHandles.map(async handle => {
          try {
            const profile = await this.getProfile(handle);
            return { success: true, handle, did: profile.did };
          } catch (error) {
            return { success: false, handle, error: this.formatError(error) };
          }
        })
      );

      // Séparer les succès et les échecs
      const successes = didResults.filter((r): r is { success: true; handle: string; did: string } => r.success);
      const failures = didResults.filter((r): r is { success: false; handle: string; error: string } => !r.success);

      // Ajouter les échecs de résolution de DID au résultat
      failures.forEach(f => {
        result.failures.push({
          handle: f.handle,
          error: f.error
        });
      });

      if (successes.length > 0) {
        // Appliquer les follows en batch
        const batchResult = await this.batchApplyWrites(
          successes.map(s => s.handle),
          successes.map(s => s.did)
        );

        // Agréger les résultats
        result.succeeded += batchResult.succeeded;
        result.successfulHandles.push(...batchResult.successfulHandles);
        result.failures.push(...batchResult.failures);
      }

      // Ajouter un délai entre les batchs pour respecter les rate limits
      if (i + this.rateLimits.maxWritesPerBatch < handles.length) {
        const pointsUsed = successes.length * this.rateLimits.pointsPerCreate;
        const delayMs = this.calculateDelay(pointsUsed);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return result;
  }

  private calculateDelay(pointsUsed: number): number {
    // Calculer le délai nécessaire basé sur les points/heure
    const maxBatchesPerHour = this.rateLimits.pointsPerHour / pointsUsed;
    const minDelayBetweenBatches = (3600 * 1000) / maxBatchesPerHour;
    
    // Ajouter 10% de marge de sécurité
    return minDelayBetweenBatches * 1.1;
  }

  async batchFollowWithDetails(handles: string[]): Promise<MigrationFollowResult> {
    return this.processBatchesWithRateLimit(handles);
  }

  async migrateFollows(
    sessionData: BlueskySessionData,
    accounts: Array<{ bluesky_handle: string; twitter_id: string }>,
    onSuccess?: (twitterId: string) => Promise<void>
  ): Promise<MigrationFollowResult> {
    await this.resumeSession(sessionData);

    const handles = accounts
      .filter(acc => acc.bluesky_handle)
      .map(acc => acc.bluesky_handle);

    const result = await this.batchFollowWithDetails(handles);

    // Si un callback onSuccess est fourni, on l'appelle pour chaque follow réussi
    if (onSuccess) {
      const successfulAccounts = accounts.filter(
        acc => result.successfulHandles.includes(acc.bluesky_handle)
      );
      
      await Promise.all(
        successfulAccounts.map(acc => onSuccess(acc.twitter_id))
      );
    }

    return result;
  }

  async createPost(text: string): Promise<{ uri: string; cid: string }> {
    try {
      const now = new Date().toISOString();
      
      const result = await this.agent.post({
        text: text,
        createdAt: now
      });
      
      return {
        uri: result.uri,
        cid: result.cid
      };
    } catch (error: any) {
      console.error('Error creating BlueSky post:', error);
      throw new Error(this.formatError(error));
    }
  }

  private formatError(error: any): string {
    if (typeof error?.message === 'string') {
      if (error.message.includes('Invalid identifier or password')) {
        return 'Invalid identifier or password'
      } else if (error.message.includes('Network Error')) {
        return 'Unable to connect to Bluesky. Please check your internet connection.'
      } else if (error.message.includes('OAuth') || error.message.includes('app password')) {
        return error.message
      }
    }
    return error.message || 'An unexpected error occurred'
  }

  /**
   * Suit le compte officiel du bot de l'application
   * @returns Un résultat indiquant si l'opération a réussi
   */
  async followBot(): Promise<{ success: boolean; error?: string }> {
    try {
      // Vérifier que l'agent est connecté
      if (!this.agent.session) {
        throw new Error('Not authenticated: Please login first');
      }

      // Récupérer le handle du bot depuis les variables d'environnement
      const botHandle = process.env.BLUESKY_BOT_USERNAME || 'helloqitto.bsky.social';
      
      // Récupérer le profil du bot pour obtenir son DID
      try {
        const profile = await this.getProfile(botHandle);
        
        // Suivre le compte du bot
        await this.agent.follow(profile.did);
        
        return { 
          success: true 
        };
      } catch (profileError) {
        console.error('[BlueskyService.followBot] Error getting bot profile:', profileError);
        return {
          success: false,
          error: `Failed to get bot profile: ${this.formatError(profileError)}`
        };
      }
    } catch (error) {
      console.error('[BlueskyService.followBot] Error following bot:', error);
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }
}
