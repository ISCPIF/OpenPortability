import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { redis } from '@/lib/redis';
import { queryPublic } from '@/lib/database';
import logger from '@/lib/log_utils';
import { withInternalValidation } from '@/lib/validation/internal-middleware';

// Redis cache key for graph nodes version (used by frontend to detect changes)
const GRAPH_NODES_VERSION_KEY = 'graph:nodes:version';

// Graph nodes table name
const GRAPH_NODES_TABLE = 'graph_nodes_03_11_25';

// Schéma de validation pour les requêtes de sync
const SyncMemberNodeRequestSchema = z.object({
  action: z.enum(['sync']),
  twitter_id: z.string(),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  metadata: z.object({
    trigger_operation: z.string().optional(),
    timestamp: z.string().optional(),
    source: z.string().optional(),
  }).optional(),
});

type SyncMemberNodeRequest = z.infer<typeof SyncMemberNodeRequestSchema>;

async function handleSyncMemberNode(
  request: NextRequest, 
  validatedData: SyncMemberNodeRequest
): Promise<NextResponse> {
  try {
    const { action, twitter_id, operation, metadata } = validatedData;

    if (action === 'sync') {
      let nodeUpdated = false;
      let newNodeType: string | null = null;

      if (operation === 'INSERT' || operation === 'UPDATE') {
        // User added/updated consent -> mark as member
        const result = await queryPublic(
          `UPDATE ${GRAPH_NODES_TABLE} 
           SET node_type = 'member', updated_at = NOW()
           WHERE id = $1 AND (node_type IS NULL OR node_type != 'member')
           RETURNING id`,
          [twitter_id]
        );
        nodeUpdated = result.rows.length > 0;
        newNodeType = 'member';
        
        if (nodeUpdated) {
          logger.logInfo(
            'API',
            'POST /api/internal/sync-member-node',
            `Node ${twitter_id} marked as member (operation: ${operation})`
          );
        }
      } else if (operation === 'DELETE') {
        // User removed consent -> mark as generic
        const result = await queryPublic(
          `UPDATE ${GRAPH_NODES_TABLE} 
           SET node_type = 'generic', updated_at = NOW()
           WHERE id = $1 AND node_type = 'member'
           RETURNING id`,
          [twitter_id]
        );
        nodeUpdated = result.rows.length > 0;
        newNodeType = 'generic';
        
        if (nodeUpdated) {
          logger.logInfo(
            'API',
            'POST /api/internal/sync-member-node',
            `Node ${twitter_id} marked as generic (consent removed)`
          );
        }
      }

      // Increment version in Redis to signal frontend to invalidate IndexedDB cache
      if (nodeUpdated) {
        await redis.incr(GRAPH_NODES_VERSION_KEY);
        const newVersion = await redis.get(GRAPH_NODES_VERSION_KEY);
        
        logger.logDebug(
          'API',
          'POST /api/internal/sync-member-node',
          `Graph nodes version incremented to ${newVersion}`
        );
      }

      return NextResponse.json({
        success: true,
        message: nodeUpdated 
          ? `Node ${twitter_id} updated to ${newNodeType}` 
          : `Node ${twitter_id} not found or already correct type`,
        node_updated: nodeUpdated,
        new_node_type: newNodeType,
        twitter_id,
        operation,
        trigger: {
          source: metadata?.source,
          timestamp: metadata?.timestamp,
        }
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    const errorString = error instanceof Error ? error.message : String(error);
    logger.logError(
      'API',
      'POST /api/internal/sync-member-node',
      errorString,
      'system',
      { context: 'Error syncing member node' }
    );
    return NextResponse.json(
      { error: 'Internal server error', details: errorString },
      { status: 500 }
    );
  }
}

// Configuration du middleware de validation (internal endpoint)
export const POST = withInternalValidation(
  SyncMemberNodeRequestSchema,
  handleSyncMemberNode,
  {
    disableInDev: true,
    requireSignature: true,
    logSecurityEvents: true,
    allowEmptyBody: false
  }
);

// GET endpoint to check current graph nodes version (for frontend polling)
export async function GET() {
  try {
    const version = await redis.get(GRAPH_NODES_VERSION_KEY) || '0';
    return NextResponse.json({ 
      success: true, 
      version: parseInt(version, 10) 
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get version' },
      { status: 500 }
    );
  }
}
