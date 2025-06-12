import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { auth } from '@/app/auth'; // Ajout de l'import manquant
import logger from '@/lib/log_utils';
import { 
  secureSupportContentExtended, 
  detectSqlInjectionPatterns,
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

export interface ValidationOptions {
  requireAuth?: boolean;
  applySecurityChecks?: boolean;
  customRateLimit?: Partial<RateLimitConfig>;
  skipRateLimit?: boolean;
  expectedContentType?: string;
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
  userId?: string
): Promise<{ isSecure: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  console.log('Validation', 'Security checks started', userId || 'anonymous', {
    endpoint,
    dataKeys: Object.keys(data)
  });
  
  // Vérification SQL injection et XSS sur tous les champs string
  const checkSecurityPatterns = (obj: any, path = ''): void => {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof value === 'string') {
        // Check SQL injection
        if (detectSqlInjectionPatterns(value)) {
          errors.push(`SQL injection detected in field: ${currentPath}`);
          console.log('Security', 'SQL injection detected', `Field: ${currentPath}`, userId || 'anonymous', {
            value: value.substring(0, 100) // Log only first 100 chars
          });
        }
        
        // Check XSS using existing function from security-utils
        if (detectDangerousContent(value)) {
          errors.push(`XSS detected in field: ${currentPath}`);
          console.log('Security', 'XSS detected', `Field: ${currentPath}`, userId || 'anonymous', {
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
  if (endpoint === '/api/support' && data.subject && data.message && data.email) {
    const supportData: SupportFormData = {
      subject: String(data.subject),
      message: String(data.message),
      email: String(data.email)
    };
    
    console.log('Validation', 'Running extended support security checks', userId || 'anonymous');
    const securityResult = secureSupportContentExtended(supportData, userId);
    if (!securityResult.isSecure) {
      errors.push(...(securityResult.securityReport.errors || []));
    }
  }
  
  // TODO: Ajouter des vérifications de sécurité spécifiques pour chaque endpoint
  
  console.log('Validation', 'Security checks completed', userId || 'anonymous', {
    endpoint,
    errorsCount: errors.length,
    isSecure: errors.length === 0
  });
  
  return {
    isSecure: errors.length === 0,
    errors
  };
}

/**
 * Wrapper de validation principal
 */
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (request: NextRequest, validatedData: T, session?: any) => Promise<NextResponse>,
  options: ValidationOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const {
      requireAuth = true,
      applySecurityChecks = true,
      customRateLimit,
      skipRateLimit = false,
      expectedContentType
    } = options;
    
    const endpoint = new URL(request.url).pathname;
    const method = request.method;
    
    console.log('Validation', `${method} ${endpoint}`, 'Validation middleware started', 'system', {
      requireAuth,
      applySecurityChecks,
      skipRateLimit
    });
    
    try {
      // 1. Authentification
      let session = null;
      
      if (requireAuth) {
        console.log('Validation', `${method} ${endpoint}`, 'Checking authentication', 'anonymous');
        session = await auth();
        
        if (!session?.user?.id) {
          console.log('Validation', `${method} ${endpoint}`, 'Authentication required but not provided', 'anonymous');
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }
        
        console.log('Validation', `${method} ${endpoint}`, 'Authentication successful', session.user.id);
      }
      
      // 2. Rate limiting
      if (!skipRateLimit) {
        const rateLimitConfig = customRateLimit 
          ? { ...(RATE_LIMIT_CONFIGS[endpoint] || RATE_LIMIT_CONFIGS.default), ...customRateLimit }
          : (RATE_LIMIT_CONFIGS[endpoint] || RATE_LIMIT_CONFIGS.default);
        
        console.log('Validation', `${method} ${endpoint}`, 'Checking rate limit', session?.user?.id || 'anonymous', {
          config: rateLimitConfig
        });
        
        const identifier = await getRateLimitIdentifier(request, rateLimitConfig, session);
        const rateLimitResult = checkRateLimit(endpoint, identifier, customRateLimit);
        
        if (!rateLimitResult.allowed) {
          console.log('Security', `${method} ${endpoint}`, 'Rate limit exceeded', session?.user?.id || 'anonymous', {
            identifier,
            retryAfter: rateLimitResult.retryAfter
          });
          return rateLimitResponse(rateLimitResult, rateLimitConfig);
        }
        
        console.log('Validation', `${method} ${endpoint}`, 'Rate limit check passed', session?.user?.id || 'anonymous', {
          remaining: rateLimitResult.remaining
        });
      }
      
      // 3. Parsing et validation Zod
      let data: T;
      try {
        // Ne parser le body que pour les méthodes qui en ont un
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          console.log('Validation', `${method} ${endpoint}`, 'Checking content type', session?.user?.id || 'anonymous');
          
          // Vérifier si c'est une requête multipart/form-data
          const contentType = request.headers.get('content-type') || '';
          const isFormData = contentType.startsWith('multipart/form-data');
          
          console.log('Validation', `${method} ${endpoint}`, 'Checking content type', session?.user?.id || 'anonymous', {
            contentType,
            isFormData,
            expectedContentType: expectedContentType || 'any'
          });
          
          // Vérifier si le Content-Type correspond à celui attendu
          if (expectedContentType) {
            const isValidContentType = 
              expectedContentType === 'multipart/form-data' ? isFormData : 
              contentType.includes(expectedContentType);
            
            if (!isValidContentType) {
              console.log('Validation', `${method} ${endpoint}`, 'Invalid content type', session?.user?.id || 'anonymous', {
                expected: expectedContentType,
                received: contentType
              });
              return NextResponse.json(
                { error: `Invalid content type. Expected: ${expectedContentType}` },
                { status: 400 }
              );
            }
          }
          
          if (isFormData) {
            console.log('Validation', `${method} ${endpoint}`, 'FormData detected, skipping JSON parsing', session?.user?.id || 'anonymous');
            // Pour les requêtes FormData, on utilise un objet vide pour la validation Zod
            // La validation des fichiers sera faite dans le handler
            data = schema.parse({});
          } else if (contentType.includes('application/json')) {
            // Pour les requêtes JSON standard
            console.log('Validation', `${method} ${endpoint}`, 'Parsing JSON request body', session?.user?.id || 'anonymous');
            try {
              const rawData = await request.json();
              
              console.log('Validation', `${method} ${endpoint}`, 'Validating with Zod schema', session?.user?.id || 'anonymous', {
                rawDataKeys: Object.keys(rawData)
              });
              
              data = schema.parse(rawData);
            } catch (jsonError) {
              console.log('Validation', `${method} ${endpoint}`, 'JSON parsing failed', session?.user?.id || 'anonymous', {
                error: jsonError.message
              });
              return NextResponse.json(
                {
                  error: 'Validation failed',
                  details: jsonError instanceof ZodError 
                    ? jsonError.errors.map(e => ({
                        path: e.path.join('.'),
                        message: e.message
                      }))
                    : [{ path: '', message: `Invalid JSON format: ${jsonError.message}` }]
                },
                { status: 400 }
              );
            }
          } else {
            // Cas où il n'y a ni JSON ni FormData valide
            console.log('Validation', `${method} ${endpoint}`, 'No valid JSON or FormData detected', session?.user?.id || 'anonymous', {
              contentType
            });
            // On utilise un objet vide pour la validation Zod
            // Le handler devra vérifier si les données nécessaires sont présentes
            data = schema.parse({});
          }
        } else {
          // Pour GET/DELETE, utiliser un objet vide ou les query params
          console.log('Validation', `${method} ${endpoint}`, 'No body to parse for GET/DELETE', session?.user?.id || 'anonymous');
          data = schema.parse({});
        }
        
        console.log('Validation', `${method} ${endpoint}`, 'Schema validation passed', session?.user?.id || 'anonymous');
      } catch (error) {
        if (error instanceof ZodError) {
          console.log('Validation', `${method} ${endpoint}`, 'Schema validation failed', session?.user?.id || 'anonymous', {
            errors: error.errors
          });
          
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: error.errors.map(e => ({
                path: e.path.join('.'),
                message: e.message
              }))
            },
            { status: 400 }
          );
        }
        throw error;
      }
      
      // 4. Vérifications de sécurité
      if (applySecurityChecks) {
        console.log('Validation', `${method} ${endpoint}`, 'Running security checks', session?.user?.id || 'anonymous');
        const securityCheck = await performSecurityValidation(data, endpoint, session?.user?.id);
        
        if (!securityCheck.isSecure) {
          console.log('Security', `${method} ${endpoint}`, 'Security validation failed', session?.user?.id || 'anonymous', {
            errors: securityCheck.errors,
            clientIP: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown'
          });
          
          return NextResponse.json(
            {
              error: 'Security validation failed',
              details: securityCheck.errors
            },
            { status: 400 }
          );
        }
        
        console.log('Validation', `${method} ${endpoint}`, 'Security checks passed', session?.user?.id || 'anonymous');
      }
      
      // 5. Appel du handler avec les données validées
      console.log('Validation', `${method} ${endpoint}`, 'Calling handler with validated data', session?.user?.id || 'anonymous');
      const response = await handler(request, data, session);
      
      console.log('Validation', `${method} ${endpoint}`, 'Handler completed successfully', session?.user?.id || 'anonymous');
      return response;
      
    } catch (error) {
      console.log('API', `${method} ${endpoint}`, error, 'unknown', {
        context: 'Validation middleware error'
      });
      
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
  console.log('Validation', 'withPublicValidation', 'Creating public validation wrapper', 'system');
  
  return withValidation(
    schema,
    async (req, data) => handler(req, data),
    { ...options, requireAuth: false }
  );
}
