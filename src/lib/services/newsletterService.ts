// Types for newsletter data matching DB structure
export type ConsentType = 'email_newsletter' | 'oep_newsletter' | 'research_participation' | 'personalized_support' | 'bluesky_dm' | 'mastodon_dm';

export interface Consent {
  type: ConsentType;
  value: boolean;
}

// Type pour les données brutes reçues de l'API
export interface RawNewsletterResponse {
  email?: string;
  email_newsletter?: boolean;
  oep_newsletter?: boolean;
  research_participation?: boolean;
  personalized_support?: boolean;
  bluesky_dm?: boolean;
  mastodon_dm?: boolean;
}

export interface NewsletterData {
  email?: string;
  consents: {
    [key in ConsentType]?: boolean;
  };
}

/**
 * Fetches all newsletter data
 */
export const fetchNewsletterData = async (): Promise<RawNewsletterResponse> => {
  const response = await fetch('/api/newsletter/request', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch newsletter data');
  }

  return response.json();
};

/**
 * Updates a single newsletter consent
 */
export const updateNewsletterConsent = async (
  consent: Consent,
  email?: string | null
): Promise<boolean> => {
  try {
    // Construire le payload en évitant d'envoyer null ou email invalide
    const payload: any = {
      consents: [consent]
    };
    
    console.log("payload ---->", payload)
    
    // N'ajouter email que s'il est défini, non null, et a un format valide
    if (email && typeof email === 'string' && email.trim() && email.includes('@')) {
      payload.email = email.trim();
    }

    const response = await fetch('/api/newsletter/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update newsletter consent');
    }

    await response.json();
    return true;
  } catch (error) {
    console.error('Error updating newsletter consent:', error);
    return false;
  }
};