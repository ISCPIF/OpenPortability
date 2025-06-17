import fs from 'fs';
import path from 'path';

// Fonction pour charger les exemples SQL depuis le fichier
function loadSqlExamples(): string[] {
  try {
    const sqlExamplesPath = path.join(process.cwd(), 'security', 'sql_example.txt');
    const content = fs.readFileSync(sqlExamplesPath, 'utf8');
    return content.split('\n')
      .filter(line => line.trim() && !line.startsWith('//') && !line.startsWith('#') && !line.startsWith('*'))
      .map(line => line.trim());
  } catch (error) {
    console.log('Security', 'Could not load SQL examples file', 'system', {
      error: (error as Error).message
    });
    return [];
  }
}

// Charger les exemples et les convertir en patterns regex sécurisés
function createPatternsFromExamples(examples: string[]): RegExp[] {
  const patterns: RegExp[] = [];
  
  for (const example of examples) {
    try {
      // Ignorer les exemples trop courts (moins de 3 caractères) pour éviter les faux positifs
      if (example.length < 3) continue;
      
      // Échapper les caractères spéciaux regex mais conserver les patterns importants
      const escaped = example
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Échapper les caractères spéciaux regex
        .replace(/\\"/g, '["\']')               // Remplacer les guillemets par une classe de caractères
        .replace(/\\\//g, '\\/');               // Conserver les slashes

      // Créer un pattern qui recherche l'exemple de manière plus précise
      // Ajouter \b (délimiteur de mot) pour les mots-clés SQL courants
      if (/\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|OR|AND|UNION|JOIN|WHERE|FROM|INTO|VALUES)\b/i.test(example)) {
        // Pour les mots-clés SQL courants, utiliser des délimiteurs de mots
        patterns.push(new RegExp(`\\b${escaped}\\b`, 'gi'));
      } else {
        // Pour les autres patterns (plus complexes), utiliser la recherche flexible
        patterns.push(new RegExp(escaped, 'gi'));
      }
    } catch (error) {
      // Ignorer les patterns qui ne peuvent pas être convertis en regex valides
      continue;
    }
  }
  
  return patterns;
}

// Charger les exemples SQL
const sqlExamples = loadSqlExamples();

/**
 * Résultat de la détection SQL injection avec informations détaillées
 */
export interface SqlDetectionResult {
  isVulnerable: boolean;
  detectedPatterns: string[];
  riskLevel: 'low' | 'medium' | 'high';
  context?: string;
}

