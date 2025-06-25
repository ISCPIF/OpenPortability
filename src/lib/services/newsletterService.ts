// Types for newsletter data matching DB structure
export type ConsentType = 'hqx_newsletter' | 'oep_newsletter' | 'research_participation' | 'automatic_reconnect' | 'email_newsletter' | 'personalized_support' | 'dm_consent' | 'bluesky_dm' | 'mastodon_dm';

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
  hqx_newsletter?: boolean;
  automatic_reconnect?: boolean;
  dm_consent?: boolean;
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
 * Updates a single newsletter consent or multiple consents
 * @param consentData - Single consent object {type, value} or object with consents array
 * @param email - Optional email to update
 * @returns Promise resolving to success boolean
 */
export const updateNewsletterConsent = async (
  consentData: Consent | { consents: Consent[] },
  email?: string
): Promise<boolean> => {
  try {
    // Préparer les données selon le format exact attendu par l'API
    let requestBody: any;
    
    // Format 1: Consentement unique directement dans l'objet racine
    if ('type' in consentData && 'value' in consentData) {
      requestBody = {
        type: consentData.type,
        value: consentData.value
      };
      
      // Ajouter l'email seulement s'il est fourni et valide
      if (email && email !== "none" && email.trim() !== "") {
        requestBody.email = email;
      }
    } 
    // Format 2: Tableau de consentements
    else if ('consents' in consentData && Array.isArray(consentData.consents)) {
      // S'assurer que chaque consentement a le format {type, value} exact
      const formattedConsents = consentData.consents.map(consent => ({
        type: consent.type,
        value: consent.value
      }));
      
      requestBody = {
        consents: formattedConsents
      };
      
      // Ajouter l'email seulement s'il est fourni et valide
      if (email && email !== "none" && email.trim() !== "") {
        requestBody.email = email;
      }
    } else {
      throw new Error('Invalid consent data format');
    }
    
    console.log('Sending newsletter consent update:', JSON.stringify(requestBody));
    
    const response = await fetch('/api/newsletter/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      console.error('Newsletter consent update failed with status:', response.status);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      throw new Error(`Failed to update newsletter consent: ${response.status}`);
    }

    const result = await response.json();
    console.log('Newsletter consent update success:', result);
    return true;
  } catch (error) {
    console.error('Error updating newsletter consent:', error);
    return false;
  }
};