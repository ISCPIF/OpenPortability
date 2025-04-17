// Type de base pour un utilisateur
export interface User {
    id: string;
    name?: string;
    twitter_id?: string;
    twitter_username?: string;
    twitter_image?: string;
    bluesky_id?: string;
    bluesky_username?: string;
    bluesky_image?: string;
    mastodon_id?: string;
    mastodon_username?: string;
    mastodon_image?: string;
    mastodon_instance?: string;
    email?: string;
    email_verified?: Date;
    image?: string;
    created_at: Date;
    updated_at: Date;
    has_onboarded: boolean;
    hqx_newsletter: boolean;
    oep_accepted: boolean;
    automatic_reconnect: boolean;
    research_accepted: boolean;
    have_seen_newsletter: boolean;
    personalized_support: boolean;
}

// Type pour les mises à jour utilisateur
export type UserUpdate = Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>;

// Types spécifiques pour différents types de mises à jour
export interface NewsletterUpdate extends Pick<UserUpdate, 'email' | 'hqx_newsletter' | 'oep_accepted' | 'research_accepted' | 'have_seen_newsletter' | 'personalized_support'> {}

export interface ShareUpdate extends Pick<UserUpdate, 'twitter_id' | 'twitter_username' | 'twitter_image' | 'bluesky_id' | 'bluesky_username' | 'bluesky_image' | 'mastodon_id' | 'mastodon_username' | 'mastodon_image' | 'mastodon_instance'> {}

// Type pour les événements de partage
export interface ShareEvent {
    id?: string;
    source_id: string;
    platform: string;
    shared_at: string;
    success: boolean;
    created_at: string;
}