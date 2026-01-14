import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import crypto from 'crypto';
import logger from '../log_utils';

export interface InternalSecurityOptions {
  disableInDev?: boolean;        // true par défaut - désactive en développement
  maxTimestampAge?: number;      // 300s par défaut - âge max du timestamp
  requireSignature?: boolean;    // true par défaut - exige la signature HMAC
  logSecurityEvents?: boolean;   // true par défaut - log les événements de sécurité
  allowEmptyBody?: boolean;      // false par défaut - permet les requêtes sans body (GET)
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
    disableInDev = true,  // Temporairement remettre à true
    maxTimestampAge = 300, // 5 minutes
    requireSignature = true,
    logSecurityEvents = true,
    allowEmptyBody = false
  } = options;

  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const endpoint = request.nextUrl.pathname;
    const method = request.method;

    try {
      // Désactiver en développement si configuré
      if (disableInDev && process.env.NODE_ENV === 'development') {
        // Parser et valider le payload même en dev
        let body: any;
        let rawBody: string = '';
        
        try {
          rawBody = await request.text();


          if (rawBody.length === 0 && !allowEmptyBody) {
            return NextResponse.json(
              { error: 'Empty payload - body required' },
              { status: 400 }
            );
          }

          // Parse JSON payload
          body = JSON.parse(rawBody);
        } catch (parseError) {
          const errorString = parseError instanceof Error ? parseError.message : String(parseError);
          logger.logError('Payload parsing failed in internal request',errorString, "system");
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

      console.log("webhook internal secret ->", INTERNAL_API_KEY, WEBHOOK_SECRET)

      if (!INTERNAL_API_KEY || !WEBHOOK_SECRET) {
        return NextResponse.json(
          { error: 'Missing keys for internal security' },
          { status: 401 }
        );
      }
      // 1. Vérifier l'API Key
      const apiKey = request.headers.get('X-API-Key');
      console.log('apiKey from db : ', apiKey)
      if (!apiKey) {
        return NextResponse.json(
          { error: 'Missing X-API-Key header' },
          { status: 401 }
        );
      }

      if (apiKey !== INTERNAL_API_KEY) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }

      // 2. Vérifier les headers de sécurité
      const signature = request.headers.get('X-Signature');
      const timestamp = request.headers.get('X-Timestamp');

      if (requireSignature && (!signature || !timestamp)) {
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
          return NextResponse.json(
            { error: 'Invalid or expired timestamp' },
            { status: 400 }
          );
        }
      }

      // 4. Lire et parser le payload
      let body: any;
      let rawBody: string = '';
      let postgresFormattedPayload: string;
      
      try {
        rawBody = await request.text();

        if (rawBody.length === 0 && !allowEmptyBody) {
          return NextResponse.json(
            { error: 'Empty payload - body required' },
            { status: 400 }
          );
        }

        // Parse JSON payload seulement si on a un body
        if (rawBody.length > 0) {
          body = JSON.parse(rawBody);

          // Utiliser EXACTEMENT le corps JSON tel qu'envoyé (incluant les espaces)
          // afin d'aligner avec la sérialisation PostgreSQL (jsonb::text / net.http_post)
          postgresFormattedPayload = rawBody;
        } else {
          // Body vide autorisé: aligner avec la fonction SQL qui a DEFAULT '{}'::jsonb
          body = {};
          postgresFormattedPayload = '{}';
        }
      } catch (parseError) {

        return NextResponse.json(
          { error: 'Invalid payload format', details: parseError instanceof Error ? parseError.message : 'Unknown error' },
          { status: 400 }
        );
      }

      const validatedData = schema.parse(body);

      // 5. Vérifier la signature HMAC
      if (requireSignature && signature && timestamp) {
        const providedSignature = signature.replace('sha256=', '');
        
        // Utiliser le même schéma que la fonction SQL secure_webhook_call:
        // signature = HMAC_SHA256(timestamp || '|' || payload::text)
        // Ici: timestamp d'abord, puis un séparateur '|', puis le payload formaté PostgreSQL
        const message = `${timestamp}|${postgresFormattedPayload}`;
        const expectedSignature = crypto
          .createHmac('sha256', WEBHOOK_SECRET)
          .update(message)
          .digest('hex');

        if (!crypto.timingSafeEqual(
          Buffer.from(expectedSignature, 'hex'),
          Buffer.from(providedSignature, 'hex')
        )) {

          return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
          );
        }

      }

      // 6. Appeler le handler avec les données validées
      return await handler(request, validatedData);

    } catch (error) {
      const validationTime = Date.now() - startTime;

      if (error instanceof ZodError) {
        const errorString = error instanceof Error ? error.message : String(error);
        logger.logError('API', endpoint, errorString, 'system', { 
          message: 'Invalid payload schema' 
        });
        
        return NextResponse.json(
          { 
            error: 'Invalid payload schema',
            details: errorString 
          },
          { status: 400 }
        );
      }

      if (error instanceof SyntaxError) {
        const errorString = error instanceof Error ? error.message : String(error);
        logger.logError('API', endpoint, errorString, 'system', { 
          message: 'Invalid JSON payload' 
        });
        return NextResponse.json(
          { error: 'Invalid JSON payload' },
          { status: 400 }
        );
      }

      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('API', endpoint, errorString, 'system', { 
        message: 'Internal security validation failed' 
      });

      return NextResponse.json(
        { error: 'Internal security validation failed' },
        { status: 500 }
      );
    }
  };
}