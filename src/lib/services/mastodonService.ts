import { 
  IMastodonService, 
  MastodonAccount, 
  MastodonFollowResult,
  MastodonBatchFollowResult,
  MastodonTarget
} from '../types/mastodon';

export class MastodonService implements IMastodonService {
  private cleanInstance(instance: string): string {
    return instance.replace('https://', '');
  }


  private async followAccountById(
    accessToken: string,
    userInstance: string,
    accountId: string
  ): Promise<boolean> {
    const cleanUserInstance = this.cleanInstance(userInstance);

    try {
      const followResponse = await fetch(
        `https://${cleanUserInstance}/api/v1/accounts/${accountId}/follow`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      return followResponse.ok;
    } catch (error) {
      console.error('Failed to follow account:', error);
      return false;
    }
  }

  async followAccount(
    accessToken: string,
    userInstance: string,
    targetUsername: string,
    targetInstance: string,
    accountId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const cleanUserInstance = userInstance.replace('https://', '');
    const cleanTargetInstance = targetInstance.replace('https://', '');
    const cleanUsername = targetUsername.split('@')[0];

    // console.log(' [MastodonService.followAccount] Starting follow process:', {
    //   userInstance: cleanUserInstance,
    //   targetUsername: cleanUsername,
    //   targetInstance: cleanTargetInstance,
    //   accountId
    // });

    try {
      // Always search first for cross-instance follows
      if (cleanUserInstance !== cleanTargetInstance) {
        const searchUrl = `https://${cleanUserInstance}/api/v1/accounts/search?q=${cleanUsername}@${cleanTargetInstance}&resolve=true&limit=1`;
        // console.log(' [MastodonService.followAccount] Searching account with URL:', searchUrl);

        const searchResponse = await fetch(searchUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!searchResponse.ok) {
          console.error(' [MastodonService.followAccount] Failed to search account:', {
            status: searchResponse.status,
            statusText: searchResponse.statusText
          });
          return { 
            success: false, 
            error: `Search failed: ${searchResponse.status} ${searchResponse.statusText}` 
          };
        }

        const accounts = await searchResponse.json();
        // console.log(' [MastodonService.followAccount] Number of accounts found:', accounts.length);

        const accountToFollow = accounts.find(acc =>
          acc.acct === `${cleanUsername}@${cleanTargetInstance}` ||
          (acc.username === cleanUsername && acc.url.includes(cleanTargetInstance))
        );

        if (!accountToFollow) {
          console.error(' [MastodonService.followAccount] No exact match found for:', {
            targetUsername: cleanUsername,
            targetInstance: cleanTargetInstance,
            accounts: accounts.map(acc => ({ username: acc.username, acct: acc.acct, url: acc.url }))
          });
          return { success: false, error: 'No exact match found' };
        }

        // Use the resolved ID instead of the provided one
        const resolvedId = accountToFollow.id;
        const success = await this.followAccountById(accessToken, cleanUserInstance, resolvedId);
        return { success, error: success ? undefined : 'Failed to follow resolved account' };
      } 
      // For same-instance follows, we can use the provided ID directly
      else if (accountId) {
        console.log(' [MastodonService.followAccount] Using direct ID for same instance:', {
          accountId,
          cleanUserInstance
        });
        const success = await this.followAccountById(accessToken, cleanUserInstance, accountId);
        return { success, error: success ? undefined : 'Failed to follow by ID' };
      }
      else {
        console.error(' [MastodonService.followAccount] No account ID provided for same instance follow:', {
          userInstance: cleanUserInstance,
          targetUsername: cleanUsername,
          targetInstance: cleanTargetInstance
        });
        return { success: false, error: 'No account ID provided for same instance follow' };
      }
    } catch (error) {
      console.error(' [MastodonService.followAccount] Error following on Mastodon:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async batchFollow(
    accessToken: string,
    userInstance: string,
    targets: Array<MastodonTarget>
  ): Promise<MastodonBatchFollowResult> {
    const results = await Promise.all(
      targets.map(async (target) => {
        const result = await this.followAccount(
          accessToken,
          userInstance,
          target.username,
          target.instance,
          target.id
        );

        return {
          target,
          success: result.success,
          error: result.error
        };
      })
    );

    const succeeded = results.filter(r => r.success).length;
    const failures = results
      .filter(r => !r.success)
      .map(r => ({ 
        handle: `${r.target.username}@${r.target.instance}`,
        error: r.error 
      }));

    return {
      attempted: results.length,
      succeeded,
      failures,
      successfulHandles: results
        .filter(r => r.success)
        .map(r => `${r.target.username}@${r.target.instance}`)
    };
  }
}