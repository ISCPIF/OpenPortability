import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { auth } from '@/app/auth'; 
import logger from '@/lib/log_utils';
import { 
  secureSupportContentExtended, 
  validateDataTypes,
  safeUrlDecode,
  detectDangerousContent,
  type SupportFormData
} from '@/lib/security-utils';
import { 
  checkRateLimit, 
  rateLimitResponse, 
  RATE_LIMIT_CONFIGS,
  type RateLimitConfig 
} from './rate-limit';
import { detectXssPayload } from '@/lib/security/xss-detection';
import { detectSqlInjectionPayload } from '@/lib/security/sql-detection';

// Safe detector for Next.js redirect errors (e.g., NEXT_REDIRECT from NextAuth signIn)
function isNextRedirect(err: unknown): boolean {
  try {
    const digest = (err as any)?.digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
      return true;
    }
    return !!(err && typeof err === 'object' && 'digest' in (err as any) && (err as any).digest === 'NEXT_REDIRECT');
  } catch {
    return false;
  }
}

export interface ValidationOptions {
  requireAuth?: boolean;
  applySecurityChecks?: boolean;
  customRateLimit?: Partial<RateLimitConfig>;
  skipRateLimit?: boolean;
  expectedContentType?: string;
  validateQueryParams?: boolean; 
  queryParamsSchema?: z.ZodSchema<any>; 
  excludeFromSecurityChecks?: string[]; // Liste des champs à exclure des vérifications de sécurité (body)
  excludeQueryParamsFromSecurity?: string[]; // Liste des query params à exclure des vérifications de sécurité (URL)
}

/**
 * Extrait l'identifiant pour le rate limiting selon la configuration
 */
async function getRateLimitIdentifier(
  request: NextRequest,
  config: RateLimitConfig,
  session?: any
): Promise<string> {
  switch (config.identifier) {
    case 'ip':
      return request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown-ip';
    
    case 'userId':
      return session?.user?.id || 'anonymous';
    
    case 'email':
      try {
        const body = await request.clone().json();
        return body.email || 'no-email';
      } catch {
        return 'no-email';
      }
    
    default:
      return 'unknown';
  }
}

/**
 * Applique les vérifications de sécurité sur les données
 */
