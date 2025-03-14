import { NextResponse } from "next/server";
import { BskyAgent } from '@atproto/api';
import { auth } from "@/app/auth";
import { BlueskyService } from "@/lib/services/blueskyServices";
import { BlueskyRepository } from "@/lib/repositories/blueskyRepository";
import { AccountService } from "@/lib/services/accountService"
import { decrypt } from '@/lib/encryption';
import logger, { withLogging } from '@/lib/log_utils';

const blueskyRepository = new BlueskyRepository();
const blueskyService = new BlueskyService(blueskyRepository);
const accountService = new AccountService()

async function blueskyShareHandler(req: Request) {
  try {
    const { text } = await req.json();    
    const session = await auth();    
    if (!session?.user?.id) {
      logger.logWarning('API', 'POST /api/share/bluesky', 'User not authenticated');
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      );
    }

    const account = await accountService.getAccountByProviderAndUserId('bluesky', session.user.id);    
    if (!account || (!account.access_token && !account.refresh_token)) {
      logger.logWarning('API', 'POST /api/share/bluesky', 'Not authorized to share on BlueSky', session.user.id);
      return NextResponse.json(
        { success: false, error: 'Not authorized to share on Bluesky' },
        { status: 401 }
      );
    }

    const agent = new BskyAgent({ service: 'https://bsky.social' });
    try {
        const accessToken = decrypt(account.access_token);
        const refreshToken = decrypt(account.refresh_token);
        await agent.resumeSession({
          accessJwt: accessToken,
          refreshJwt: refreshToken,
          handle: account.provider_account_id.split('.')[0],
          did: account.provider_account_id,
          active: true
        });

        if (!agent.session) {
          logger.logError('API', 'POST /api/share/bluesky', new Error('Failed to resume session on BlueSky'), session.user.id, {
            context: 'BlueSky session resumption'
          });
          return NextResponse.json(
            { success: false, error: 'Failed to resume session on Bluesky' },
            { status: 500 }
          );
        }
        const result = await agent.post({
            text: text,
            createdAt: new Date().toISOString()
          });        
        return NextResponse.json({
          success: true,
          uri: result.uri,
          cid: result.cid
        });
    }
    catch (error) {
        logger.logError('API', 'POST /api/share/bluesky', error, session.user.id, {
          context: 'BlueSky post creation'
        });
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
          );
      }
  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown';
    logger.logError('API', 'POST /api/share/bluesky', error, userId, {
      context: 'Unexpected error in BlueSky share process'
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withLogging(blueskyShareHandler);