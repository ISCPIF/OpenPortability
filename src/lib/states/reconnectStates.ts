// src/lib/states/reconnectStates.ts
export enum ReconnectState {
    LOADING = 'loading',
    NO_CONNECTED_SERVICES = 'no_connected_services',
    MISSING_TOKEN = 'missing_token',
    PARTIAL_CONNECTED_SERVICES = 'partial_connected_services',
    AUTOMATIC_RECONNECTION = 'automatic_reconnection',
    RECONNECTION_COMPLETE = 'reconnection_complete',
    SHOW_OPTIONS = 'show_options',
    MANUAL_RECONNECTION = 'manual_reconnection',
  }
  
  export type ReconnectStateParams = {
    isLoading: boolean;
    isAuthenticated: boolean;
    hasOnboarded: boolean;
    hasTwitter: boolean;
    hasBluesky: boolean;
    hasMastodon: boolean;
    missingProviders: string[];
    statsLoaded: boolean;
    blueskyNotFollowed: number;
    mastodonNotFollowed: number;
    isReconnectionComplete: boolean;
    isAutomaticReconnect: boolean;
    showOptions: boolean;
    blueskyHasFollowed: number;
    mastodonHasFollowed: number;
  };
  
  export function determineReconnectState(params: ReconnectStateParams): ReconnectState {
    const {
      isLoading,
      isAuthenticated,
      hasOnboarded,
      hasTwitter,
      hasBluesky,
      hasMastodon,
      missingProviders,
      statsLoaded,
      blueskyNotFollowed,
      mastodonNotFollowed,
      isReconnectionComplete,
      isAutomaticReconnect,
      showOptions,
      blueskyHasFollowed,
      mastodonHasFollowed,
    } = params;
  
    // Ajouter des logs pour déboguer
    console.log("determineReconnectState params:", {
      hasBluesky,
      hasMastodon,
      missingProviders,
      blueskyNotFollowed,
      mastodonNotFollowed,
      isReconnectionComplete,
      isAutomaticReconnect,
      showOptions,
      blueskyHasFollowed,
      mastodonHasFollowed
    });
  
    // État de chargement
    if (isLoading) {
      return ReconnectState.LOADING;
    }
  
    // Vérifications de redirection gérées au niveau du hook useReconnectState
    
    // Aucun compte connecté
    if (!hasBluesky && !hasMastodon) {
      return ReconnectState.NO_CONNECTED_SERVICES;
    }
  
    // Tokens manquants pour certains services - vérifier que les services manquants correspondent aux services connectés
    const hasMissingBlueskyToken = hasBluesky && missingProviders.includes('bluesky') && blueskyNotFollowed > 0;
    const hasMissingMastodonToken = hasMastodon && missingProviders.includes('mastodon') && mastodonNotFollowed > 0;
    
    if (hasMissingBlueskyToken || hasMissingMastodonToken) {
      return ReconnectState.MISSING_TOKEN;
    }
  
    // Reconnexion complète - vérifier AVANT le mode automatique pour permettre de sortir du mode automatique
    // Ne vérifier que les services que l'utilisateur utilise réellement
    const blueskyComplete = !hasBluesky || (blueskyNotFollowed === 0 && blueskyHasFollowed > 0);
    const mastodonComplete = !hasMastodon || (mastodonNotFollowed === 0 && mastodonHasFollowed > 0);
    
    if (isReconnectionComplete || (statsLoaded && blueskyComplete && mastodonComplete)) {
      return ReconnectState.RECONNECTION_COMPLETE;
    }
    
    // Reconnexion automatique en cours - vérifier APRÈS la condition de reconnexion complète
    if (isAutomaticReconnect) {
      return ReconnectState.AUTOMATIC_RECONNECTION;
    }
    
    // Mode manuel activé - quand showOptions est à false mais qu'on n'est pas en mode automatique
    if (!showOptions && !isAutomaticReconnect && (hasBluesky || hasMastodon)) {
      return ReconnectState.MANUAL_RECONNECTION;
    }
  
    // Affichage des options (choix entre mode automatique et manuel)
    if (showOptions && (hasBluesky || hasMastodon)) {
      return ReconnectState.SHOW_OPTIONS;
    }
  
    // Un service est connecté mais pas l'autre
    if ((hasBluesky && !hasMastodon) || (!hasBluesky && hasMastodon)) {
      return ReconnectState.PARTIAL_CONNECTED_SERVICES;
    }
  
    // Par défaut: afficher les options
    return ReconnectState.SHOW_OPTIONS;
  }