import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility function to merge class names.
 * 
 * @param inputs - Variable number of class names to merge.
 * @returns The merged class name.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function isValidEmail(email : string) {
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/email#basic_validation
  const EMAIL_REGEXP = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return EMAIL_REGEXP.test(email);
}

export interface ShareOptions {
  imageUrl?: string;  // Chemin relatif depuis /public (ex: '/share_image.jpeg')
  imageAlt?: string;  // Texte alternatif pour l'image
}

export const handleShare = async (
  text: string, 
  platform: string, 
  session: any, 
  update?: () => void, 
  setIsShared?: (value: boolean) => void,
  options?: ShareOptions
) => {
  if (update) {
    update();
  }

  if (!session?.user) {
      console.error('❌ No user session found, returning');
    return;
  }
  try {
    let url;
    // Remove any existing URLs from the text to prevent duplication
    const textWithoutUrl = text.replace(/➡️ https:\/\/OpenPortability\.org.*$/, '➡️ https://OpenPortability.org');
    
    if (platform === 'bluesky') {
      // Utiliser l'API pour poster directement sur BlueSky (avec image optionnelle)
      const response = await fetch('/api/share/bluesky', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textWithoutUrl,
          imageUrl: options?.imageUrl,
          imageAlt: options?.imageAlt
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to share to BlueSky');
      }
            
      // Ouvrir le post dans une nouvelle fenêtre si possible
      if (result.uri) {
        const postId = result.uri.split('/').pop();
        const userDid = result.uri.split('/')[2];
        window.open(`https://bsky.app/profile/${userDid}/post/${postId}`, '_blank');
      }
    } else if (platform === 'mastodon') {
      if (!session.user.mastodon_instance) {
        console.error('❌ No Mastodon instance found for user');
        return;
      }
      
      // Si une image est fournie, utiliser l'API pour poster avec l'image
      if (options?.imageUrl) {
        const response = await fetch('/api/share/mastodon', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: textWithoutUrl,
            imageUrl: options.imageUrl,
            imageAlt: options.imageAlt
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to share to Mastodon');
        }
        
        // Ouvrir le post dans une nouvelle fenêtre si possible
        if (result.url) {
          window.open(result.url, '_blank');
        }
      } else {
        // Sans image, utiliser le Web Intent classique
        const instance = session.user.mastodon_instance.replace(/^https?:\/\//, '');
        url = `https://${instance}/share?text=${encodeURIComponent(textWithoutUrl)}`;
        window.open(url, '_blank');
      }
    } else {
      const platformUrls = {
        twitter: 'https://twitter.com',
      };
      url = `${platformUrls[platform as keyof typeof platformUrls]}/share?text=${encodeURIComponent(textWithoutUrl)}`;
      window.open(url, '_blank');
    }

    if (setIsShared) {
      setIsShared(true);
    }
  } catch (error) {
    console.error('❌ Error during share process:', error);
  }
};