import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { AccountService } from '@/lib/services/accountService';
import { BlueskyService } from '@/lib/services/blueskyServices';
import { BlueskyRepository } from '@/lib/repositories/blueskyRepository';
import { decrypt } from '@/lib/encryption';
import logger, { withLogging } from '@/lib/log_utils';

/**
 * Gestionnaire POST pour suivre le compte officiel de l'application sur Bluesky
 */
async function followBotHandler(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'POST /api/newsletter/follow_bot', 'Unauthorized attempt to follow bot', 'anonymous');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    // Initialiser les services
    const accountService = new AccountService();
    const blueskyRepository = new BlueskyRepository();
    const blueskyService = new BlueskyService(blueskyRepository);
    
    // Récupérer le compte Bluesky de l'utilisateur
    const blueskyAccount = await accountService.getAccountByProviderAndUserId('bluesky', userId);
    
    if (!blueskyAccount) {
      logger.logWarning('API', 'POST /api/newsletter/follow_bot', 'User has no Bluesky account', userId);
      return NextResponse.json(
        { success: false, error: 'No Bluesky account found for this user' },
        { status: 400 }
      );
    }
    
    // Reprendre la session de l'utilisateur
    await blueskyService.resumeSession({
      accessJwt: decrypt(blueskyAccount.access_token),
      refreshJwt: decrypt(blueskyAccount.refresh_token),
      handle: blueskyAccount.username,
      did: blueskyAccount.provider_account_id
    });
    
    // Suivre le compte bot
    const result = await blueskyService.followBot();
    
    if (!result.success) {
      logger.logError('API', 'POST /api/newsletter/follow_bot', new Error(result.error), userId);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Successfully followed the bot account'
    });
    
  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown';
    logger.logError('API', 'POST /api/newsletter/follow_bot', error, userId);
    
    return NextResponse.json(
      { success: false, error: 'Failed to follow bot account' },
      { status: 500 }
    );
  }
}

export const POST = withLogging(followBotHandler);