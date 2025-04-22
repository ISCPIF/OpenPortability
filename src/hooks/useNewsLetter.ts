import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  fetchNewsletterData,
  updateNewsletterConsent,
  ConsentType,
  NewsletterData,
  RawNewsletterResponse
} from '@/lib/services/newsletterService';

/**
 * A hook for managing newsletter preferences and consents
 */
export function useNewsletter() {
  const { data: session } = useSession();
  const [data, setData] = useState<NewsletterData>({
    email: undefined,
    consents: {
      email_newsletter: false,
      oep_newsletter: false,
      research_participation: false,
      personalized_support: false,
      bluesky_dm: false,
      mastodon_dm: false
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const rawData: RawNewsletterResponse = await fetchNewsletterData();
        
        // Transformer les données brutes en NewsletterData
        const newsletterData: NewsletterData = {
          email: rawData.email,
          consents: {
            email_newsletter: rawData.email_newsletter ?? false,
            oep_newsletter: rawData.oep_newsletter ?? false,
            research_participation: rawData.research_participation ?? false,
            personalized_support: rawData.personalized_support ?? false,
            bluesky_dm: rawData.bluesky_dm ?? false,
            mastodon_dm: rawData.mastodon_dm ?? false
          }
        };
        
        setData(newsletterData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load newsletter data'));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  /**
   * Update a single consent value
   */
  const updateConsent = async (type: ConsentType, value: boolean) => {
    try {
      // Optimistic update
      setData(prev => ({
        ...prev,
        consents: { ...prev.consents, [type]: value }
      }));

      const success = await updateNewsletterConsent({ type, value }, data.email);

      if (!success) {
        // Revert on failure
        setData(prev => ({
          ...prev,
          consents: { ...prev.consents, [type]: !value }
        }));
        throw new Error(`Failed to update ${type}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update consent'));
      return false;
    }
    return true;
  };

  /**
   * Update email and newsletter consent together
   */
  const updateEmailWithNewsletter = async (email: string, subscribeToNewsletter: boolean) => {
    try {
      // Optimistic update
      setData(prev => ({
        ...prev,
        email,
        consents: { ...prev.consents, email_newsletter: subscribeToNewsletter }
      }));

      const success = await updateNewsletterConsent(
        { type: 'email_newsletter', value: subscribeToNewsletter },
        email
      );

      if (!success) {
        // Revert on failure
        setData(prev => ({
          ...prev,
          email: prev.email,
          consents: { ...prev.consents, email_newsletter: !subscribeToNewsletter }
        }));
        throw new Error('Failed to update email subscription');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update email'));
      return false;
    }
    return true;
  };

  /**
   * Update multiple consents at once with optional email
   */
  const updateMultipleConsents = async (consents: { type: ConsentType, value: boolean }[], email?: string) => {
    try {
      // Optimistic update
      setData(prev => ({
        ...prev,
        email: email || prev.email,
        consents: {
          ...prev.consents,
          ...Object.fromEntries(consents.map(({ type, value }) => [type, value]))
        }
      }));

      const success = await updateNewsletterConsent({ consents, email });

      if (!success) {
        // Revert on failure
        setData(prev => ({
          ...prev,
          email: prev.email,
          consents: { ...prev.consents }
        }));
        throw new Error('Failed to update consents');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update consents'));
      return false;
    }
    return true;
  };

  // Helper getters for common consents
  const getConsent = (type: ConsentType) => data?.consents?.[type] ?? false;

  return {
    email: data?.email,
    consents: data?.consents ?? {
      email_newsletter: false,
      oep_newsletter: false,
      research_participation: false,
      personalized_support: false,
      bluesky_dm: false,
      mastodon_dm: false
    },
    isLoading,
    error,
    updateConsent,
    updateEmailWithNewsletter,
    updateMultipleConsents,
    // Common consent getters
    hqxNewsletter: getConsent('email_newsletter'),
    oepAccepted: getConsent('oep_newsletter'),
    researchAccepted: getConsent('research_participation'),
    personalizedSupport: getConsent('personalized_support'),
    blueskyDm: getConsent('bluesky_dm'),
    mastodonDm: getConsent('mastodon_dm'),
  };
}

export type { ConsentType };
