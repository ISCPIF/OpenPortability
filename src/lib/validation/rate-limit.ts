import { NextResponse } from 'next/server';

// Stratégie de rate limiting:
// - Endpoints publics: 10 req/5min par IP
// - Actions utilisateur standard: 10 req/5min par userId
// - Actions batch: 100 req/5min par userId
// - Endpoints sensibles (support): 3 req/5min par IP
// - Uploads: 5 req/5min par userId
// - Endpoints de lecture purs: pas de limite (skipRateLimit)

// Environment variable for debug mode (defaults to false)
const DEBUG_RATE_LIMIT: boolean = true;

// Configuration par endpoint
export interface RateLimitConfig {
  windowMs: number;      // Fenêtre de temps en millisecondes
  maxRequests: number;   // Nombre maximum de requêtes dans la fenêtre
  identifier: 'ip' | 'userId' | 'email' | 'custom'; // Type d'identifiant
  skipAuth?: boolean;    // Si true, applique le rate limit même sans auth
  message?: string;      // Message d'erreur personnalisé
}

// Configurations par défaut pour chaque endpoint
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Endpoints publics
  '/api/auth/bluesky': {
    windowMs: 5 * 60 * 1000,  // 5 minutes
    maxRequests: 10,          // 10 tentatives de connexion
    identifier: 'ip',
    skipAuth: true,
    message: 'Too many authentication attempts. Please try again later.'
  },
  '/api/auth/mastodon': {
    windowMs: 5 * 60 * 1000,
    maxRequests: 10,
    identifier: 'ip',
    skipAuth: true,
    message: 'Too many authentication attempts. Please try again later.'
  },
  
  // Endpoints authentifiés
  '/api/support': {
    windowMs:  5 * 60 * 1000,      // 1 minute
    maxRequests: 3,           // 5 emails par minute
    identifier: 'ip',
    message: 'Too many support requests. Please wait before sending another message.'
  },
  '/api/newsletter/request': {
    windowMs: 5 * 60 * 1000,
    maxRequests: 10,          // Plus permissif pour les updates de consentements
    identifier: 'userId'
  },
  '/api/share': {
    windowMs: 5 * 60 * 1000,
    maxRequests: 10,          // Permet plusieurs partages rapides
    identifier: 'userId'
  },
  '/api/migrate/send_follow': {
    windowMs: 5 * 60 * 1000,
    maxRequests: 100,         // Batch processing, limite élevée
    identifier: 'userId',
    message: 'Too many follow requests. Please wait before sending more.'
  },
  '/api/migrate/lasso_found': {
    windowMs: 5 * 60 * 1000,
    maxRequests: 50,          // Lasso selection queries
    identifier: 'ip',         // Public endpoint (no auth required)
    skipAuth: true,
    message: 'Too many lasso requests. Please wait before sending more.'
  },
  '/api/migrate/send_follow_lasso': {
    windowMs: 5 * 60 * 1000,
    maxRequests: 100,         // Batch follow processing
    identifier: 'userId',
    message: 'Too many lasso follow requests. Please wait before sending more.'
  },
  '/api/upload': {
    windowMs: 5 * 60 * 1000,  // 5 minutes
    maxRequests: 5,           // 5 uploads par 5 minutes
    identifier: 'userId',
    message: 'Too many uploads. Please wait before uploading more files.'
  },
  '/api/upload/large-files': {
    windowMs: 5 * 60 * 1000, // 10 minutes
    maxRequests: 5,           // 3 gros uploads par 10 minutes
    identifier: 'userId',
    message: 'Too many large file uploads. Please wait before uploading more.'
  },
  '/api/migrate/ignore': {
    windowMs: 5 * 60 * 1000,
    maxRequests: 100,
    identifier: 'userId',
    message: 'Too many ignore requests. Please wait before sending more.'
  },
  '/api/connections/graph/user-network': {
    windowMs: 5 * 60 * 1000,  // 5 minutes
    maxRequests: 20,          // 20 requêtes par 5 minutes
    identifier: 'userId',
    message: 'Too many network requests. Please wait before fetching your network again.'
  },
  '/api/graph/followers-hashes': {
    windowMs: 5 * 60 * 1000,
    maxRequests: 30,          // Graph data fetching
    identifier: 'userId',
    message: 'Too many requests. Please wait before fetching again.'
  },
  '/api/graph/followings-hashes': {
    windowMs: 5 * 60 * 1000,
    maxRequests: 30,          // Graph data fetching
    identifier: 'userId',
    message: 'Too many requests. Please wait before fetching again.'
  },
  '/api/graph/highlights': {
    windowMs: 1 * 60 * 1000,
    maxRequests: 60,          // Lightweight status updates after follow actions
    identifier: 'userId',
    message: 'Too many highlight requests. Please wait before updating again.'
  },
  '/api/graph/names_labels': {
    windowMs: 5 * 60 * 1000,
    maxRequests: 20,          // Public labels endpoint
    identifier: 'ip',
    skipAuth: true,
    message: 'Too many requests. Please wait before fetching again.'
  },
  '/api/stats/lasso': {
    windowMs: 5 * 60 * 1000,
    maxRequests: 30,          // Stats fetching
    identifier: 'userId',
    message: 'Too many stats requests. Please wait before fetching again.'
  },
  '/api/mosaic/sql': {
    windowMs: 24 * 60 * 60 * 1000,  // 24 heures
    maxRequests: 5,                  // 5 requêtes max (résultat stocké en IndexedDB)
    identifier: 'ip',
    skipAuth: true,
    message: 'Too many database queries. Graph data is cached locally - please clear your browser cache if you need to reload.'
  },
  
  // Configuration par défaut
  'default': {
    windowMs: 5 * 60 * 1000,
    maxRequests: 10,          // Limite généreuse par défaut
    identifier: 'userId'
  }
};

