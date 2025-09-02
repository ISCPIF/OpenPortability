import { NextRequest, NextResponse } from 'next/server';
import { withValidation } from '@/lib/validation/middleware';
import { EmptySchema } from '@/lib/validation/schemas';
import { MatchingService } from '@/lib/services/matchingService';
import { MatchingRepository } from '@/lib/repositories/matchingRepository';
import logger from '@/lib/log_utils';
import { StatsRepository } from '@/lib/repositories/statsRepository';
import { StatsService } from '@/lib/services/statsServices';

interface UserNetworkConnection {
  twitter_id: string;
  isReconnected: boolean;
}

interface UserNetworkResponse {
  following: UserNetworkConnection[];
  followers: UserNetworkConnection[];
  stats: {
    followingCount: number;
    followersCount: number;
    totalConnections: number;
    reconnectedCount: number;
    isLimited: boolean;
  };
}

async function handleGetUserNetwork(
  request: NextRequest,
  data: {},
  session: any
): Promise<NextResponse> {
  const userId = '10331991-0f76-4425-952f-27e25a494d2c';
  const twitterId = session?.user?.twitter_id;

  logger.logInfo('UserNetwork', 'GET /api/connections/graph/user-network', 'Fetching user network', userId, {
    twitterId
  });

  try {
    const matchingService = new MatchingService();
    const matchingRepository = new MatchingRepository();

    // Récupérer le réseau existant et les connexions retrouvées en parallèle
    const [userNetwork, userStats, socialGraphResult] = await Promise.all([
      matchingService.getUserNetworkIds(userId),
      (async () => {
        const statsRepository = new StatsRepository();
        const statsService = new StatsService(statsRepository);
        return await statsService.getUserStats(userId, true);
      })(),
      // Essayer d'abord avec l'UUID, puis avec le twitter_id si disponible
      matchingRepository.getSocialGraphData(userId)
    ]);

    // Si pas de résultat avec l'UUID et qu'on a un twitter_id, essayer avec
    let socialGraphData = socialGraphResult.data;
    if (!socialGraphData && twitterId) {
      logger.logInfo('UserNetwork', 'GET /api/connections/graph/user-network', 'Retrying with twitter_id', userId, {
        twitterId
      });
      const fallbackResult = await matchingRepository.getSocialGraphData(twitterId);
      socialGraphData = fallbackResult.data;
    }

    // Créer des Sets pour les connexions retrouvées
    const reconnectedFollowing = new Set<string>();
    const reconnectedFollowers = new Set<string>();

    if (socialGraphData) {
      if (socialGraphData.strategy === 'user_with_archive') {
        // Ajouter les targets reconnectés
        socialGraphData.targets.bluesky.forEach(target => reconnectedFollowing.add(target.twitter_id));
        socialGraphData.targets.mastodon.forEach(target => reconnectedFollowing.add(target.twitter_id));
        
        // Ajouter les followers reconnectés
        socialGraphData.followers.bluesky.forEach(follower => reconnectedFollowers.add(follower.twitter_id));
        socialGraphData.followers.mastodon.forEach(follower => reconnectedFollowers.add(follower.twitter_id));
      } else {
        // Pour user_without_archive, les sources sont des connexions inverses
        socialGraphData.found_in_sources.bluesky.forEach(source => reconnectedFollowers.add(source.source_twitter_id));
        socialGraphData.found_in_sources.mastodon.forEach(source => reconnectedFollowers.add(source.source_twitter_id));
      }
    }

    // Fusionner les listes avec déduplication et flag isReconnected
    const followingWithFlags: UserNetworkConnection[] = [];
    const followersWithFlags: UserNetworkConnection[] = [];

    // Traiter following
    const allFollowing = new Set([...userNetwork.following, ...reconnectedFollowing]);
    allFollowing.forEach(twitterId => {
      followingWithFlags.push({
        twitter_id: twitterId,
        isReconnected: reconnectedFollowing.has(twitterId)
      });
    });

    // Traiter followers
    const allFollowers = new Set([...userNetwork.followers, ...reconnectedFollowers]);
    allFollowers.forEach(twitterId => {
      followersWithFlags.push({
        twitter_id: twitterId,
        isReconnected: reconnectedFollowers.has(twitterId)
      });
    });

    // Calculer les stats
    const reconnectedCount = reconnectedFollowing.size + reconnectedFollowers.size;
    const isLimited = userNetwork.following.length >= 100000 || userNetwork.followers.length >= 100000;

    logger.logInfo('UserNetwork', 'GET /api/connections/graph/user-network', 'User network fetched successfully', userId, {
      originalFollowingCount: userNetwork.following.length,
      originalFollowersCount: userNetwork.followers.length,
      finalFollowingCount: followingWithFlags.length,
      finalFollowersCount: followersWithFlags.length,
      reconnectedCount,
      socialGraphStrategy: socialGraphData?.strategy || 'none',
      isLimited
    });

    const response: UserNetworkResponse = {
      following: followingWithFlags,
      followers: followersWithFlags,
      stats: {
        followingCount: userStats.connections.following,
        followersCount: userStats.connections.followers,
        totalConnections: userStats.connections.following + userStats.connections.followers,
        reconnectedCount,
        isLimited
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.logError('UserNetwork', 'GET /api/connections/graph/user-network', 'Failed to fetch user network', userId, error);
    return NextResponse.json(
      { error: 'Failed to fetch user network' },
      { status: 500 }
    );
  }
}

export const GET = withValidation(
  EmptySchema,
  handleGetUserNetwork,
  {
    requireAuth: true,
    applySecurityChecks: false, // GET sans paramètres
    skipRateLimit: false
  }
);
