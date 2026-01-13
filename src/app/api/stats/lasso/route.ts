import { NextRequest, NextResponse } from 'next/server'
import { pgLassoRepository } from '@/lib/repositories/public/pg-lasso-repository'
import { graphNodesService } from '@/lib/services/graphNodesService'
import logger from '@/lib/log_utils'
import { withValidation } from '@/lib/validation/middleware'
import { z } from 'zod'

// Helper to create coord hash (same as frontend)
function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`
}

// Empty schema for GET request
const EmptySchema = z.object({}).strict()

/**
 * GET - Récupérer les statistiques et les demandes de follow via lasso pour l'utilisateur
 */
export const GET = withValidation(
  EmptySchema,
  async (request: NextRequest, data: z.infer<typeof EmptySchema>, session) => {
    try {
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const userId = session.user.id

      // Get stats and requests in optimized calls (2 queries instead of 4)
      const [stats, { completed: completedRequests, failed: failedRequests, pending: pendingRequests }] = await Promise.all([
        pgLassoRepository.getFollowRequestStats(userId),
        pgLassoRepository.getFollowRequestsGrouped(userId, { completed: 100, failed: 50, pending: 50 })
      ])

      // Enrich completed requests with social handles AND coord_hash for graph highlighting
      let enrichedCompleted: any[] = []
      let connectedHashes: string[] = []
      if (completedRequests.length > 0) {
        const twitterIds = completedRequests.map(r => r.target_twitter_id)
        try {
          // Get enriched data with social handles (includes coordinates for hash)
          const enrichedNodes = await graphNodesService.getNodesByTwitterIds(twitterIds)
          const enrichedMap = new Map(enrichedNodes.map(n => [n.twitter_id, n]))
          
          // Build hashes from enriched nodes (avoids duplicate DB call)
          connectedHashes = enrichedNodes.map(n => coordHash(n.x, n.y))
          
          // Create a map of twitter_id -> hash for enrichment
          const hashMap = new Map(enrichedNodes.map(n => [n.twitter_id, coordHash(n.x, n.y)]))
          
          enrichedCompleted = completedRequests.map(req => {
            const enriched = enrichedMap.get(req.target_twitter_id)
            const hash = hashMap.get(req.target_twitter_id) || null
            return {
              ...req,
              bluesky_handle: enriched?.bluesky_handle || null,
              mastodon_handle: enriched?.mastodon_handle || null,
              tier: enriched?.tier || null,
              community: enriched?.community || null,
              coord_hash: hash,
            }
          })
          
        } catch (err) {
          logger.logWarning(
            'API',
            'GET /api/stats/lasso',
            'Failed to enrich completed requests',
            userId,
            { error: err instanceof Error ? err.message : String(err) }
          )
          enrichedCompleted = completedRequests
        }
      }

      console.log("lassos stats ->", {
        total: stats.total,
        completed: stats.completed,
        failed: stats.failed,
        pending: stats.pending,
        connectedHashes: connectedHashes.length,
      });
      

      return NextResponse.json({
        success: true,
        stats,
        completed: enrichedCompleted,
        failed: failedRequests,
        pending: pendingRequests,
        connectedHashes, // Array of coord_hashes for connected nodes (for graph highlighting)
      })
    } catch (error) {
      const userId = session?.user?.id || 'unknown'
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logError('API', 'GET /api/stats/lasso', err, userId)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  },
  {
    requireAuth: true,
    applySecurityChecks: false,
    skipRateLimit: true,
  }
)