// Debug configuration with much higher limits
export const DEBUG_RATE_LIMIT_CONFIGS: Record<string, Partial<RateLimitConfig>> = {
  // Higher limits for all endpoints in debug mode
  'default': {
    windowMs: 1 * 60 * 1000,  // 1 minute
    maxRequests: 1000,        // Very high limit for testing
  },
  // You can override specific endpoints for debugging if needed
  '/api/support': {
    maxRequests: 100,         // Higher limit for testing support endpoints
  },
  '/api/upload': {
    maxRequests: 50,          // Higher limit for testing uploads
  },
  '/api/upload/large-files': {
    maxRequests: 20,          // Higher limit for testing large uploads
  }
};

// Storage en mémoire pour les compteurs
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Nettoyage périodique du store (toutes les 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  debugMode?: boolean; // Indicate if debug mode was applied
}

/**
 * Vérifie le rate limit pour une requête
 */
export function checkRateLimit(
  endpoint: string,
  identifierValue: string,
  customConfig?: Partial<RateLimitConfig>
): RateLimitResult {
  // Start with the default config for the endpoint
  let config = {
    ...(RATE_LIMIT_CONFIGS[endpoint] || RATE_LIMIT_CONFIGS.default),
    ...customConfig
  };
  
  // Apply debug configuration if debug mode is enabled
  if (DEBUG_RATE_LIMIT) {
    // Apply endpoint-specific debug config if it exists, otherwise use debug default
    const debugConfig = DEBUG_RATE_LIMIT_CONFIGS[endpoint] || DEBUG_RATE_LIMIT_CONFIGS.default;
    config = {
      ...config,
      ...debugConfig
    };
  }
  
  const key = `${endpoint}:${identifierValue}`;
  const now = Date.now();
  const userLimit = rateLimitStore.get(key);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Nouvelle fenêtre
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    });
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
      debugMode: DEBUG_RATE_LIMIT
    };
  }
  
  if (userLimit.count >= config.maxRequests) {
    // Limite atteinte
    return {
      allowed: false,
      remaining: 0,
      resetTime: userLimit.resetTime,
      retryAfter: Math.ceil((userLimit.resetTime - now) / 1000),
      debugMode: DEBUG_RATE_LIMIT
    };
  }
  
  // Incrémenter le compteur
  userLimit.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - userLimit.count,
    resetTime: userLimit.resetTime,
    debugMode: DEBUG_RATE_LIMIT
  };
}

/**
 * Réponse standardisée pour rate limit dépassé
 */
export function rateLimitResponse(
  result: RateLimitResult,
  config?: RateLimitConfig
): NextResponse {
  const message = config?.message || 'Too many requests. Please try again later.';
  
  const response = NextResponse.json(
    {
      error: message,
      retryAfter: result.retryAfter,
      debugMode: result.debugMode // Include debug mode status in response
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(config?.maxRequests || 30),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetTime),
        'Retry-After': String(result.retryAfter || 60),
        'X-Debug-Mode': result.debugMode ? 'true' : 'false'
      }
    }
  );
  
  return response;
}

/**
 * Réinitialise le compteur de rate limit pour un endpoint et un identifiant spécifiques
 * Utile pour les cas où une opération échoue pour des raisons techniques (timeout, etc.)
 * et où l'on souhaite permettre à l'utilisateur de réessayer immédiatement
 */
export function resetRateLimit(
  endpoint: string,
  identifierValue: string
): void {
  const key = `${endpoint}:${identifierValue}`;
  
  // Supprimer l'entrée du store pour réinitialiser le compteur
  if (rateLimitStore.has(key)) {
    rateLimitStore.delete(key);
  }
}

/**
 * Permet de savoir si le mode debug est activé pour les rate limits
 */
export function isRateLimitDebugMode(): boolean {
  return DEBUG_RATE_LIMIT;
}
