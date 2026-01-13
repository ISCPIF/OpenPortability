import { NextResponse } from 'next/server';
import { pgMatchingRepository } from '@/lib/repositories/public/pg-matching-repository';
import logger from '@/lib/log_utils';
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"

/**
 * POST /api/graph/highlights
 * 
 * Lightweight API to get only the follow status updates for specific coord_hashes.
 * Used after a follow action to update highlights without refetching all data.
 * 
 * Request body:
 * {
 *   coord_hashes: string[]  // List of coord_hashes to check status for
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   updates: { [coord_hash: string]: { has_follow_bluesky: boolean; has_follow_mastodon: boolean } }
 *   timestamp: number  // Server timestamp for cache invalidation
 * }
 */

const PostSchema = z.object({
  coord_hashes: z.array(z.string()).min(1).max(500), // Limit to 500 hashes per request
}).strict()

async function highlightsHandler(request: Request, data: z.infer<typeof PostSchema>, session: any) {
  try {
    if (!session?.user?.id) {
      logger.logError('API', 'POST /api/graph/highlights', 'Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const hasOnboarded = session.user?.has_onboarded ?? false;
    const { coord_hashes } = data;

    console.log(
      '📊 [highlights] Checking status for',
      coord_hashes.length,
      'hashes, user:',
      userId
    );

    // Only onboarded users have follow status in sources_targets
    if (!hasOnboarded) {
      // Return empty updates for non-onboarded users
      const updates: Record<string, { has_follow_bluesky: boolean; has_follow_mastodon: boolean }> = {};
      coord_hashes.forEach((hash: string) => {
        updates[hash] = { has_follow_bluesky: false, has_follow_mastodon: false };
      });
      
      return NextResponse.json({
        success: true,
        updates,
        timestamp: Date.now(),
      });
    }

    // Get current follow status for these hashes
    const { data: allHashes } = await pgMatchingRepository.getFollowingHashesForOnboardedUser(userId);
    
    // Build a map of coord_hash -> status
    const statusMap = new Map<string, { has_follow_bluesky: boolean; has_follow_mastodon: boolean }>();
    if (allHashes) {
      for (const h of allHashes) {
        statusMap.set(h.coord_hash, {
          has_follow_bluesky: h.has_follow_bluesky,
          has_follow_mastodon: h.has_follow_mastodon,
        });
      }
    }

    // Filter to only requested hashes
    const updates: Record<string, { has_follow_bluesky: boolean; has_follow_mastodon: boolean }> = {};
    for (const hash of coord_hashes) {
      const status = statusMap.get(hash);
      if (status) {
        updates[hash] = status;
      } else {
        // Hash not in user's followings - return false for both
        updates[hash] = { has_follow_bluesky: false, has_follow_mastodon: false };
      }
    }

    console.log(
      '📊 [highlights] Returning status for',
      Object.keys(updates).length,
      'hashes'
    );

    return NextResponse.json({
      success: true,
      updates,
      timestamp: Date.now(),
    });

  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    const err = error instanceof Error ? error : new Error(String(error))
    logger.logError('API', 'POST /api/graph/highlights', err, userId, {
      context: 'Error in highlights route'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Configuration du middleware de validation
export const POST = withValidation(
  PostSchema,
  highlightsHandler,
  {
    requireAuth: true,
    applySecurityChecks: false,
    skipRateLimit: false
  }
)
