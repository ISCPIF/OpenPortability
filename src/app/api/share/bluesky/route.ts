import { NextResponse } from "next/server";
import { Agent } from '@atproto/api';
import { z } from "zod";
import { withValidation } from "@/lib/validation/middleware";
import { AccountService } from "@/lib/services/accountService";
import { createBlueskyOAuthClient } from "@/lib/services/blueskyOAuthClient";
import logger from '@/lib/log_utils';
import { readFileSync } from 'fs';
import { join } from 'path';

// Schéma de validation pour le partage sur Bluesky
const BlueskyShareSchema = z.object({
  text: z.string().min(1, "Text can't be empty").max(2000, "Text can't exceed 2000 characters"),
  imageUrl: z.string().optional(), // URL de l'image à joindre (chemin relatif depuis /public)
  imageAlt: z.string().max(1000).optional() // Texte alternatif pour l'image
}).strict();

// Type pour les données validées
type BlueskyShareRequest = z.infer<typeof BlueskyShareSchema>;

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
    if (!account || !account.provider_account_id) {
      logger.logWarning('API', 'POST /api/share/bluesky', 'Not authorized to share on BlueSky', session.user.id);
      return NextResponse.json(
        { success: false, error: 'Not authorized to share on Bluesky' },
        { status: 401 }
      );
    }

    const did = account.provider_account_id;
    
    try {
        // Use OAuth client to restore session with DPoP support
        const oauthClient = await createBlueskyOAuthClient();
        const oauthSession = await oauthClient.restore(did);
        
        if (!oauthSession) {
          logger.logError('API', 'POST /api/share/bluesky', new Error('Failed to restore OAuth session'), session.user.id, {
            context: 'BlueSky OAuth session restoration'
          });
          return NextResponse.json(
            { success: false, error: 'Bluesky session expired - please reconnect your account' },
            { status: 401 }
          );
        }
        
        // Create agent with OAuth session
        const agent = new Agent(oauthSession);
        
        // Si une image est fournie, l'uploader d'abord
        let embed: { $type: string; images: Array<{ alt: string; image: { $type: string; ref: { $link: string }; mimeType: string; size: number } }> } | undefined;
        
        if (data.imageUrl) {
          try {
            // Lire l'image depuis le filesystem (public folder)
            const imagePath = data.imageUrl.startsWith('/') ? data.imageUrl.slice(1) : data.imageUrl;
            const publicDir = process.cwd();
            const fullPath = join(publicDir, 'public', imagePath);
            
            let uint8Array: Uint8Array;
            let contentType = 'image/jpeg';
            
            try {
              const imageBuffer = readFileSync(fullPath);
              uint8Array = new Uint8Array(imageBuffer);
              // Déterminer le type MIME basé sur l'extension
              if (imagePath.endsWith('.png')) contentType = 'image/png';
              else if (imagePath.endsWith('.gif')) contentType = 'image/gif';
              else if (imagePath.endsWith('.webp')) contentType = 'image/webp';
            } catch (fsError) {
              // Fallback: essayer de fetch via HTTP si le fichier n'existe pas localement
              const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
              const imageFullUrl = `${baseUrl}${data.imageUrl.startsWith('/') ? '' : '/'}${data.imageUrl}`;
              
              const imageResponse = await fetch(imageFullUrl);
              if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image: ${imageResponse.status}`);
              }
              
              const arrayBuffer = await imageResponse.arrayBuffer();
              uint8Array = new Uint8Array(arrayBuffer);
              contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
            }
            
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