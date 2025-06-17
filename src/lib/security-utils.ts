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
  const decodedMessage = safeUrlDecode(data.message);
  const decodedEmail = safeUrlDecode(data.email);
  
  // Créer une copie décodée pour la validation
  const decodedData = {
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
  if (decodedData.message.length > 2000) {
    errors.push('Message too long (max 2000 characters)');
  }

  // Détection de patterns dangereux
  const allContent = `${decodedData.message}`;
  
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
    if (allContent !== `${data.message}`) {
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
 * Échappe les caractères HTML pour prévenir les attaques XSS
 * Fonction d'utilitaire autonome sans dépendance externe
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Vérifie si le contenu contient des patterns dangereux (XSS)
 * @param content Le contenu à vérifier
 * @returns true si des patterns dangereux sont détectés
 */
export function detectDangerousContent(content: string): boolean {
  if (typeof content !== 'string') return true;
  
  // Décoder pour éviter les contournements par encodage
  const decodedContent = safeUrlDecode(content);
  
  // Vérifier chaque pattern dangereux
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(decodedContent)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Couche 2: Échappement HTML systématique
 */
export function escapeHtmlContent(content: string): string {
  if (typeof content !== 'string') return '';
  // Utiliser la fonction escapeHtml définie ci-dessus
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
    return escapeHtmlContent(content);
  }
}

/**
 * Couche 4: Conversion sécurisée des retours à la ligne
 */
export function secureNewlineToHtml(content: string): string {
  // D'abord échapper tout le HTML
  const escaped = escapeHtmlContent(content);
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

  if (!data.message || data.message.trim().length < 10) {
    errors.message = 'Message must be at least 10 characters';
  }

  if (data.message.length > 2000) {
    errors.message = 'Message must be less than 2000 characters';
  }

  // Détection basique de contenu suspect (UX friendly)
  if (/<script|javascript:|on\w+=/i.test(data.message)) {
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
    /['"]?\s*(?:--|\/\*|#).+$/i
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
  if (typeof data.message !== 'string') {
    tamperedFields.push('message');
    integrityScore -= 30;
  }

  if (typeof data.email !== 'string') {
    tamperedFields.push('email');
    integrityScore -= 40;
  }

  // Vérifier la présence de caractères null bytes (tentative de tampering)
  const allFields = [data.message, data.email];
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
  const allContent = `${data.message} ${data.email}`;
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

// Liste des types de consentement autorisés
export const VALID_CONSENT_TYPES = ['hqx_newsletter', 'oep_accepted', 'research_accepted', 'automatic_reconnect'];

// Fonction de validation du type de consentement
export function isValidConsentType(type: string): boolean {
  return VALID_CONSENT_TYPES.includes(type);
}

/**
 * Valider l'email pour prévenir les injections
 */
export function validateEmail(email: any): { isValid: boolean; error?: string } {
  // Vérifier le type
  if (typeof email !== 'string') {
    return { isValid: false, error: 'Email must be a string' };
  }
  
  // Décoder toute URL-encoding pour éviter les contournements
  const decodedEmail = safeUrlDecode(email);
  
  // Valider le format d'email
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(decodedEmail)) {
    return { isValid: false, error: 'Invalid email format' };
  }
  
  // Vérifier les tentatives d'injection SQL
  if (detectSqlInjectionPatterns(decodedEmail)) {
    console.log('Security', 'SQL Injection attempt', 'Blocked SQL injection in email field', 'anonymous', {
      context: 'Newsletter subscription',
      email: email.substring(0, 10) + '...' // Ne pas logger l'email complet
    });
    return { isValid: false, error: 'Invalid email content' };
  }
  
  // Vérifier les caractères suspects
  if (/<[^>]*>|javascript:|on\w+=/i.test(decodedEmail)) {
    console.log('Security', 'XSS attempt', 'Blocked XSS attempt in email field', 'anonymous');
    return { isValid: false, error: 'Invalid email content' };
  }
  
  return { isValid: true };
}

/**
 * Interface pour les données de fichier à analyser
 */
export interface FileContentData {
  content: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  fileObject?: File;
}

/**
 * Interface pour le rapport de sécurité des fichiers
 */
export interface FileSecurityValidationResult extends ExtendedSecurityValidationResult {
  dangerousJsPatterns?: boolean;
  suspiciousPatterns: string[];
  invalidFileType?: boolean;
  fileTooLarge?: boolean;
}

/**
 * Vérifie si le contenu du fichier contient des patterns JavaScript dangereux
 * @param content Le contenu à vérifier
 * @returns true si des patterns dangereux sont détectés, avec la liste des patterns
 */
export function detectDangerousJsPatterns(content: string): { detected: boolean; patterns: string[] } {
  if (typeof content !== 'string') return { detected: true, patterns: ['invalid_content_type'] };
  
  // Décoder pour éviter les contournements par encodage
  const decodedContent = safeUrlDecode(content);
  const detectedPatterns: string[] = [];
  
  // Réutiliser les patterns dangereux existants qui sont pertinents pour JavaScript
  const jsRelevantPatterns = [
    { pattern: /javascript:/gi, name: 'javascript_protocol' },
    { pattern: /data:text\/html/gi, name: 'data_html_uri' },
    { pattern: /vbscript:/gi, name: 'vbscript_protocol' },
    { pattern: /expression\s*\(/gi, name: 'css_expression' },
    { pattern: /setTimeout\s*\(/gi, name: 'settimeout' },
    { pattern: /setInterval\s*\(/gi, name: 'setinterval' },
    { pattern: /eval\s*\(/gi, name: 'eval_function' },
    { pattern: /atob\s*\(/gi, name: 'base64_decode' },
    { pattern: /btoa\s*\(/gi, name: 'base64_encode' },
    { pattern: /Function\s*\(/gi, name: 'function_constructor' },
    { pattern: /\$\{.*?\}/gi, name: 'template_injection' },
    { pattern: /\{\{.*?\}\}/gi, name: 'handlebars_injection' },
    { pattern: /<%.*?%>/gi, name: 'ejs_injection' }
  ];
  
  // Vérifier les patterns existants pertinents pour JS
  for (const { pattern, name } of jsRelevantPatterns) {
    if (pattern.test(decodedContent)) {
      detectedPatterns.push(name);
    }
  }
  
  // Patterns spécifiques aux fichiers JavaScript qui ne sont pas dans DANGEROUS_PATTERNS
  const jsSpecificPatterns = [
    // Accès au système de fichiers ou réseau
    { pattern: /require\s*\(\s*['"`]fs['"`]\s*\)/i, name: 'fs_module' },
    { pattern: /require\s*\(\s*['"`]http['"`]\s*\)/i, name: 'http_module' },
    { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/i, name: 'child_process_module' },
    { pattern: /process\.env/i, name: 'process_env_access' },
    // Accès au DOM qui pourrait être malveillant
    { pattern: /document\.cookie/i, name: 'document_cookie' },
    { pattern: /localStorage\./i, name: 'localstorage_access' },
    { pattern: /sessionStorage\./i, name: 'sessionstorage_access' },
    // Requêtes réseau potentiellement malveillantes
    { pattern: /fetch\s*\(/i, name: 'fetch_api' },
    { pattern: /XMLHttpRequest/i, name: 'xmlhttprequest' },
    { pattern: /\.ajax\s*\(/i, name: 'jquery_ajax' },
    // Exfiltration de données
    { pattern: /navigator\.sendBeacon/i, name: 'sendbeacon_api' },
    // Patterns de scripts obfusqués
    { pattern: /\\x[0-9a-f]{2}/i, name: 'hex_escape' },
    { pattern: /\\u[0-9a-f]{4}/i, name: 'unicode_escape' },
    // Patterns d'exploitation de prototype
    { pattern: /__proto__/i, name: 'proto_access' },
    { pattern: /constructor\.prototype/i, name: 'constructor_prototype' },
    { pattern: /Object\.prototype/i, name: 'object_prototype' }
  ];
  
  // Vérifier chaque pattern spécifique aux fichiers JS
  for (const { pattern, name } of jsSpecificPatterns) {
    if (pattern.test(decodedContent)) {
      detectedPatterns.push(name);
    }
  }
  
  return { 
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns
  };
}

/**
 * Fonction de sécurisation étendue pour les fichiers téléchargés
 * Similaire à secureSupportContentExtended mais adaptée pour les fichiers
 */
export function secureFileContentExtended(
  fileData: FileContentData,
  userId?: string
): {
  isSecure: boolean;
  securityReport: FileSecurityValidationResult;
} {
  // Initialiser le rapport de sécurité
  const securityReport: FileSecurityValidationResult = {
    isValid: true,
    errors: [],
    securityLevel: 'safe',
    sqlInjectionDetected: false,
    tamperingDetected: false,
    rateLimitExceeded: false,
    dangerousJsPatterns: false,
    suspiciousPatterns: [],
    invalidFileType: false,
    fileTooLarge: false
  };
  
  // 1. Vérification de l'objet File (si fourni)
  if (fileData.fileObject && !(fileData.fileObject instanceof File)) {
    securityReport.isValid = false;
    securityReport.errors.push('Invalid file object');
    securityReport.securityLevel = 'dangerous';
    return { isSecure: false, securityReport };
  }
  
  // 2. Vérification de la taille du fichier (max 100MB)
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  if (fileData.fileSize && fileData.fileSize > MAX_FILE_SIZE) {
    securityReport.isValid = false;
    securityReport.errors.push(`File too large: ${fileData.fileSize} bytes (max 100MB)`);
    securityReport.fileTooLarge = true;
    securityReport.securityLevel = 'suspicious';
    return { isSecure: false, securityReport };
  }
  
  // 3. Vérification du type MIME
  const validMimeTypes = ['application/javascript', 'text/javascript', 'application/json'];
  if (fileData.fileType && !validMimeTypes.includes(fileData.fileType)) {
    securityReport.isValid = false;
    securityReport.errors.push(`Invalid file type: ${fileData.fileType}`);
    securityReport.invalidFileType = true;
    securityReport.securityLevel = 'suspicious';
    return { isSecure: false, securityReport };
  }
  
  // 4. Vérifier le type de données du contenu
  if (typeof fileData.content !== 'string') {
    securityReport.isValid = false;
    securityReport.errors.push('Invalid file content type');
    securityReport.securityLevel = 'dangerous';
    return { isSecure: false, securityReport };
  }
  
  // Décoder le contenu pour éviter les contournements par encodage
  const decodedContent = safeUrlDecode(fileData.content);
  
  // 5. Vérifier les patterns dangereux (XSS)
  if (detectDangerousContent(decodedContent)) {
    securityReport.isValid = false;
    securityReport.errors.push('Dangerous content detected');
    securityReport.securityLevel = 'dangerous';
  }
  
  // 6. Vérifier les injections SQL
  if (detectSqlInjectionPatterns(decodedContent)) {
    securityReport.sqlInjectionDetected = true;
    securityReport.isValid = false;
    securityReport.errors.push('SQL injection pattern detected');
    securityReport.securityLevel = 'dangerous';
  }
  
  // 7. Vérifier les patterns JavaScript dangereux
  const jsPatterns = detectDangerousJsPatterns(decodedContent);
  if (jsPatterns.detected) {
    securityReport.dangerousJsPatterns = true;
    securityReport.suspiciousPatterns = jsPatterns.patterns;
    securityReport.isValid = false;
    securityReport.errors.push('Dangerous JavaScript patterns detected');
    securityReport.securityLevel = 'dangerous';
  }
  
  // 8. Vérifier les tentatives de tampering (null bytes, etc.)
  if (decodedContent.includes('\x00')) {
    securityReport.tamperingDetected = true;
    securityReport.isValid = false;
    securityReport.errors.push('Null byte detected');
    securityReport.securityLevel = 'dangerous';
  }
  
  // Journaliser les tentatives suspectes
  if (securityReport.securityLevel !== 'safe') {
    console.log('Security', 'Suspicious file content', userId || 'anonymous', {
      context: 'File security validation',
      fileName: fileData.fileName,
      fileType: fileData.fileType,
      securityLevel: securityReport.securityLevel,
      suspiciousPatterns: securityReport.suspiciousPatterns.slice(0, 5), // Limiter pour éviter un log trop volumineux
      errors: securityReport.errors
    });
  }
  
  // Déterminer si le fichier est sécurisé
  const isSecure = securityReport.isValid && 
                  !securityReport.sqlInjectionDetected && 
                  !securityReport.dangerousJsPatterns &&
                  !securityReport.tamperingDetected &&
                  !securityReport.invalidFileType &&
                  !securityReport.fileTooLarge;
  
  return {
    isSecure,
    securityReport
  };
}
