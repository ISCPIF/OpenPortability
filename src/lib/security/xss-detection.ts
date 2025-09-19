import fs from 'fs';
import path from 'path';
import logger from '../log_utils';

// Fonction pour charger les exemples XSS depuis le fichier
function loadXssExamples(): string[] {
  try {
    const xssExamplesPath = path.join(process.cwd(), 'security', 'xss_example.txt');
    const content = fs.readFileSync(xssExamplesPath, 'utf8');
    return content.split('\n')
      .filter((line: string) => line.trim() && !line.startsWith('//') && !line.startsWith('#'))
      .map((line: string) => line.trim());
  } catch (error) {
    const errorString = error instanceof Error ? error.message : String(error);
    logger.logError('Security', 'Could not load XSS examples file', errorString, 'system', {
      error: errorString
    });
    return [];
  }
}

// Charger les exemples et les convertir en patterns regex sécurisés
function createPatternsFromExamples(examples: string[]): RegExp[] {
  const patterns: RegExp[] = [];
  
  for (const example of examples) {
    try {
      // Échapper les caractères spéciaux regex mais conserver les patterns importants
      const escaped = example
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Échapper les caractères spéciaux regex
        .replace(/\\"/g, '["\']')               // Remplacer les guillemets par une classe de caractères
        .replace(/\\</g, '<')                   // Conserver les balises HTML
        .replace(/\\>/g, '>')                   // Conserver les balises HTML
        .replace(/\\\//g, '\\/');               // Conserver les slashes

      // Créer un pattern qui recherche l'exemple de manière flexible
      patterns.push(new RegExp(escaped, 'gi'));
    } catch (error) {
      // Ignorer les patterns qui ne peuvent pas être convertis en regex valides
      continue;
    }
  }
  
  return patterns;
}

// Charger les exemples XSS
const xssExamples = loadXssExamples();


/**
 * Résultat de la détection XSS avec informations détaillées
 */
export interface XssDetectionResult {
  isVulnerable: boolean;
  detectedPatterns: string[];
  riskLevel: 'low' | 'medium' | 'high';
  context?: string;
}

const XSS_PATTERNS = {
    // Patterns générés à partir du fichier d'exemples
    EXAMPLE_PATTERNS: createPatternsFromExamples(xssExamples),
    
    // Conserver quelques patterns critiques qui pourraient ne pas être couverts par les exemples
    SCRIPT_PATTERNS: [
      /\<script\b[^\<]*(?:(?!\<\/script\>)\<[^\<]*)*\<\/script\>/gi,
      /\<script/gi,
      /on\w+\s*=/gi, // onclick, onload, onerror, etc.
    ],
    
    PROTOCOL_PATTERNS: [
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
    ],
    
    JS_FUNCTION_PATTERNS: [
      /eval\s*\(/gi,
      /alert\s*\(/gi,
      /confirm\s*\(/gi,
      /prompt\s*\(/gi,
      /document\.cookie/gi,
    ],
  };

/**
 * Détecte les tentatives d'attaques XSS dans une chaîne
 * @param input Chaîne à analyser
 * @returns Résultat de la détection avec détails
 */
export function detectXssPayload(input: string): XssDetectionResult {
  if (typeof input !== 'string') {
    return {
      isVulnerable: false,
      detectedPatterns: [],
      riskLevel: 'low'
    };
  }
  
  const result: XssDetectionResult = {
    isVulnerable: false,
    detectedPatterns: [],
    riskLevel: 'low'
  };
  
  // Décodage pour éviter les contournements
  let decodedInput = input;
  try {
    // Essayer de décoder les URL encodings
    decodedInput = decodeURIComponent(input);
  } catch (e) {
    // Si le décodage échoue, utiliser l'entrée originale
    decodedInput = input;
  }
  
  // Fonction pour vérifier un ensemble de patterns
  const checkPatterns = (patterns: RegExp[], category: string) => {
    for (const pattern of patterns) {
      if (pattern.test(decodedInput)) {
        result.isVulnerable = true;
        const match = decodedInput.match(pattern)?.[0] || 'unknown';
        result.detectedPatterns.push(`${category}: ${match}`);
      }
    }
  };
  
  checkPatterns(XSS_PATTERNS.EXAMPLE_PATTERNS, 'XSS Example');
  
  // Déterminer le niveau de risque
  if (result.detectedPatterns.length > 0) {
    if (
      result.detectedPatterns.some(p => p.startsWith('Script:')) || 
      result.detectedPatterns.some(p => p.startsWith('JS Function:'))
    ) {
      result.riskLevel = 'high';
    } else if (
      result.detectedPatterns.some(p => p.startsWith('Tag:')) || 
      result.detectedPatterns.some(p => p.startsWith('Protocol:'))
    ) {
      result.riskLevel = 'medium';
    } else {
      result.riskLevel = 'low';
    }
  }
  
  // Journalisation si vulnérable
  if (result.isVulnerable) {
    logger.logError('Security', 'XSS attack detected', 'XSS attack detected', 'system', {
      detectedPatterns: result.detectedPatterns.slice(0, 5), // Limiter pour éviter un log trop volumineux
      riskLevel: result.riskLevel,
      inputPreview: decodedInput.substring(0, 100) // Limiter la taille du log
    });
  }
  
  return result;
}

/**
 * Détecte spécifiquement les attaques DOM XSS
 * @param input Chaîne à analyser
 * @returns true si une attaque DOM XSS est détectée
 */
export function detectDomXss(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  
  const result = detectXssPayload(input);
  return result.detectedPatterns.some(p => p.startsWith('DOM XSS:'));
}

/**
 * Nettoie les entrées utilisateur pour prévenir les attaques XSS
 * @param input Chaîne à nettoyer
 * @returns Chaîne nettoyée
 */
export function sanitizeUserInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
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
  
  try {
    // Importer sanitizeHtml dynamiquement
    const sanitizeHtml = require('sanitize-html');
    return sanitizeHtml(input, SANITIZE_CONFIG);
  } catch (e) {
    // Fallback si sanitizeHtml n'est pas disponible
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

/**
 * Analyse contextuelle avancée pour les attaques XSS
 * @param input Chaîne à analyser
 * @param context Contexte d'utilisation (html, attribute, js, css, url)
 * @returns Résultat de la détection avec contexte
 */
export function detectContextualXss(
  input: string, 
  context: 'html' | 'attribute' | 'js' | 'css' | 'url' = 'html'
): XssDetectionResult {
  const result = detectXssPayload(input);
  result.context = context;
  
  // Patterns spécifiques au contexte
  switch (context) {
    case 'attribute':
      // Vérifier les échappements d'attributs
      if (/["'`]/.test(input)) {
        result.isVulnerable = true;
        result.detectedPatterns.push('Attribute: Quote character detected');
      }
      break;
      
    case 'js':
      // Vérifier les caractères qui peuvent terminer un bloc JS
      if (/[;)}\]]/.test(input)) {
        result.isVulnerable = true;
        result.detectedPatterns.push('JS: Statement terminator detected');
      }
      break;
      
    case 'css':
      // Vérifier les expressions CSS dangereuses
      if (/expression|url\s*\(|import\s*\(/i.test(input)) {
        result.isVulnerable = true;
        result.detectedPatterns.push('CSS: Dangerous function detected');
      }
      break;
      
    case 'url':
      // Vérifier les protocoles dangereux dans les URLs
      if (/^(javascript|data|vbscript):/i.test(input)) {
        result.isVulnerable = true;
        result.detectedPatterns.push('URL: Dangerous protocol detected');
      }
      break;
  }
  
  return result;
}
