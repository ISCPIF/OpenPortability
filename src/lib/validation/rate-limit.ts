import { NextResponse } from 'next/server';

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
    windowMs: 1 * 1000,  // 5 minutes
    maxRequests: 1000,          // 10 tentatives de connexion
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
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10000,           // 5 emails par minute
    identifier: 'userId',
    message: 'Too many support requests. Please wait before sending another message.'
  },
  '/api/newsletter/request': {
    windowMs: 60 * 1000,
    maxRequests: 10,          // Plus permissif pour les updates de consentements
    identifier: 'userId'
  },
  '/api/share': {
    windowMs: 60 * 1000,
    maxRequests: 10000,          // Permet plusieurs partages rapides
    identifier: 'userId'
  },
  '/api/migrate/send_follow': {
    windowMs: 60 * 1000,
    maxRequests: 100,         // Batch processing, limite élevée
    identifier: 'userId',
    message: 'Too many follow requests. Please wait before sending more.'
  },
  '/api/upload': {
    windowMs: 5 * 60 * 1000,  // 5 minutes
    maxRequests: 5,           // 5 uploads par 5 minutes
    identifier: 'userId',
    message: 'Too many uploads. Please wait before uploading more files.'
  },
  '/api/upload/large-files': {
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 1000,           // 3 gros uploads par 10 minutes
    identifier: 'userId',
    message: 'Too many large file uploads. Please wait before uploading more.'
  },
  
  // Configuration par défaut
  'default': {
    windowMs: 60 * 1000,
    maxRequests: 30,          // Limite généreuse par défaut
    identifier: 'userId'
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
}

/**
 * Vérifie le rate limit pour une requête
 */
export function checkRateLimit(
  endpoint: string,
  identifierValue: string,
  customConfig?: Partial<RateLimitConfig>
): RateLimitResult {
  const config = {
    ...(RATE_LIMIT_CONFIGS[endpoint] || RATE_LIMIT_CONFIGS.default),
    ...customConfig
  };
  
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
      resetTime: now + config.windowMs
    };
  }
  
  if (userLimit.count >= config.maxRequests) {
    // Limite atteinte
    return {
      allowed: false,
      remaining: 0,
      resetTime: userLimit.resetTime,
      retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
    };
  }
  
  // Incrémenter le compteur
  userLimit.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - userLimit.count,
    resetTime: userLimit.resetTime
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
  
  return NextResponse.json(
    {
      error: message,
      retryAfter: result.retryAfter
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(config?.maxRequests || 30),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetTime),
        'Retry-After': String(result.retryAfter || 60)
      }
    }
  );
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
