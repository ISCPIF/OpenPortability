interface ConnectedServicesInfoProps {
    session: any;
  }
  
  export default function ConnectedServicesInfo({ session }: ConnectedServicesInfoProps) {
    const hasMastodon = session?.user?.mastodon_id;
    const hasBluesky = session?.user?.bluesky_id;
    const hasTwitter = session?.user?.twitter_id;
    const hasOnboarded = session?.user?.has_onboarded;
    
    const connectedServicesCount = [hasMastodon, hasBluesky, hasTwitter].filter(Boolean).length;
    
    return { hasMastodon, hasBluesky, hasTwitter, hasOnboarded, connectedServicesCount };
  }