const SQL_PATTERNS = {
  // Patterns générés à partir du fichier d'exemples
  EXAMPLE_PATTERNS: createPatternsFromExamples(sqlExamples),
  
  // Conserver quelques patterns critiques qui pourraient ne pas être couverts par les exemples
  BASIC_PATTERNS: [
    /\b(UNION\s+SELECT|SELECT\s+@@|SLEEP\s*\(|BENCHMARK\s*\(|WAITFOR\s+DELAY)/gi,
    /\b(OR|AND)\s+['"]?\s*\d+\s*=\s*\d+\s*['"]?/gi,
    /\b(OR|AND)\s+['"]?[^'"]*['"]?\s*=\s*['"]?[^'"]*['"]?/gi,
    /--\s*$/m,
    /;\s*--/gi,
  ],
  
  COMMENT_PATTERNS: [
    /\/\*.*?\*\//gi,
    /--.*?$/gm,  ],
  
  TIME_BASED_PATTERNS: [
    /SLEEP\s*\(\s*\d+\s*\)/gi,
    /BENCHMARK\s*\(\s*\d+\s*,/gi,
    /WAITFOR\s+DELAY\s+['"].*?['"]/gi,
    /pg_sleep\s*\(\s*\d+\s*\)/gi,
  ],
  
  STACKED_QUERY_PATTERNS: [
    /;\s*SELECT/gi,
    /;\s*INSERT/gi,
    /;\s*UPDATE/gi,
    /;\s*DELETE/gi,
    /;\s*DROP/gi,
    /;\s*CREATE/gi,
    /;\s*ALTER/gi,
    /;\s*EXEC/gi,
  ],
};

/**
 * Détecte les tentatives d'injections SQL dans une chaîne
 * @param input Chaîne à analyser
 * @returns Résultat de la détection avec détails
 */
export function detectSqlInjectionPayload(input: string): SqlDetectionResult {
  if (typeof input !== 'string') {
    return {
      isVulnerable: false,
      detectedPatterns: [],
      riskLevel: 'low'
    };
  }
  
  const result: SqlDetectionResult = {
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
  
  // Ignorer les détections pour les champs d'authentification si ce sont des mots de passe simples
  // Cette vérification permet d'éviter les faux positifs sur les mots de passe
  if (input.length < 30 && /^[a-zA-Z0-9_]+$/.test(input)) {
    // Si c'est un mot de passe simple (alphanumérique + underscore), ignorer les détections
    return result;
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
  
  // Vérifier tous les patterns
  checkPatterns(SQL_PATTERNS.EXAMPLE_PATTERNS, 'SQL Example');
  checkPatterns(SQL_PATTERNS.BASIC_PATTERNS, 'SQL Basic');
  checkPatterns(SQL_PATTERNS.COMMENT_PATTERNS, 'SQL Comment');
  checkPatterns(SQL_PATTERNS.TIME_BASED_PATTERNS, 'Time-Based');
  checkPatterns(SQL_PATTERNS.STACKED_QUERY_PATTERNS, 'Stacked Query');
  
  // Déterminer le niveau de risque
  if (result.detectedPatterns.length > 0) {
    if (
      result.detectedPatterns.some(p => p.startsWith('Time-Based:')) || 
      result.detectedPatterns.some(p => p.startsWith('Stacked Query:'))
    ) {
      result.riskLevel = 'high';
    } else if (
      result.detectedPatterns.some(p => p.startsWith('SQL Basic:')) || 
      result.detectedPatterns.length > 1
    ) {
      result.riskLevel = 'medium';
    } else {
      result.riskLevel = 'low';
    }
  }
  
  // Journalisation si vulnérable
  if (result.isVulnerable) {
    console.log('Security', 'SQL injection attack detected', 'system', {
      detectedPatterns: result.detectedPatterns.slice(0, 5), // Limiter pour éviter un log trop volumineux
      riskLevel: result.riskLevel,
      inputPreview: decodedInput.substring(0, 100) // Limiter la taille du log
    });
  }
  
  return result;
}

/**
 * Détecte spécifiquement les attaques d'injection SQL basées sur le temps
 * @param input Chaîne à analyser
 * @returns true si une attaque time-based est détectée
 */
export function detectTimeBasedSqlInjection(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  
  const result = detectSqlInjectionPayload(input);
  return result.detectedPatterns.some(p => p.startsWith('Time-Based:'));
}

/**
 * Échappe les caractères spéciaux SQL pour prévenir les injections
 * @param input Chaîne à échapper
 * @returns Chaîne échappée
 */
export function escapeSqlString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/'/g, "''")
    .replace(/\\/g, "\\\\")
    .replace(/\x00/g, "\\0")
    .replace(/\x1a/g, "\\Z");
}

/**
 * Analyse contextuelle avancée pour les attaques SQL
 * @param input Chaîne à analyser
 * @param context Contexte d'utilisation (where, insert, update, delete)
 * @returns Résultat de la détection avec contexte
 */
export function detectContextualSqlInjection(
  input: string, 
  context: 'where' | 'insert' | 'update' | 'delete' = 'where'
): SqlDetectionResult {
  const result = detectSqlInjectionPayload(input);
  result.context = context;
  
  // Patterns spécifiques au contexte
  switch (context) {
    case 'where':
      // Vérifier les patterns spécifiques aux clauses WHERE
      if (/\b(OR|AND)\s+['"]?[^'"]*['"]?\s*=\s*['"]?[^'"]*['"]?/i.test(input)) {
        result.isVulnerable = true;
        result.detectedPatterns.push('WHERE: Logical operator detected');
      }
      break;
      
    case 'insert':
      // Vérifier les patterns spécifiques aux requêtes INSERT
      if (/VALUES\s*\([^)]*\)/i.test(input)) {
        result.isVulnerable = true;
        result.detectedPatterns.push('INSERT: VALUES clause detected');
      }
      break;
      
    case 'update':
      // Vérifier les patterns spécifiques aux requêtes UPDATE
      if (/SET\s+[^=]+=\s*[^,;]*/i.test(input)) {
        result.isVulnerable = true;
        result.detectedPatterns.push('UPDATE: SET clause detected');
      }
      break;
      
    case 'delete':
      // Vérifier les patterns spécifiques aux requêtes DELETE
      if (/FROM\s+[^;]*/i.test(input)) {
        result.isVulnerable = true;
        result.detectedPatterns.push('DELETE: FROM clause detected');
      }
      break;
  }
  
  return result;
}
