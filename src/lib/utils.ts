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

export const handleShare = async (text: string, platform: string, session: any, update?: () => void, setIsShared?: (value: boolean) => void) => {
  if (update) {
    update();
  }

  if (!session?.user) {
    console.log('❌ No user session found, returning');
    return;
  }

  console.log('TEXT IS -->', text);

  try {
    let url;
    // Remove any existing URLs from the text to prevent duplication
    const textWithoutUrl = text.replace(/➡️ https:\/\/OpenPortability\.org.*$/, '➡️ https://OpenPortability.org');
    
    if (platform === 'bluesky') {
      // Utiliser l'API pour poster directement sur BlueSky
      const response = await fetch('/api/share/bluesky', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textWithoutUrl
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to share to BlueSky');
      }
      
      console.log('✅ Posted to BlueSky successfully', result);
      
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
      // Remove any protocol prefix from the instance
      const instance = session.user.mastodon_instance.replace(/^https?:\/\//, '');
      url = `https://${instance}/share?text=${encodeURIComponent(textWithoutUrl)}`;
      window.open(url, '_blank');
    } else {
      const platformUrls = {
        twitter: 'https://twitter.com',
      };
      url = `${platformUrls[platform as keyof typeof platformUrls]}/share?text=${encodeURIComponent(textWithoutUrl)}`;
      window.open(url, '_blank');
    }

    console.log('✅ Sharing completed');

    if (setIsShared) {
      setIsShared(true);
    }
  } catch (error) {
    console.error('❌ Error during share process:', error);
  }
};