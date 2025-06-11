import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withLogging } from '@/lib/log_utils';
import { withPublicValidation } from '@/lib/validation/middleware';
import { z } from 'zod';

// Schema vide pour GET (pas de body)
const emptySchema = z.object({});

/**
 * GET handler - Récupérer la liste des instances Mastodon disponibles
 * Utilise le nouveau middleware de validation (public, pas d'auth requise)
 */
const mastodonHandler = withPublicValidation(
  emptySchema,
  async (request: NextRequest) => {
    console.log('[Mastodon Handler] Fetching instances from Supabase');
    
    try {
      const { data, error } = await supabase
        .from('mastodon_instances')
        .select('instance')
        .order('instance');

      if (error) {
        console.log('[Mastodon Handler] Database error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch instances' },
          { status: 500 }
        );
      }

      const instances = data?.map(row => row.instance) || [];
      console.log(`[Mastodon Handler] Found ${instances.length} instances`);

      return NextResponse.json(
        { instances },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=300' // Cache 5 minutes
          }
        }
      );
    } catch (error) {
      console.log('[Mastodon Handler] Unexpected error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  {
    applySecurityChecks: false, // Pas nécessaire pour un GET sans params
    skipRateLimit: true // Pour l'instant, pas de rate limit sur cet endpoint
  }
);

export const GET = withLogging(mastodonHandler);
