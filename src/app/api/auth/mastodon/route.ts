import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/log_utils';
import { withValidation } from '@/lib/validation/middleware';
import { z } from 'zod';

// Schema vide pour GET (pas de body)
const EmptySchema = z.object({});

/**
 * GET handler - Récupérer la liste des instances Mastodon disponibles
 * Utilise le nouveau middleware de validation standardisé
 */
export const GET = withValidation(
  EmptySchema,
  async (request: NextRequest, data: {}) => {
    console.log('API', 'GET /api/auth/mastodon', 'anonymous', {
      context: 'Fetching Mastodon instances'
    });
    
    try {
      const { data: instances, error } = await supabase
        .from('mastodon_instances')
        .select('instance')
        .order('instance');

      if (error) {
        console.log('API', 'GET /api/auth/mastodon', error, 'anonymous', {
          context: 'Database error while fetching instances'
        });
        
        return NextResponse.json(
          { error: 'Failed to fetch instances' },
          { status: 500 }
        );
      }

      const instancesList = instances?.map(row => row.instance) || [];
      
      console.log('API', 'GET /api/auth/mastodon', 'anonymous', {
        context: 'Successfully fetched Mastodon instances',
        count: instancesList.length
      });

      return NextResponse.json(
        { instances: instancesList },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=300' // Cache 5 minutes
          }
        }
      );
    } catch (error) {
      console.log('API', 'GET /api/auth/mastodon', error, 'anonymous', {
        context: 'Unexpected error in Mastodon instances handler'
      });
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: false,        // Endpoint public
    applySecurityChecks: false, // Pas nécessaire pour un GET sans params
    skipRateLimit: false       // Appliquer le rate limiting standard
  }
);
