import { NextResponse } from "next/server";
import { BskyAgent } from '@atproto/api';
import { BlueskyService } from "@/lib/services/blueskyServices";
import { BlueskyRepository } from "@/lib/repositories/blueskyRepository";
import { AccountService } from "@/lib/services/accountService"
import { decrypt } from '@/lib/encryption';
import logger from '@/lib/log_utils';
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"

const blueskyRepository = new BlueskyRepository();
const blueskyService = new BlueskyService(blueskyRepository);
const accountService = new AccountService()

// Schéma de validation pour le partage sur Bluesky
const BlueskyShareSchema = z.object({
  text: z.string().min(1, "Le texte ne peut pas être vide").max(300, "Le texte ne peut pas dépasser 300 caractères")
}).strict();

// Type pour les données validées
type BlueskyShareRequest = z.infer<typeof BlueskyShareSchema>;

async function blueskyShareHandler(req: Request, data: BlueskyShareRequest, session: any) {
  try {
    const { text } = data;
    
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
        
        logger.logInfo('API', 'POST /api/share/bluesky', 'Post shared successfully on Bluesky', session.user.id, {
          uri: result.uri
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
    const userId = session?.user?.id || 'unknown';
    logger.logError('API', 'POST /api/share/bluesky', error, userId, {
      context: 'Unexpected error in BlueSky share process'
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Configuration du middleware de validation
export const POST = withValidation(
  BlueskyShareSchema,
  blueskyShareHandler,
  {
    requireAuth: true,
    applySecurityChecks: true, // Vérifications de sécurité pour le texte du post
    skipRateLimit: false
  }
)