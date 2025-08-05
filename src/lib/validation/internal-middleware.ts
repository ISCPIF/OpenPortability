import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import crypto from 'crypto';

export interface InternalSecurityOptions {
  disableInDev?: boolean;        // true par défaut - désactive en développement
  maxTimestampAge?: number;      // 300s par défaut - âge max du timestamp
  requireSignature?: boolean;    // true par défaut - exige la signature HMAC
  logSecurityEvents?: boolean;   // true par défaut - log les événements de sécurité
}

/**
 * Formate le JSON exactement comme PostgreSQL le fait dans secure_webhook_call
 * - Convertit en JSON compact (sans espaces)
 * - Supprime les espaces après : et ,
 */
function formatJsonLikePostgreSQL(obj: any): string {
  // Convertir en JSON compact
  let compactPayload = JSON.stringify(obj);
  
  // Supprimer les espaces après les deux-points et virgules pour correspondre à PostgreSQL
  compactPayload = compactPayload.replace(/: /g, ':');
  compactPayload = compactPayload.replace(/, /g, ',');
  
  return compactPayload;
}

/**
 * Middleware de sécurité pour les endpoints internes
 * Valide l'API key, la signature HMAC et le timestamp des requêtes PostgreSQL
 */
export function withInternalValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (request: NextRequest, validatedData: T) => Promise<NextResponse>,
  options: InternalSecurityOptions = {}
) {
  const {
    disableInDev = true,
    maxTimestampAge = 300, // 5 minutes
    requireSignature = true,
    logSecurityEvents = true
  } = options;

  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const endpoint = request.nextUrl.pathname;
    const method = request.method;

    try {
      // Désactiver en développement si configuré
      if (disableInDev && process.env.NODE_ENV === 'development') {
        if (logSecurityEvents) {
          console.log('Internal security disabled in development', {
            endpoint,
            method,
            environment: process.env.NODE_ENV
          });
        }
        
        // Parser et valider le payload même en dev
        let body: any;
        let rawBody: string;
        
        try {
          rawBody = await request.text();
          console.log('🔍 DEBUG - Raw body received:', {
            endpoint,
            bodyLength: rawBody.length,
            bodyPreview: rawBody.substring(0, 200),
            isEmpty: rawBody.length === 0,
            contentType: request.headers.get('content-type')
          });

          if (rawBody.length === 0) {
            console.log('Empty payload received in internal request', { endpoint });
            return NextResponse.json(
              { error: 'Empty payload - body required' },
              { status: 400 }
            );
          }

          // Parse JSON payload
          body = JSON.parse(rawBody);
          console.log('🔍 DEBUG - Parsed JSON:', body);
        } catch (parseError) {
          console.log('Payload parsing failed in internal request', {
            endpoint,
            rawBodyLength: rawBody?.length || 0,
            rawBodyPreview: rawBody?.substring(0, 100) || 'undefined',
            contentType: request.headers.get('content-type'),
            error: parseError instanceof Error ? parseError.message : 'Unknown error'
          });
          return NextResponse.json(
            { error: 'Invalid payload format', details: parseError instanceof Error ? parseError.message : 'Unknown error' },
            { status: 400 }
          );
        }

        const validatedData = schema.parse(body);
        return await handler(request, validatedData);
      }

      // Vérifier les variables d'environnement requises
      const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
      const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

      if (!INTERNAL_API_KEY || !WEBHOOK_SECRET) {
        console.log('Missing internal security environment variables', {
          endpoint,
          hasApiKey: !!INTERNAL_API_KEY,
          hasWebhookSecret: !!WEBHOOK_SECRET
        });
        return NextResponse.json(
          { error: 'Internal security configuration error' },
          { status: 500 }
        );
      }

      if (logSecurityEvents) {
        console.log('Starting internal security validation', {
          endpoint,
          method,
          requireSignature,
          maxTimestampAge
        });
      }

      // DEBUG: Log tous les headers reçus
      console.log('🔍 DEBUG - All request headers:', {
        endpoint,
        headers: Object.fromEntries(request.headers.entries())
      });

      // 1. Vérifier l'API Key
      const apiKey = request.headers.get('X-API-Key');
      console.log('🔍 DEBUG - API Key check:', {
        hasApiKey: !!apiKey,
        apiKeyValue: apiKey ? apiKey.substring(0, 8) + '...' : 'null',
        expectedKey: INTERNAL_API_KEY ? INTERNAL_API_KEY.substring(0, 8) + '...' : 'null'
      });

      if (!apiKey) {
        console.log('Missing API key in internal request', { endpoint });
        return NextResponse.json(
          { error: 'Missing X-API-Key header' },
          { status: 401 }
        );
      }

      if (apiKey !== INTERNAL_API_KEY) {
        console.log('Invalid API key in internal request', {
          endpoint,
          providedKey: apiKey.substring(0, 8) + '...' // Log partiel pour sécurité
        });
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }

      // 2. Vérifier les headers de sécurité
      const signature = request.headers.get('X-Signature');
      const timestamp = request.headers.get('X-Timestamp');

      if (requireSignature && (!signature || !timestamp)) {
        console.log('Missing security headers in internal request', {
          endpoint,
          hasSignature: !!signature,
          hasTimestamp: !!timestamp
        });
        return NextResponse.json(
          { error: 'Missing security headers (X-Signature, X-Timestamp)' },
          { status: 400 }
        );
      }

      // 3. Vérifier l'âge du timestamp
      if (timestamp) {
        const requestTime = parseInt(timestamp);
        const currentTime = Math.floor(Date.now() / 1000);
        const age = currentTime - requestTime;

        if (isNaN(requestTime) || age > maxTimestampAge) {
          console.log('Invalid or expired timestamp in internal request', {
            endpoint,
            timestamp: requestTime,
            currentTime,
            age,
            maxAge: maxTimestampAge
          });
          return NextResponse.json(
            { error: 'Invalid or expired timestamp' },
            { status: 400 }
          );
        }
      }

      // 4. Lire et parser le payload
      let body: any;
      let rawBody: string;
      let postgresFormattedPayload: string;
      
      try {
        rawBody = await request.text();
        console.log('🔍 DEBUG - Raw body received:', {
          endpoint,
          bodyLength: rawBody.length,
          bodyPreview: rawBody.substring(0, 200),
          isEmpty: rawBody.length === 0,
          contentType: request.headers.get('content-type')
        });

        if (rawBody.length === 0) {
          console.log('Empty payload received in internal request', { endpoint });
          return NextResponse.json(
            { error: 'Empty payload - body required' },
            { status: 400 }
          );
        }

        // Parse JSON payload
        body = JSON.parse(rawBody);
        console.log('🔍 DEBUG - Parsed JSON:', body);

        // Formater exactement comme PostgreSQL le fait
        postgresFormattedPayload = formatJsonLikePostgreSQL(body);
        console.log('🔍 DEBUG - PostgreSQL formatted payload:', postgresFormattedPayload);
      } catch (parseError) {
        console.log('Payload parsing failed in internal request', {
          endpoint,
          rawBodyLength: rawBody?.length || 0,
          rawBodyPreview: rawBody?.substring(0, 100) || 'undefined',
          contentType: request.headers.get('content-type'),
          error: parseError instanceof Error ? parseError.message : 'Unknown error'
        });
        return NextResponse.json(
          { error: 'Invalid payload format', details: parseError instanceof Error ? parseError.message : 'Unknown error' },
          { status: 400 }
        );
      }

      const validatedData = schema.parse(body);

      // 5. Vérifier la signature HMAC
      if (requireSignature && signature && timestamp) {
        const providedSignature = signature.replace('sha256=', '');
        
        // Utiliser le payload formaté comme PostgreSQL pour le calcul HMAC
        const message = postgresFormattedPayload + timestamp;
        const expectedSignature = crypto
          .createHmac('sha256', WEBHOOK_SECRET)
          .update(message)
          .digest('hex');

        console.log('🔍 DEBUG - HMAC validation:', {
          endpoint,
          postgresPayload: postgresFormattedPayload.substring(0, 100) + '...',
          message: message.substring(0, 100) + '...',
          timestamp,
          expectedSig: expectedSignature.substring(0, 20) + '...',
          providedSig: providedSignature.substring(0, 20) + '...'
        });

        if (!crypto.timingSafeEqual(
          Buffer.from(expectedSignature, 'hex'),
          Buffer.from(providedSignature, 'hex')
        )) {
          console.log('Invalid HMAC signature in internal request', {
            endpoint,
            expectedLength: expectedSignature.length,
            providedLength: providedSignature.length,
            payloadSize: postgresFormattedPayload.length,
            rawPayloadPreview: rawBody.substring(0, 50),
            postgresPayloadPreview: postgresFormattedPayload.substring(0, 50)
          });
          return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
          );
        }

        console.log('✅ HMAC signature validated successfully');
      }

      if (logSecurityEvents) {
        const validationTime = Date.now() - startTime;
        console.log('Internal security validation successful', {
          endpoint,
          method,
          validationTime: `${validationTime}ms`,
          payloadSize: postgresFormattedPayload.length
        });
      }

      // 6. Appeler le handler avec les données validées
      return await handler(request, validatedData);

    } catch (error) {
      const validationTime = Date.now() - startTime;

      if (error instanceof ZodError) {
        console.log('Invalid payload schema in internal request', {
          endpoint,
          method,
          validationTime: `${validationTime}ms`,
          errors: error.errors
        });
        return NextResponse.json(
          { 
            error: 'Invalid payload schema',
            details: error.errors 
          },
          { status: 400 }
        );
      }

      if (error instanceof SyntaxError) {
        console.log('Invalid JSON payload in internal request', {
          endpoint,
          method,
          validationTime: `${validationTime}ms`,
          error: error.message
        });
        return NextResponse.json(
          { error: 'Invalid JSON payload' },
          { status: 400 }
        );
      }

      console.log('Internal security validation failed', {
        endpoint,
        method,
        validationTime: `${validationTime}ms`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return NextResponse.json(
        { error: 'Internal security validation failed' },
        { status: 500 }
      );
    }
  };
}