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

  try {
    let url;
    if (platform === 'mastodon') {
      if (!session.user.mastodon_instance) {
        console.error('❌ No Mastodon instance found for user');
        return;
      }
      // Remove any protocol prefix from the instance
      const instance = session.user.mastodon_instance.replace(/^https?:\/\//, '');
      url = `https://${instance}/share?text=${encodeURIComponent(text)}`;
    } else {
      const platformUrls = {
        twitter: 'https://twitter.com',
        bluesky: 'https://bsky.app'
      };
      url = `${platformUrls[platform as keyof typeof platformUrls]}/share?text=${encodeURIComponent(text)}`;
    }

    window.open(url, '_blank');
    console.log('✅ URL opened in new tab');

    // const response = await fetch('/api/share', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     platform,
    //     success: true
    //   })
    // });

    // if (!response.ok) {
    //   throw new Error('Failed to record share event');
    // }
    // if (setIsShared) {
    //   setIsShared(true);
    // }
  } catch (error) {
    console.error('❌ Error during share process:', error);

    // await fetch('/api/share', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     platform,
    //     success: false
    //   })
    // }).catch(console.error);
  }
};