async function performSecurityValidation(
  data: any,
  endpoint: string,
  userId?: string,
  excludeFromSecurityChecks: string[] = []
): Promise<{ isSecure: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Vérification SQL injection et XSS sur tous les champs string
  const checkSecurityPatterns = (obj: any, path = ''): void => {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Vérifier si le champ actuel est dans la liste des exclusions
      if (excludeFromSecurityChecks.includes(currentPath) || 
          (path === '' && excludeFromSecurityChecks.includes(key))) {
        continue;
      }
      
      if (typeof value === 'string') {
        // Check SQL injection
        const sqlResult = detectSqlInjectionPayload(value);
        if (sqlResult.isVulnerable) {
          errors.push(`SQL injection detected in field: ${currentPath} (Risk: ${sqlResult.riskLevel})`);
          logger.logError('Security', 'SQL injection detected', `Field: ${currentPath}`, userId || 'anonymous', {
            patterns: sqlResult.detectedPatterns.slice(0, 3),
            riskLevel: sqlResult.riskLevel,
            value: value.substring(0, 100) // Log only first 100 chars
          });
        }
        
        // Check XSS using new function from xss-detection
        const xssResult = detectXssPayload(value);
        if (xssResult.isVulnerable) {
          errors.push(`XSS detected in field: ${currentPath} (Risk: ${xssResult.riskLevel})`);
          logger.logError('Security', 'XSS detected', `Field: ${currentPath}`, userId || 'anonymous', {
            patterns: xssResult.detectedPatterns.slice(0, 3),
            riskLevel: xssResult.riskLevel,
            value: value.substring(0, 100)
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        checkSecurityPatterns(value, currentPath);
      }
    }
  };
  
  checkSecurityPatterns(data);
  
  // Pour l'endpoint support, utiliser la fonction existante
  if (endpoint === '/api/support' && data.message && data.email) {
    const supportData: SupportFormData = {
      message: String(data.message),
      email: String(data.email)
    };
    
    const securityResult = secureSupportContentExtended(supportData, userId);
    if (!securityResult.isSecure) {
      errors.push(...(securityResult.securityReport.errors || []));
    }
  }
  
  // TODO: Ajouter des vérifications de sécurité spécifiques pour chaque endpoint
  
  
  return {
    isSecure: errors.length === 0,
    errors
  };
}

/**
 * Détecte les tentatives de pollution de prototype dans une chaîne JSON
 */
function detectPrototypePollution(jsonString: string): boolean {
  // Recherche des motifs suspects dans la chaîne JSON
  const dangerousPatterns = [
    /"__proto__"\s*:/i,
    /"constructor"\s*:/i,
    /"prototype"\s*:/i,
    /\[\s*"__proto__"\s*\]/i,
    /\[\s*"constructor"\s*\]/i,
    /\[\s*"prototype"\s*\]/i
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(jsonString));
}

/**
 * Valide les paramètres d'URL pour détecter les tentatives d'attaque
 */
function validateQueryParameters(
  url: URL,
  endpoint: string,
  userId?: string,
  excludeKeys: string[] = []
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const searchParams = url.searchParams;
  
  // Vérifier chaque paramètre d'URL
  for (const [key, value] of searchParams.entries()) {
    // Exclure certains paramètres (ex: OAuth state) des checks de sécurité pour éviter les faux positifs
    if (excludeKeys.includes(key)) {
      continue;
    }
    // Vérifier les tentatives de pollution de prototype dans les clés
    const protoRegex = /(__proto__|constructor|prototype)/i;
    if (protoRegex.test(key)) {
      errors.push(`Potential prototype pollution detected in query parameter key: ${key}`);
      logger.logError('Security', `Prototype pollution attempt in URL params for ${endpoint}`, userId || 'anonymous', 
        key, value
      );
      continue;
    }
    
    // Vérifier les tentatives de pollution de prototype dans les valeurs
    if (protoRegex.test(value)) {
      errors.push(`Potential prototype pollution detected in query parameter value: ${key}=${value}`);
      logger.logError('Security', `Prototype pollution attempt in URL params for ${endpoint}`, userId || 'anonymous', 
        key,
        value
      );
      continue;
    }
    
    // Vérifier les attaques JSONP
    if (key === 'callback' || key === 'jsonp') {
      errors.push(`JSONP callback parameter detected: ${key}`);
      logger.logError('Security', `JSONP callback attempt in URL params for ${endpoint}`, userId || 'anonymous', 
        key,
        value
      );
      continue;
    }
    
    // Vérifier les injections SQL avec point-virgule (;)
    if (value.includes(';')) {
      errors.push(`SQL injection detected in query parameter: ${key}`);
      logger.logError('Security', `SQL injection attempt in URL params for ${endpoint}`, userId || 'anonymous', 
        key,
        value
      );
      continue;
    }
    
    // Vérifier les injections SQL standards
    const sqlResult = detectSqlInjectionPayload(value);
    if (sqlResult.isVulnerable) {
      errors.push(`SQL injection detected in query parameter: ${key} (Risk: ${sqlResult.riskLevel})`);
      logger.logError('Security', `SQL injection attempt in URL params for ${endpoint}`, userId || 'anonymous', 
        key,
        value,
        sqlResult.detectedPatterns.slice(0, 3)[0],
        sqlResult.riskLevel
      );
      continue;
    }
    
    // Détection directe des balises script et autres patterns dangereux
    const dangerousPatterns = [
      /<script/i,
      /<\/script>/i,
      /javascript:/i,
      /on\w+=/i,
      /<iframe/i,
      /<svg/i,
      /alert\s*\(/i,
      /eval\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i
    ];
    
    // Vérifier chaque pattern dangereux directement
    let hasDangerousPattern = false;
    for (const pattern of dangerousPatterns) {
      if (pattern.test(value)) {
        errors.push(`XSS detected in query parameter: ${key}`);
        logger.logError('Security', `XSS attempt in URL params for ${endpoint}`, userId || 'anonymous', 
          key,
          value,
          pattern.toString()
        );
        hasDangerousPattern = true;
        break;
      }
    }
    
    if (hasDangerousPattern) {
      continue;
    }
    
    // Utiliser aussi la fonction existante detectDangerousContent comme filet de sécurité
    if (detectDangerousContent(value)) {
      errors.push(`XSS detected in query parameter: ${key}`);
      logger.logError('Security', `XSS attempt in URL params for ${endpoint}`, userId || 'anonymous', 
        key,
        value
      );
      continue;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Wrapper de validation principal
 */
export function withValidation<Out, In = Out>(
  schema: z.ZodType<Out, z.ZodTypeDef, In>,
  handler: (request: NextRequest, validatedData: Out, session?: any) => Promise<NextResponse>,
  options: ValidationOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const {
      requireAuth = true,
      applySecurityChecks = true,
      customRateLimit,
      skipRateLimit = false,
      expectedContentType,
      validateQueryParams = true, 
      queryParamsSchema = z.object({}).passthrough(), 
      excludeFromSecurityChecks = [],
      excludeQueryParamsFromSecurity = []
    } = options;
    
    const url = new URL(request.url);
    const endpoint = url.pathname;
    const method = request.method;
    
    
    try {
      // 1. Authentification
      let session = null;      
      if (requireAuth) {
        session = await auth();
        
        if (!session?.user?.id) {
          logger.logError('Validation', `${method} ${endpoint}`, 'Authentication required but not provided', 'anonymous');
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }
      }
      
      // 2. Validation des paramètres d'URL
      if (validateQueryParams) {        
        // Vérification de sécurité des paramètres d'URL
        const queryParamsValidation = validateQueryParameters(url, endpoint, session?.user?.id, excludeQueryParamsFromSecurity);
        
        if (!queryParamsValidation.isValid) {
          logger.logError('Security', `${method} ${endpoint}`, 'URL parameters validation failed', session?.user?.id || 'anonymous', 
            queryParamsValidation.errors,
            request.headers.get('x-forwarded-for') || 'unknown',
            request.headers.get('user-agent') || 'unknown'
          );
          
          return NextResponse.json(
            {
              error: 'URL parameters validation failed',
              details: queryParamsValidation.errors
            },
            { status: 400 }
          );
        }
        
        // Validation du schéma Zod pour les paramètres d'URL si fourni
        try {
          const queryParams = Object.fromEntries(url.searchParams);
          // logger.logInfo('Validation', `${method} ${endpoint}`, 'Validating URL parameters with schema', session?.user?.id || 'anonymous', {
          //   params: queryParams
          // });
          
          queryParamsSchema.parse(queryParams);
        } catch (error) {
          if (error instanceof ZodError) {
            const err = error instanceof Error ? error : new Error(String(error))
            logger.logError('Validation', `${method} ${endpoint}`, 'URL parameters schema validation failed', session?.user?.id || 'anonymous', 
              err
            );
            
            return NextResponse.json(
              {
                error: 'URL parameters validation failed',
                details: err
              },
              { status: 400 }
            );
          }
          throw error;
        }
        
      }
      
      // 3. Rate limiting
      if (!skipRateLimit) {
        const rateLimitConfig = customRateLimit 
          ? { ...(RATE_LIMIT_CONFIGS[endpoint] || RATE_LIMIT_CONFIGS.default), ...customRateLimit }
          : (RATE_LIMIT_CONFIGS[endpoint] || RATE_LIMIT_CONFIGS.default);
        
        
        const identifier = await getRateLimitIdentifier(request, rateLimitConfig, session);
        const rateLimitResult = checkRateLimit(endpoint, identifier, customRateLimit);
        
        if (!rateLimitResult.allowed) {
          logger.logError('Security', `${method} ${endpoint}`, 'Rate limit exceeded', session?.user?.id || 'anonymous', 
            identifier,
            rateLimitResult.retryAfter?.toString()
          );
          return rateLimitResponse(rateLimitResult, rateLimitConfig);
        }
      }
      
      // 4. Parsing et validation Zod
      let data: Out;
      try {
        // Ne parser le body que pour les méthodes qui en ont un
        if (['POST', 'PUT', 'PATCH'].includes(method)) {          
          // Vérifier si c'est une requête multipart/form-data
          const contentType = request.headers.get('content-type') || '';
          const isFormData = contentType.startsWith('multipart/form-data');

          
          // Vérifier si le Content-Type correspond à celui attendu
          if (expectedContentType) {
            const isValidContentType = 
              expectedContentType === 'multipart/form-data' ? isFormData : 
              contentType.includes(expectedContentType);
            
            if (!isValidContentType) {
              logger.logError('Validation', `${method} ${endpoint}`, 'Invalid content type', session?.user?.id || 'anonymous', 
                expectedContentType,
                contentType
              );
              return NextResponse.json(
                { error: `Invalid content type. Expected: ${expectedContentType}` },
                { status: 400 }
              );
            }
          }
          
          if (isFormData) {
            // Pour les requêtes FormData, on utilise un objet vide pour la validation Zod
            // La validation des fichiers sera faite dans le handler
            data = schema.parse({});
          } else if (contentType.includes('application/json')) {
            // Pour les requêtes JSON standard
            try {
              const bodyText = await request.text();
              
              // Vérifier les tentatives de pollution de prototype avant le parsing
              if (detectPrototypePollution(bodyText)) {
                
                return NextResponse.json(
                  {
                    error: 'Validation failed',
                    details: [{ path: '', message: 'Potential prototype pollution detected' }]
                  },
                  { status: 400 }
                );
              }
              
              try {
                data = JSON.parse(bodyText);
                data = schema.parse(data);
              } catch (jsonError) {
                const err = jsonError instanceof Error ? jsonError : new Error(String(jsonError))
                logger.logError('Validation', `${method} ${endpoint}`, 'JSON parsing failed', session?.user?.id || 'anonymous', 
                  err.message
                );
                return NextResponse.json(
                  {
                    error: 'Validation failed',
                    details: err
                  },
                  { status: 400 }
                );
              }
            } catch (jsonError) {
              const err = jsonError instanceof Error ? jsonError : new Error(String(jsonError))
              logger.logError('Validation', `${method} ${endpoint}`, 'JSON parsing failed', session?.user?.id || 'anonymous', 
                err.message
              );
              return NextResponse.json(
                {
                  error: 'Validation failed',
                  details: [{ path: '', message: `Invalid JSON format: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}` }]
                },
                { status: 400 }
              );
            }
          } else {
            // Cas où il n'y a ni JSON ni FormData valide
            // On utilise un objet vide pour la validation Zod
            // Le handler devra vérifier si les données nécessaires sont présentes
            data = schema.parse({});
          }
        } else {
          // Pour GET/DELETE, utiliser un objet vide ou les query params
          data = schema.parse({});
        }
      } catch (error) {
        if (error instanceof ZodError) {
          const err = error instanceof Error ? error : new Error(String(error))
          logger.logError('Validation', `${method} ${endpoint}`, 'Schema validation failed', session?.user?.id || 'anonymous', 
            err
          );
          
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: err
            },
            { status: 400 }
          );
        }
        throw error;
      }
      
      // 4. Vérifications de sécurité
      if (applySecurityChecks) {
        const securityCheck = await performSecurityValidation(data, endpoint, session?.user?.id, excludeFromSecurityChecks);
        
        if (!securityCheck.isSecure) {
          logger.logError('Security', `${method} ${endpoint}`, 'Security validation failed', session?.user?.id || 'anonymous', 
            securityCheck.errors,
            request.headers.get('x-forwarded-for') || 'unknown',
            request.headers.get('user-agent') || 'unknown'
          );
          
          return NextResponse.json(
            {
              error: 'Security validation failed',
              details: securityCheck.errors
            },
            { status: 400 }
          );
        }
        
      }
      
      // 5. Appel du handler avec les données validées
      const response = await handler(request, data, session);
      
      return response;
      
    } catch (error) {
      // Allow Next.js framework redirects (e.g., from NextAuth signIn) to bubble through
      if (isNextRedirect(error)) {
    
        throw error;
      }
       
       return NextResponse.json(
         { error: 'Internal server error' },
         { status: 500 }
       );
     }
   };
 }

/**
 * Version simplifiée pour les endpoints publics
 */
export function withPublicValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (request: NextRequest, validatedData: T) => Promise<NextResponse>,
  options: Omit<ValidationOptions, 'requireAuth'> = {}
) {
  
  return withValidation(
    schema,
    async (req, data) => handler(req, data),
    { ...options, requireAuth: false }
  );
}
