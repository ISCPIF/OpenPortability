import { BskyAgent } from '@atproto/api'
import { 
  IBlueskyService, 
  BlueskyAuthResult, 
  BlueskySessionData, 
  BlueskyProfile,
  BatchFollowResult,
  IBlueskyRepository
} from '../types/bluesky'

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
    console.log('[BlueskyService.batchFollow] Starting batch follow for handles:', handles);
    return await this.batchFollowWithDetails(handles);
  }

  private async batchApplyWrites(
    handles: string[],
    dids: string[]
  ): Promise<MigrationFollowResult> {
    console.log('[BlueskyService.batchApplyWrites] Starting batch apply writes:', {
      handlesCount: handles.length,
      didsCount: dids.length,
      handles,
      dids
    });

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

    console.log('[BlueskyService.batchApplyWrites] Prepared writes:', writes);

    try {
      console.log('[BlueskyService.batchApplyWrites] Sending applyWrites request for user:', this.agent.session?.did);
      
      const response = await this.agent.api.com.atproto.repo.applyWrites({
        repo: this.agent.session?.did!,
        writes,
        validate: true
      });

      console.log('[BlueskyService.batchApplyWrites] ApplyWrites response:', response);

      // Si la requête réussit, tous les follows ont réussi
      if (response.success) {
        result.succeeded = handles.length;
        result.successfulHandles = [...handles];
        console.log('[BlueskyService.batchApplyWrites] All follows succeeded:', {
          succeeded: result.succeeded,
          successfulHandles: result.successfulHandles
        });
      }
    } catch (error: any) {
      console.error('[BlueskyService.batchApplyWrites] Batch follow error:', {
        error,
        formattedError: this.formatError(error)
      });
      
      // En cas d'erreur, on considère que tous les follows ont échoué
      handles.forEach(handle => {
        result.failures.push({
          handle,
          error: this.formatError(error)
        });
      });
    }

    console.log('[BlueskyService.batchApplyWrites] Final result:', result);
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
    if (error.message.includes('Invalid identifier or password')) {
      return 'Invalid identifier or password'
    } else if (error.message.includes('Network Error')) {
      return 'Unable to connect to Bluesky. Please check your internet connection.'
    }
    return error.message || 'An unexpected error occurred'
  }


}
