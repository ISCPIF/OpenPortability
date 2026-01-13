import { NextResponse } from 'next/server';
import { pgGraphNodesRepository } from '@/lib/repositories/public/pg-graph-nodes-repository';
import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';
import { withPublicValidation } from '@/lib/validation/middleware';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Redis cache key - no TTL, invalidated by trigger on users_with_name_consent
const CACHE_KEY = 'graph:labels:public';

// Helper to create coordinate hash (same format as used elsewhere)
function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`;
}

// Limit for floating labels (too many causes performance issues)
const MAX_FLOATING_LABELS = 5000;

// Empty schema for GET request
const EmptySchema = z.object({}).strict();

async function getPersonalLabelsHandler() {
  try {
    // Try to get from Redis cache first
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      logger.logDebug(
        'API',
        'GET /api/graph/names_labels',
        'Returning cached labels from Redis',
        'system'
      );
      return NextResponse.json(JSON.parse(cached));
    }

    // Get all personal labels with coordinates via repository
    const rows = await pgGraphNodesRepository.getPersonalLabelsWithCoords();

    if (rows.length === 0) {
      const emptyResponse = {
        success: true,
        labelMap: {},
        floatingLabels: [],
        count: 0
      };
      // Cache empty response too (no TTL - invalidated by trigger)
      await redis.set(CACHE_KEY, JSON.stringify(emptyResponse));
      return NextResponse.json(emptyResponse);
    }

    // Build a mapping object: coord_hash -> display_label (no twitter_id for RGPD)
    const labelMap: Record<string, string> = {};
    for (const row of rows) {
      const hash = coordHash(row.x, row.y);
      labelMap[hash] = row.display_label;
    }
    
    // Sort by degree for floating labels and take top N
    const sortedRows = [...rows].sort((a, b) => b.degree - a.degree).slice(0, MAX_FLOATING_LABELS);
    
    // Build floating labels array (with coord_hash instead of twitter_id)
    const floatingLabels = sortedRows.map(row => ({
      coord_hash: coordHash(row.x, row.y),
      x: row.x,
      y: row.y,
      text: row.display_label,
      priority: Math.min(row.degree, 100),
      level: 0,
    }));

    const response = {
      success: true,
      labelMap,
      floatingLabels,
      count: rows.length
    };

    // Cache in Redis (no TTL - invalidated by trigger)
    await redis.set(CACHE_KEY, JSON.stringify(response));

    logger.logDebug(
      'API',
      'GET /api/graph/names_labels',
      `Returning ${rows.length} personal labels mapping + ${floatingLabels.length} floating labels (cached)`,
      'system'
    );

    return NextResponse.json(response);

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.logError('API', 'GET /api/graph/names_labels', err, 'system', {
      context: 'Error fetching personal labels'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Configuration du middleware de validation (public endpoint)
export const GET = withPublicValidation(
  EmptySchema,
  getPersonalLabelsHandler,
  {
    applySecurityChecks: false,
    skipRateLimit: false
  }
);
