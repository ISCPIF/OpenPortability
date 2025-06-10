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
  // Ajout de nouveaux patterns pour capturer plus de cas XSS
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
 * Couche 1: Validation stricte des données d'entrée
 */
export function validateSupportForm(data: SupportFormData): SecurityValidationResult {
  const errors: string[] = [];
  let securityLevel: 'safe' | 'suspicious' | 'dangerous' = 'safe';

  // Validation email plus stricte
  if (!validator.isEmail(data.email)) {
    errors.push('Invalid email format');
    securityLevel = 'dangerous';
  }
  
  // Vérifier que l'email ne contient pas de caractères XSS
  if (/<|>|javascript|script/i.test(data.email)) {
    errors.push('Email contains invalid characters');
    securityLevel = 'dangerous';
  }

  // Validation longueur
  if (data.subject.length > 200) {
    errors.push('Subject too long (max 200 characters)');
  }

  if (data.message.length > 2000) {
    errors.push('Message too long (max 2000 characters)');
  }

  // Détection de patterns dangereux
  const allContent = `${data.subject} ${data.message}`;
  
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
