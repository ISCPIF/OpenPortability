import { NextResponse } from "next/server";
import { z } from "zod";
import { withValidation } from "@/lib/validation/middleware";
import { AccountService } from "@/lib/services/accountService";
import { pgUserRepository } from "@/lib/repositories/auth/pg-user-repository";
import { decrypt } from '@/lib/encryption';
import logger from '@/lib/log_utils';

// Schéma de validation pour le partage sur Mastodon
const MastodonShareSchema = z.object({
  text: z.string().min(1, "Text can't be empty").max(500, "Text can't exceed 500 characters"),
  imageUrl: z.string().optional(), // URL de l'image à joindre (chemin relatif depuis /public)
  imageAlt: z.string().max(1500).optional() // Texte alternatif pour l'image
}).strict();

// Type pour les données validées
type MastodonShareRequest = z.infer<typeof MastodonShareSchema>;

const accountService = new AccountService();

async function mastodonShareHandler(req: Request, data: MastodonShareRequest, session: any) {
  try {
    const { text } = data;
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'POST /api/share/mastodon', 'User not authenticated');
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Récupérer le compte Mastodon
    const account = await accountService.getAccountByProviderAndUserId('mastodon', session.user.id);    
    if (!account || !account.access_token) {
      logger.logWarning('API', 'POST /api/share/mastodon', 'Not authorized to share on Mastodon', session.user.id);
      return NextResponse.json(
        { success: false, error: 'Not authorized to share on Mastodon' },
        { status: 401 }
      );
    }

    // Récupérer l'instance Mastodon de l'utilisateur
    const user = await pgUserRepository.getUser(session.user.id);
    if (!user?.mastodon_instance) {
      logger.logWarning('API', 'POST /api/share/mastodon', 'No Mastodon instance found', session.user.id);
      return NextResponse.json(
        { success: false, error: 'No Mastodon instance configured' },
        { status: 400 }
      );
    }

    const mastodonInstance = user.mastodon_instance;
    const accessToken = decrypt(account.access_token);

    try {
      let mediaId: string | undefined;

      // Si une image est fournie, l'uploader d'abord
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
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          
          // Créer un FormData pour l'upload
          const formData = new FormData();
          const blob = new Blob([imageBuffer], { type: contentType });
          
          // Déterminer l'extension du fichier
          const extension = contentType.split('/')[1] || 'jpg';
          formData.append('file', blob, `image.${extension}`);
          
          if (data.imageAlt) {
            formData.append('description', data.imageAlt);
          }
          
          // Uploader le média sur Mastodon
          const mediaResponse = await fetch(`${mastodonInstance}/api/v2/media`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            },
            body: formData
          });
          
          if (!mediaResponse.ok) {
            const errorText = await mediaResponse.text();
            throw new Error(`Media upload failed: ${mediaResponse.status} - ${errorText}`);
          }
          
          const mediaData = await mediaResponse.json();
          mediaId = mediaData.id;
          
          logger.logInfo('API', 'POST /api/share/mastodon', 'Image uploaded successfully', session.user.id, {
            mediaId,
            mimeType: contentType
          });
        } catch (imageError) {
          const imgErr = imageError instanceof Error ? imageError : new Error(String(imageError));
          logger.logWarning('API', 'POST /api/share/mastodon', `Failed to upload image: ${imgErr.message}`, session.user.id);
          // Continuer sans l'image si l'upload échoue
        }
      }

      // Créer le post (status) sur Mastodon
      const statusFormData = new FormData();
      statusFormData.append('status', text);
      
      if (mediaId) {
        statusFormData.append('media_ids[]', mediaId);
      }
      
      const statusResponse = await fetch(`${mastodonInstance}/api/v1/statuses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: statusFormData
      });
      
      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new Error(`Status creation failed: ${statusResponse.status} - ${errorText}`);
      }
      
      const statusData = await statusResponse.json();
      
      logger.logInfo('API', 'POST /api/share/mastodon', 'Post shared successfully on Mastodon', session.user.id, {
        statusId: statusData.id,
        url: statusData.url
      });
      
      return NextResponse.json({
        success: true,
        id: statusData.id,
        url: statusData.url
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.logError('API', 'POST /api/share/mastodon', err, session.user.id, {
        context: 'Mastodon post creation'
      });
      return NextResponse.json(
        { success: false, error: err.message || 'Internal server error' },
        { status: 500 }
      );
    }
  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    const err = error instanceof Error ? error : new Error(String(error));

    logger.logError('API', 'POST /api/share/mastodon', err, userId, {
      context: 'Unexpected error in Mastodon share process'
    });
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Configuration du middleware de validation
export const POST = withValidation(
  MastodonShareSchema,
  mastodonShareHandler,
  {
    requireAuth: true,
    applySecurityChecks: true,
    skipRateLimit: false
  }
)
