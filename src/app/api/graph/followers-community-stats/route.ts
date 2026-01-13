import { NextResponse } from 'next/server';
import { pgMatchingRepository } from '@/lib/repositories/public/pg-matching-repository';
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"

// Community labels - same as in FloatingFollowersCommunityPanel
const COMMUNITY_LABELS: Record<number, string> = {
  0: 'Gaming / Esports',
  1: 'Science / Environment',
  2: 'Sports / Business',
  3: 'Journalism / International',
  4: 'Entertainment / LGBTQ+',
  5: 'Spanish Media',
  6: 'French Media',
  7: 'Science / Research',
  8: 'Adult Content',
  9: 'Music / Art',
};

// Community colors - same as default in useCommunityColors
const COMMUNITY_COLORS: Record<number, string> = {
  0: '#FF6B6B',
  1: '#4ECDC4',
  2: '#45B7D1',
  3: '#96CEB4',
  4: '#FFEAA7',
  5: '#DDA0DD',
  6: '#98D8C8',
  7: '#F7DC6F',
  8: '#BB8FCE',
  9: '#85C1E9',
};

// Schéma vide car cet endpoint n'a pas besoin de données d'entrée
const EmptySchema = z.object({}).strict()

interface CommunityStatWithMeta {
  community: number;
  label: string;
  color: string;
  count: number;
  percentage: number;
}

async function getFollowersCommunityStatsHandler(_request: Request, _data: z.infer<typeof EmptySchema>, session: any) {
  try {
    if (!session?.user?.id) {
      console.log('📊 [followers-community-stats] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const hasOnboarded = session.user?.has_onboarded ?? false;
    const twitterId = session.user?.twitter_id?.toString();

    console.log('📊 [followers-community-stats] Fetching community stats for user:', userId, { hasOnboarded, hasTwitterId: !!twitterId });

    let communities: CommunityStatWithMeta[] = [];
    let totalFollowersInGraph = 0;

    if (hasOnboarded) {
      // Onboarded user: get follower community stats using user UUID
      const { data, error } = await pgMatchingRepository.getFollowerCommunityStats(userId);
      if (error) {
        console.error('📊 [followers-community-stats] Error fetching stats:', error);
        return NextResponse.json({ error: 'Failed to fetch community stats' }, { status: 500 });
      }
      if (data) {
        totalFollowersInGraph = data.totalFollowersInGraph;
        communities = data.communities.map(c => ({
          ...c,
          label: COMMUNITY_LABELS[c.community] || `Community ${c.community}`,
          color: COMMUNITY_COLORS[c.community] || '#888888',
        }));
      }
    } else if (twitterId) {
      // Non-onboarded user: get stats for target
      const { data, error } = await pgMatchingRepository.getFollowerCommunityStatsForTarget(twitterId);
      if (error) {
        console.error('📊 [followers-community-stats] Error fetching stats for target:', error);
        return NextResponse.json({ error: 'Failed to fetch community stats' }, { status: 500 });
      }
      if (data) {
        totalFollowersInGraph = data.totalFollowersInGraph;
        communities = data.communities.map(c => ({
          ...c,
          label: COMMUNITY_LABELS[c.community] || `Community ${c.community}`,
          color: COMMUNITY_COLORS[c.community] || '#888888',
        }));
      }
    }

    console.log('📊 [followers-community-stats] Retrieved', communities.length, 'communities for', totalFollowersInGraph, 'followers');

    return NextResponse.json({
      communities,
      totalFollowersInGraph,
      // Include labels and colors for convenience
      meta: {
        labels: COMMUNITY_LABELS,
        colors: COMMUNITY_COLORS,
      }
    });

  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('📊 [followers-community-stats] Error:', err, userId);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Configuration du middleware de validation
export const GET = withValidation(
  EmptySchema,
  getFollowersCommunityStatsHandler,
  {
    requireAuth: true,
    applySecurityChecks: false,
    skipRateLimit: false
  }
)
