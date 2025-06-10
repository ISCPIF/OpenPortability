import validator from 'validator';
import escapeHtml from 'escape-html';
import sanitizeHtml from 'sanitize-html';
// import logger from '@/lib/log_utils';

// Configuration de sanitisation HTML stricte
const SANITIZE_CONFIG = {
  allowedTags: ['br', 'p', 'strong', 'em'],
  allowedAttributes: {},
  allowedSchemes: [],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: [],
  allowProtocolRelative: false,
  enforceHtmlBoundary: true
};

// Patterns dangereux à détecter
const DANGEROUS_PATTERNS = [
  /\<script\b[^\<]*(?:(?!\<\/script\>)\<[^\<]*)*\<\/script\>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /\<iframe\b/gi,
  /\<object\b/gi,
  /\<embed\b/gi,
  /\<link\b/gi,
  /\<meta\b/gi,
  /\<style\b/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
  /\<svg\b[^>]*\bon\w+\s*=/gi,  // SVG avec event handlers
  /\<svg\b/gi,  // Toute balise SVG
  /\<audio\b/gi,  // Balises audio
  /\<video\b/gi,  // Balises video
  /\<form\b[^>]*\bformaction\s*=/gi,  // Form avec formaction
  /\\u003c/gi,  // Unicode escape pour <
  /\\x3c/gi,  // Hex escape pour <
  /&#x/gi,  // HTML entity hex
  /&#\d+/g,  // HTML entity decimal
  /\<button\b[^>]*\bformaction\s*=/gi,  // Button avec formaction
  /setTimeout\s*\(/gi,  // setTimeout
  /setInterval\s*\(/gi,  // setInterval
  /eval\s*\(/gi,  // eval
  /atob\s*\(/gi,  // atob (base64 decode)
  /btoa\s*\(/gi,  // btoa (base64 encode)
  /Function\s*\(/gi,  // Function constructor
  /\<div\b[^>]*\bon\w+\s*=/gi,  // div avec event handlers
  // Ajout des protocoles legacy détectés dans les tests
  /livescript:/gi,  // Protocole legacy LiveScript
  /mocha:/gi,      // Protocole legacy Mocha
  // Ajout des patterns de template injection
  /\$\{.*?\}/gi,      // Template string injection pattern ${...}
  /\#\{.*?\}/gi,       // Ruby/Pug style template injection #{...}
  /\{\{.*?\}\}/gi,      // Handlebars/Angular style template injection {{...}}
  /<%.*?%>/gi,      // EJS/ASP style template injection <% ... %>
];

export interface SecurityValidationResult {
  isValid: boolean;
  sanitizedContent?: string;
  errors: string[];
  securityLevel: 'safe' | 'suspicious' | 'dangerous';
}

export interface SupportFormData {
  subject: string;
  message: string;
  email: string;
}

/**
 * Decode URL encoded strings safely
 */
export function safeUrlDecode(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch (e) {
    // Si le décodage échoue, retourner l'entrée originale
    return input;
  }
}

/**
 * Couche 1: Validation stricte des données d'entrée
 */
export function validateSupportForm(data: SupportFormData): SecurityValidationResult {
  const errors: string[] = [];
  let securityLevel: 'safe' | 'suspicious' | 'dangerous' = 'safe';

  // Décoder les entrées potentiellement encodées en URL
  const decodedSubject = safeUrlDecode(data.subject);
  const decodedMessage = safeUrlDecode(data.message);
  const decodedEmail = safeUrlDecode(data.email);
  
  // Créer une copie décodée pour la validation
  const decodedData = {
    subject: decodedSubject,
    message: decodedMessage,
    email: decodedEmail
  };

  // Validation email plus stricte
  if (!validator.isEmail(decodedData.email)) {
    errors.push('Invalid email format');
    securityLevel = 'dangerous';
  }
  
  // Vérifier que l'email ne contient pas de caractères XSS
  if (/<|>|javascript|script/i.test(decodedData.email)) {
    errors.push('Email contains invalid characters');
    securityLevel = 'dangerous';
  }

  // Validation longueur
  if (decodedData.subject.length > 200) {
    errors.push('Subject too long (max 200 characters)');
  }

  if (decodedData.message.length > 2000) {
    errors.push('Message too long (max 2000 characters)');
  }

  // Détection de patterns dangereux
  const allContent = `${decodedData.subject} ${decodedData.message}`;
  
  // Vérification stricte : si le contenu contient TOUT caractère < ou >, c'est suspect
  if (/<|>/g.test(allContent)) {
    securityLevel = 'dangerous';
    errors.push('HTML tags are not allowed');
  }
  
  // Vérification des patterns dangereux
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(allContent)) {
      errors.push('Potentially dangerous content detected');
      securityLevel = 'dangerous';
      break;
    }
  }

  // Détection de caractères Unicode suspects (tentatives de bypass)
  if (/\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}/g.test(allContent)) {
    errors.push('Unicode escape sequences detected');
    securityLevel = 'dangerous';
  }

  // Détection d'entités HTML numériques
  if (/&#[0-9]+;|&#x[0-9a-fA-F]+;/g.test(allContent)) {
    errors.push('HTML entities detected');
    securityLevel = 'dangerous';
  }

  // Détection de l'encodage URL qui pourrait être utilisé pour bypasser
  if (/%[0-9a-fA-F]{2}/g.test(allContent)) {
    // Comparer le contenu original et décodé pour détecter une tentative de bypass
    if (allContent !== `${data.subject} ${data.message}`) {
      errors.push('URL encoding bypass attempt detected');
      securityLevel = 'dangerous';
    }
  }

  // Détection spécifique des patterns de template injection
  if (allContent.includes('${') || 
      allContent.includes('#{') || 
      allContent.includes('{{') && allContent.includes('}}') ||
      allContent.includes('<%') && allContent.includes('%>')) {
    errors.push('Template injection pattern detected');
    securityLevel = 'dangerous';
  }

  return {
    isValid: errors.length === 0 && securityLevel !== 'dangerous',
    errors,
    securityLevel
  };
}

/**
 * Couche 2: Échappement HTML systématique
 */
export function escapeHtmlContent(content: string): string {
  return escapeHtml(content);
}

/**
 * Couche 3: Sanitisation HTML avec whitelist stricte
 */
export function sanitizeHtmlContent(content: string): string {
  try {
    return sanitizeHtml(content, SANITIZE_CONFIG);
  } catch (error) {
    console.log('Security', 'HTML Sanitization', error, 'system', {
      context: 'Failed to sanitize HTML content'
    });
    // Fallback: échappement complet
    return escapeHtml(content);
  }
}

/**
 * Couche 4: Conversion sécurisée des retours à la ligne
 */
export function secureNewlineToHtml(content: string): string {
  // D'abord échapper tout le HTML
  const escaped = escapeHtml(content);
  // Puis convertir les \n en <br> de manière sécurisée
  return escaped.replace(/\n/g, '<br>');
}

/**
 * Pipeline de sécurisation complet pour le contenu support
 */
export function secureSupportContent(data: SupportFormData, userId?: string): {
  isSecure: boolean;
  htmlContent?: string;
  textContent: string;
  securityReport: SecurityValidationResult;
} {
  // Couche 1: Validation
  const validation = validateSupportForm(data);
  
  // Log des tentatives suspectes/dangereuses
  if (validation.securityLevel !== 'safe') {
    console.log('Security', 'Suspicious Support Form', new Error('Security validation failed'), userId || 'anonymous', {
      context: 'Support form security validation',
      securityLevel: validation.securityLevel,
      errors: validation.errors,
      formData: {
        subjectLength: data.subject.length,
        messageLength: data.message.length,
        email: data.email
      }
    });
  }

  // Si dangereux, rejeter complètement
  if (validation.securityLevel === 'dangerous') {
    return {
      isSecure: false,
      textContent: data.message,
      securityReport: validation
    };
  }

  // Couche 2 & 3: Échappement + Sanitisation
  let sanitizedMessage = '';
  try {
    const secureSubject = escapeHtml(data.subject);
    const secureMessage = secureNewlineToHtml(data.message);
    sanitizedMessage = sanitizeHtmlContent(secureMessage);
  } catch (error) {
    console.error('Security', 'Content sanitization error', error, userId || 'anonymous', {
      context: 'Failed to sanitize content'
    });
    // En cas d'erreur, on retourne du texte brut uniquement
    return {
      isSecure: true,
      textContent: data.message,
      securityReport: {
        ...validation,
        errors: [...validation.errors, 'HTML sanitization failed'],
        securityLevel: 'suspicious'
      }
    };
  }

  // Couche 4: Fallback text-only si la sanitisation échoue
  const textContent = data.message;
  
  // Vérification finale
  const finalValidation = {
    ...validation,
    sanitizedContent: sanitizedMessage
  };

  return {
    isSecure: true,
    htmlContent: sanitizedMessage,
    textContent,
    securityReport: finalValidation
  };
}

/**
 * Validation côté client (plus permissive pour l'UX)
 */
export function validateSupportFormClient(data: SupportFormData): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!data.email || !validator.isEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!data.subject || data.subject.trim().length < 3) {
    errors.subject = 'Subject must be at least 3 characters';
  }

  if (data.subject.length > 200) {
    errors.subject = 'Subject must be less than 200 characters';
  }

  if (!data.message || data.message.trim().length < 10) {
    errors.message = 'Message must be at least 10 characters';
  }

  if (data.message.length > 2000) {
    errors.message = 'Message must be less than 2000 characters';
  }

  // Détection basique de contenu suspect (UX friendly)
  if (/<script|javascript:|on\w+=/i.test(data.message + data.subject)) {
    errors.message = 'Message contains potentially unsafe content';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Protection contre les injections SQL
 * Échappe les caractères dangereux pour les requêtes SQL
 */
export function escapeSqlString(input: string): string {
  // Remplace les caractères dangereux pour SQL
  return input
    .replace(/\\/g, '\\\\')  // Backslash
    .replace(/'/g, "''")     // Single quote
    .replace(/"/g, '""')     // Double quote
    .replace(/\x00/g, '')    // NULL byte
    .replace(/\x1a/g, '')    // SUB character
    .replace(/\n/g, '\\n')   // Newline
    .replace(/\r/g, '\\r')   // Carriage return
    .replace(/\t/g, '\\t');  // Tab
}

/**
 * Validation plus intelligente pour prévenir les injections SQL
 * Détecte les patterns SQL dangereux avec moins de faux positifs
 */
export function detectSqlInjectionPatterns(input: string): boolean {
  // Contexte de l'analyse - nous stockons des données qui pourraient indiquer une attaque
  let suspiciousScore = 0;
  let hasMultipleKeywords = false;
  let hasSuspiciousStructure = false;
  
  // Détection de mots-clés SQL dans un contexte suspect
  const sqlKeywords = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 
    'TRUNCATE', 'UNION', 'HAVING', 'WHERE', 'FROM', 'GROUP BY', 'ORDER BY'
  ];
  
  // Compter les mots-clés SQL différents
  const detectedKeywords = sqlKeywords.filter(keyword => 
    new RegExp(`\\b${keyword}\\b`, 'i').test(input)
  );
  
  if (detectedKeywords.length >= 2) {
    // Si nous avons plusieurs mots-clés SQL différents, c'est suspect
    hasMultipleKeywords = true;
    suspiciousScore += detectedKeywords.length;
  }
  
  // Détecter les structures suspectes qui combinent des caractères et mots-clés SQL
  const suspiciousPatterns = [
    // Commentaires SQL dans un contexte suspect
    /\s--.*?(?:'|"|=|\(|\))/i,  // Commentaire suivi d'un caractère spécial
    /\/\*.*?(?:'|"|=|\(|\))/i,  // Commentaire multi-ligne suivi d'un caractère spécial
    
    // Combinaisons dangereuses d'opérateurs et de commentaires
    /(\bOR|\bAND)\s+.{0,10}?\s*=\s*.{0,10}?(?:--|\/\*|#|;)/i, // OR/AND avec égalité numérique
    /['"]?\s*(?:--|\/\*|#).+$/i, // String terminée par un commentaire SQL
    
    // Détection de l'égalité avec OR/AND (divers formats)
    /\b(OR|AND)\b\s+(['"]?).*?=.*?\2/i,  // OR/AND avec n'importe quelle égalité
    /\b(OR|AND)\b\s+(['"]?)\w+\2\s*=\s*(['"]?)\w+\3/i,  // OR/AND avec égalité entre valeurs avec guillemets optionnels
    
    // Structure typique d'injection
    /['"];.*?(?:--|\/\*|#|;)/i,  // String terminée puis commentaire/nouveau statement
    
    // Séquences d'échappement suspectes
    /''\s*(?:--|\/\*|#|;)/i,  // Double apostrophe suivie d'un commentaire/séparateur
    
    // Fonctions SQL dangereuses dans un contexte suspect
    /\b(?:SLEEP|BENCHMARK|WAITFOR|DELAY|PG_SLEEP)\s*\(\s*[0-9]+/i,
    
    // Attaques par concaténation
    /\|\|.*?(?:'|"|=|\(|\))/i,  // Concaténation || suivie de caractères spéciaux
    /CONCAT\s*\(.+?(?:'|"|=|\(|\))/i,  // CONCAT suivi de caractères spéciaux
    
    // Injections basées sur UNION dans un contexte suspect
    /\bUNION\s+(?:ALL\s+)?SELECT\b/i,  // UNION [ALL] SELECT
    
    // Structures de requêtes à part entière
    /\bSELECT\b.+?\bFROM\b/i,  // SELECT ... FROM
    /\bINSERT\s+INTO\b/i,      // INSERT INTO
    /\bUPDATE\b.+?\bSET\b/i,   // UPDATE ... SET
    /\bDELETE\s+FROM\b/i,      // DELETE FROM
    
    // Stacked queries avec point-virgule
    /;(?:\s*).+?(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)/i,
    
    // Pattern spécifique pour OR "1"="1" et variantes (guillemets doubles et simples)
    /\b(OR|AND)\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,  // OR '1'='1', OR "1"="1", etc.
  ];
  
  // Vérifier la présence de patterns suspects
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      hasSuspiciousStructure = true;
      suspiciousScore += 3;
      break;
    }
  }
  
  // Analyse contextuelle - vérifier la juxtaposition de caractères suspects
  // Par exemple "1=1" est inoffensif dans un texte normal, mais suspect dans "OR 1=1--"
  const contextPatterns = [
    // Caractères de terminaison SQL suivis de mots-clés SQL
    /;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)/i,
    
    // Égalité avec contexte SQL suspect
    /(?:\bOR|\bAND)\s+.{0,10}?\s*=\s*.{0,10}?(?:--|\/\*|#|;)/i,
    
    // Guillemets avec caractères suspects à proximité
    /['"][^'"]*?(?:--|\/\*|#|;)[^'"]*?['"]?/i
  ];
  
  for (const pattern of contextPatterns) {
    if (pattern.test(input)) {
      suspiciousScore += 2;
    }
  }
  
  // Vérifier la présence d'égalités dans un contexte suspect (pour éviter les faux positifs sur "1=1")
  const hasEquality = /=/.test(input);
  const hasOrAnd = /\b(OR|AND)\b/i.test(input);
  
  if (hasEquality && hasOrAnd && /['"];/.test(input)) {
    suspiciousScore += 2;
  }
  
  // Logique finale de décision
  return suspiciousScore >= 3 || (hasMultipleKeywords && hasSuspiciousStructure);
}

/**
 * Interface pour les résultats de validation anti-tampering
 */
export interface TamperingValidationResult {
  isValid: boolean;
  tamperedFields: string[];
  integrityScore: number;
}

/**
 * Protection contre le tampering avec signature HMAC
 */
export function generateDataSignature(data: any, secret: string): string {
  const crypto = require('crypto');
  const dataString = JSON.stringify(data, Object.keys(data).sort());
  return crypto
    .createHmac('sha256', secret)
    .update(dataString)
    .digest('hex');
}

/**
 * Vérifie l'intégrité des données avec la signature
 */
export function verifyDataIntegrity(
  data: any, 
  signature: string, 
  secret: string
): boolean {
  const expectedSignature = generateDataSignature(data, secret);
  const crypto = require('crypto');
  
  // Comparaison sécurisée contre les timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Validation des types de données pour prévenir le tampering
 */
export function validateDataTypes(data: SupportFormData): TamperingValidationResult {
  const tamperedFields: string[] = [];
  let integrityScore = 100;

  // Vérifier que les champs sont bien des strings
  if (typeof data.subject !== 'string') {
    tamperedFields.push('subject');
    integrityScore -= 30;
  }

  if (typeof data.message !== 'string') {
    tamperedFields.push('message');
    integrityScore -= 30;
  }

  if (typeof data.email !== 'string') {
    tamperedFields.push('email');
    integrityScore -= 40;
  }

  // Vérifier la présence de caractères null bytes (tentative de tampering)
  const allFields = [data.subject, data.message, data.email];
  if (allFields.some(field => field && field.includes('\x00'))) {
    tamperedFields.push('null_byte_detected');
    integrityScore = 0;
  }

  // Vérifier les tentatives de pollution de prototype
  // Vérifier seulement les propriétés propres, pas celles héritées du prototype
  if (Object.hasOwnProperty.call(data, '__proto__') || 
      Object.hasOwnProperty.call(data, 'constructor') || 
      Object.hasOwnProperty.call(data, 'prototype')) {
    tamperedFields.push('prototype_pollution_attempt');
    integrityScore = 0;
  }

  return {
    isValid: tamperedFields.length === 0,
    tamperedFields,
    integrityScore
  };
}

/**
 * Limite de taux pour prévenir les attaques par force brute
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string, 
  maxRequests: number = 5, 
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(identifier);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return true;
  }

  if (userLimit.count >= maxRequests) {
    return false;
  }

  userLimit.count++;
  return true;
}

/**
 * Extension du SecurityValidationResult pour inclure les nouvelles vérifications
 */
export interface ExtendedSecurityValidationResult extends SecurityValidationResult {
  sqlInjectionDetected?: boolean;
  tamperingDetected?: boolean;
  rateLimitExceeded?: boolean;
}

/**
 * Fonction de sécurisation étendue qui combine toutes les protections
 */
export function secureSupportContentExtended(
  data: SupportFormData,
  userId?: string
): {
  isSecure: boolean;
  textContent: string;
  htmlContent?: string;
  securityReport: ExtendedSecurityValidationResult;
} {
  // Utiliser la fonction existante pour les protections XSS
  const baseResult = secureSupportContent(data, userId);
  
  // Ajouter les nouvelles vérifications
  const identifier = userId || data.email;
//   const rateLimitOk = checkRateLimit(identifier);
  const tamperingCheck = validateDataTypes(data);
  const allContent = `${data.subject} ${data.message} ${data.email}`;
  const sqlInjectionDetected = detectSqlInjectionPatterns(allContent);
  
  // Créer le rapport de sécurité étendu
  const extendedReport: ExtendedSecurityValidationResult = {
    ...baseResult.securityReport,
    sqlInjectionDetected,
    tamperingDetected: !tamperingCheck.isValid,
    rateLimitExceeded: false
  };
  
  // Déterminer si le contenu est sécurisé avec toutes les vérifications
  const isFullySecure = baseResult.isSecure && 
                        !sqlInjectionDetected && 
                        tamperingCheck.isValid;
  
  return {
    isSecure: isFullySecure,
    textContent: baseResult.textContent,
    htmlContent: isFullySecure ? baseResult.htmlContent : undefined,
    securityReport: extendedReport
  };
}
