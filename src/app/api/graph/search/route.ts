/**
 * API endpoint pour rechercher un utilisateur dans le graphe par son display_label
 * Retourne les coordonnées (hash) et la description
 */

import { NextRequest, NextResponse } from 'next/server'
import { pgGraphNodesRepository } from '@/lib/repositories/public/pg-graph-nodes-repository'
import logger from '@/lib/log_utils'

// Helper to create a hash from coordinates (same as frontend)
function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const multiple = searchParams.get('multiple') === 'true'
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Query must be at least 2 characters' },
        { status: 400 }
      )
    }

    const searchQuery = query.trim()

    if (multiple) {
      // Return multiple results for autocomplete
      const results = await pgGraphNodesRepository.searchByDisplayLabelMultiple(searchQuery, limit)
      
      return NextResponse.json({
        success: true,
        results: results.map(r => ({
          twitter_id: r.twitter_id,
          display_label: r.display_label,
          description: r.description,
          hash: coordHash(r.x, r.y),
          x: r.x,
          y: r.y,
          community: r.community,
        })),
      })
    } else {
      // Return single best match
      const result = await pgGraphNodesRepository.searchByDisplayLabel(searchQuery)

      if (!result) {
        return NextResponse.json({
          success: false,
          error: 'User not found',
        }, { status: 404 })
      }

      logger.logInfo(
        'API',
        'GET /api/graph/search',
        `Found user: ${result.display_label}`,
        'system'
      )

      return NextResponse.json({
        success: true,
        result: {
          twitter_id: result.twitter_id,
          display_label: result.display_label,
          description: result.description,
          hash: coordHash(result.x, result.y),
          x: result.x,
          y: result.y,
          community: result.community,
        },
      })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.logError(
      'API',
      'GET /api/graph/search',
      errorMessage,
      'system'
    )

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
