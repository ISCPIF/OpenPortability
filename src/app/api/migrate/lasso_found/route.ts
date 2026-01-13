import { NextResponse } from 'next/server';
import { GraphNodesService } from '@/lib/services/graphNodesService';
import logger from '@/lib/log_utils';
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"

// Schéma pour les données d'entrée
const LassoNodesSchema = z.object({
  hashes: z.array(z.string()).min(1).max(1000), // Limite à 1000 hashes pour éviter les abus
}).strict()

async function lassoNodesHandler(_request: Request, data: z.infer<typeof LassoNodesSchema>, session: any) {
  try {
    // Cet endpoint peut être utilisé sans authentification pour les visiteurs
    // mais on log l'utilisateur si disponible
    const userId = session?.user?.id || 'anonymous';

    console.log(
      'API',
      'POST /api/migrate/lasso_found',
      `Processing ${data.hashes.length} hashes`,
      userId
    );

    const graphNodesService = new GraphNodesService();
    // Use the new method that filters for members with consent in users_with_name_consent
    const nodes = await graphNodesService.getMemberNodesByHashesWithConsent(data.hashes);

    console.log(
      'API',
      'POST /api/migrate/lasso_found',
      `Returning ${nodes.length} nodes`,
      userId
    );

    return NextResponse.json({
      success: true,
      nodes,
      stats: {
        requested: data.hashes.length,
        found: nodes.length,
        with_bluesky: nodes.filter(n => n.bluesky_handle).length,
        with_mastodon: nodes.filter(n => n.mastodon_handle).length,
      }
    });

  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    const err = error instanceof Error ? error : new Error(String(error))
    logger.logError('API', 'POST /api/migrate/lasso_found', err, userId, {
      context: 'Error in lasso-nodes route',
      hashesCount: data.hashes?.length || 0
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Configuration du middleware de validation
// requireAuth: false car les visiteurs anonymes peuvent utiliser le lasso
export const POST = withValidation(
  LassoNodesSchema,
  lassoNodesHandler,
  {
    requireAuth: false,
    applySecurityChecks: true,
    skipRateLimit: false
  }
)
