import { NextResponse } from 'next/server';
import { pgMatchingRepository } from '@/lib/repositories/public/pg-matching-repository';
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"

// Schéma vide car cet endpoint n'a pas besoin de données d'entrée
const EmptySchema = z.object({}).strict()

async function getFollowersHandler(_request: Request, _data: z.infer<typeof EmptySchema>, session: any) {
  try {
    if (!session?.user?.id) {
      console.log('📊 [get_followers] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const hasOnboarded = session.user?.has_onboarded ?? false;
    const twitterId = session.user?.twitter_id?.toString();

    console.log('📊 [get_followers] Fetching follower hashes for user:', userId, { hasOnboarded, hasTwitterId: !!twitterId });

    let hashes: string[] = [];
    let effectiveHashes: string[] = [];
    let totalCount = 0;

    if (hasOnboarded) {
      // Onboarded user: get followers from sources_followers using user UUID directly
      const { data } = await pgMatchingRepository.getFollowerHashesForSourceUuid(userId);
      hashes = data || [];
      totalCount = hashes.length;
    } else if (twitterId) {
      // Non-onboarded user: get sources (people who follow them) from sources_targets using RPC
      // Fetch all pages to get all followers (not just first 1000)
      const PAGE_SIZE = 5000;
      let pageNumber = 0;
      let allHashes: string[] = [];
      
      // First call to get total count
      const firstPage = await pgMatchingRepository.getSourcesOfTargetWithHashes(twitterId, PAGE_SIZE, 0);
      if (firstPage.data) {
        allHashes = firstPage.data.hashes;
        totalCount = firstPage.data.total_count;
        
        // Fetch remaining pages if needed
        const totalPages = Math.ceil(totalCount / PAGE_SIZE);
        for (pageNumber = 1; pageNumber < totalPages; pageNumber++) {
          const { data: pageData } = await pgMatchingRepository.getSourcesOfTargetWithHashes(twitterId, PAGE_SIZE, pageNumber);
          if (pageData) {
            allHashes = allHashes.concat(pageData.hashes);
          }
        }
      }
      hashes = allHashes;
    }

    // Get effective followers (followers who actually followed via OpenPortability)
    // These are the followers who have has_follow_bluesky = TRUE OR has_follow_mastodon = TRUE
    if (twitterId) {
      const { data: effectiveData } = await pgMatchingRepository.getEffectiveFollowerHashesForSource(twitterId);
      effectiveHashes = effectiveData || [];
      console.log('📊 [get_followers] Retrieved', effectiveHashes.length, 'effective follower hashes for user:', userId);
    }

    console.log('📊 [get_followers] Retrieved', hashes.length, 'follower hashes for user:', userId);

    return NextResponse.json({
      hashes,
      effectiveHashes, // Followers who actually followed via OP (to highlight in purple)
      timestamp: Date.now(), // Server timestamp for cache validation
      stats: {
        total_in_graph: hashes.length,
        total_count: totalCount,
        effective_count: effectiveHashes.length,
      }
    });

  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    const err = error instanceof Error ? error : new Error(String(error))
    console.log('📊 [get_followers] Error:', err, userId);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Configuration du middleware de validation
export const GET = withValidation(
  EmptySchema,
  getFollowersHandler,
  {
    requireAuth: true,
    applySecurityChecks: false,
    skipRateLimit: false
  }
)
