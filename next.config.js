/**
 * Next.js Configuration Router
 * 
 * Sélectionne automatiquement la config selon NODE_ENV:
 * - development → next.config.dev.js
 * - production  → next.config.prod.js
 * 
 * Ou forcer une config spécifique avec NEXT_CONFIG_FILE:
 *   NEXT_CONFIG_FILE=next.config.prod.js npm run dev
 */

const configFile = process.env.NEXT_CONFIG_FILE 
  || (process.env.NODE_ENV === 'production' ? './next.config.prod.js' : './next.config.dev.js');

console.log(`📦 Loading Next.js config: ${configFile}`);

module.exports = require(configFile);