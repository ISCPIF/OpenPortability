import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/log_utils';
import { pgMastodonInstanceRepository } from '@/lib/repositories/auth/pg-mastodon-instance-repository';

/**
 * API to verify a Mastodon instance before initiating OAuth flow
 * This allows the client to show an error message instead of redirecting to a broken OAuth flow
 */
export async function POST(request: NextRequest) {
  try {
    const { instance } = await request.json();
    
    if (!instance || typeof instance !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'INVALID_INPUT', message: 'Instance name is required' },
        { status: 400 }
      );
    }
    
    const lcInstance = instance.toLowerCase().trim();
    
    logger.logInfo('Auth', 'verifyMastodonInstance', `Vérification de l'instance ${lcInstance}`, undefined, { instance: lcInstance });
    
    // Check if instance is already registered (known to work)
    const existing = await pgMastodonInstanceRepository.getInstance(lcInstance);
    if (existing) {
      logger.logInfo('Auth', 'verifyMastodonInstance', `Instance ${lcInstance} déjà enregistrée`, undefined, { instance: lcInstance });
      return NextResponse.json({ valid: true, cached: true });
    }
    
    // Try to reach the instance's API
    const url = `https://${lcInstance}/api/v1/instance`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000) // 10s timeout
      });
      
      if (!response.ok) {
        logger.logError('Auth', 'verifyMastodonInstance', 
          `Instance ${lcInstance} a retourné une erreur: ${response.status}`,
          undefined, 
          { instance: lcInstance, status: response.status }
        );
        
        if (response.status === 404) {
          return NextResponse.json({
            valid: false,
            error: 'INSTANCE_INVALID',
            message: `L'instance ${lcInstance} n'existe pas ou n'est pas un serveur Mastodon valide.`
          });
        }
        
        return NextResponse.json({
          valid: false,
          error: 'INSTANCE_ERROR',
          message: `L'instance ${lcInstance} a retourné une erreur (${response.status}).`
        });
      }
      
      // Instance is reachable and valid
      logger.logInfo('Auth', 'verifyMastodonInstance', `Instance ${lcInstance} est valide`, undefined, { instance: lcInstance });
      return NextResponse.json({ valid: true, cached: false });
      
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      logger.logError('Auth', 'verifyMastodonInstance', 
        `Instance ${lcInstance} injoignable: ${errorMessage}`,
        undefined, 
        { instance: lcInstance, error: errorMessage }
      );
      
      return NextResponse.json({
        valid: false,
        error: 'INSTANCE_UNREACHABLE',
        message: `L'instance ${lcInstance} est injoignable. Vérifiez l'URL.`
      });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.logError('Auth', 'verifyMastodonInstance', `Erreur inattendue: ${errorMessage}`, undefined, { error: errorMessage });
    
    return NextResponse.json(
      { valid: false, error: 'UNKNOWN_ERROR', message: 'Une erreur inattendue s\'est produite.' },
      { status: 500 }
    );
  }
}
