export interface BlueskyProfile {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  }
  
  export function isBlueskyProfile(profile: unknown): profile is BlueskyProfile {
    return (
      typeof profile === "object" &&
      profile !== null &&
      typeof (profile as BlueskyProfile).did === "string" &&
      typeof (profile as BlueskyProfile).handle === "string" &&
      (typeof (profile as BlueskyProfile).displayName === "undefined" || 
       typeof (profile as BlueskyProfile).displayName === "string") &&
      (typeof (profile as BlueskyProfile).avatar === "undefined" || 
       typeof (profile as BlueskyProfile).avatar === "string")
    );
  }
  