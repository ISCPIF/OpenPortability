import { NextResponse } from "next/server";
import { BskyAgent } from '@atproto/api';
import { z } from "zod";
import { withValidation } from "@/lib/validation/middleware";
import { BlueskyService } from "@/lib/services/blueskyServices";
import { BlueskyRepository } from "@/lib/repositories/blueskyRepository";
import { AccountService } from "@/lib/services/accountService";
import { decrypt } from '@/lib/encryption';
import logger from '@/lib/log_utils';

// Schéma de validation pour le partage sur Bluesky
const BlueskyShareSchema = z.object({
  text: z.string().min(1, "Text can't be empty").max(2000, "Text can't exceed 2000 characters"),
  imageUrl: z.string().optional(), // URL de l'image à joindre (chemin relatif depuis /public)
  imageAlt: z.string().max(1000).optional() // Texte alternatif pour l'image
}).strict();

// Type pour les données validées
type BlueskyShareRequest = z.infer<typeof BlueskyShareSchema>;

const blueskyRepository = new BlueskyRepository();
const blueskyService = new BlueskyService(blueskyRepository);
const accountService = new AccountService();

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
        
        // Si une image est fournie, l'uploader d'abord
        let embed: { $type: string; images: Array<{ alt: string; image: { $type: string; ref: { $link: string }; mimeType: string; size: number } }> } | undefined;
        
        if (data.imageUrl) {
          try {
            // Construire l'URL absolue de l'image
            const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
            const imageFullUrl = `${baseUrl}${data.imageUrl.startsWith('/') ? '' : '/'}${data.imageUrl}`;
            
            // Télécharger l'image
            const imageResponse = await fetch(imageFullUrl);
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch image: ${imageResponse.status}`);
            }
            
            const imageBuffer = await imageResponse.arrayBuffer();
            const uint8Array = new Uint8Array(imageBuffer);
            
            // Déterminer le type MIME
            const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
            
            // Uploader le blob sur Bluesky
            const uploadResponse = await agent.uploadBlob(uint8Array, {
              encoding: contentType
            });
            
            // Créer l'embed avec l'image
            // Cast blob to expected type - ATProto BlobRef includes $type internally
            const blob = uploadResponse.data.blob as unknown as {
              $type: string;
              ref: { $link: string };
              mimeType: string;
              size: number;
            };
            embed = {
              $type: 'app.bsky.embed.images',
              images: [{
                alt: data.imageAlt || 'Image partagée',
                image: blob
              }]
            };
            
            logger.logInfo('API', 'POST /api/share/bluesky', 'Image uploaded successfully', session.user.id, {
              blobSize: uint8Array.length,
              mimeType: contentType
            });
          } catch (imageError) {
            const imgErr = imageError instanceof Error ? imageError : new Error(String(imageError));
            logger.logWarning('API', 'POST /api/share/bluesky', `Failed to upload image: ${imgErr.message}`, session.user.id);
            // Continuer sans l'image si l'upload échoue
          }
        }
        
        const result = await agent.post({
            text: text,
            embed: embed,
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
      const err = error instanceof Error ? error : new Error(String(error))
        logger.logError('API', 'POST /api/share/bluesky', err, session.user.id, {
          context: 'BlueSky post creation'
        });
        return NextResponse.json(
            { success: false, error: err.message || 'Internal server error' },
            { status: 500 }
        );
    }
  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    const err = error instanceof Error ? error : new Error(String(error))

    logger.logError('API', 'POST /api/share/bluesky', err, userId, {
      context: 'Unexpected error in BlueSky share process'
    });
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
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