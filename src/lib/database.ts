import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'
import logger from './log_utils'

// ============================================================================
// SINGLETON PATTERN POUR NEXT.JS
// ============================================================================
// En Next.js, les modules peuvent être rechargés (hot reload en dev, ou 
// différentes invocations serverless en prod). Sans globalThis, chaque reload
// crée un NOUVEAU pool sans fermer l'ancien → accumulation de connexions mortes
// → saturation → timeouts.
//
// globalThis persiste entre les reloads du module.
// ============================================================================

// Déclaration du type global pour TypeScript
declare global {
  // eslint-disable-next-line no-var
  var __nextAuthPool: Pool | undefined
  // eslint-disable-next-line no-var
  var __publicPool: Pool | undefined
}

function getNextAuthPoolConfig() {
  return {
    host: process.env.PGBOUNCER_HOST || 'pgbouncer',
    port: parseInt(process.env.PGBOUNCER_PORT || '6432'),
    database: process.env.POSTGRES_DB || 'nexus',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'mysecretpassword',
    max: 10,                        // Réduit pour éviter saturation PgBouncer
    idleTimeoutMillis: 10000,       // Libère les connexions idle plus vite (10s)
    connectionTimeoutMillis: 30000, // Fail fast si pool saturé
    allowExitOnIdle: true,          // Permet de fermer les connexions idle
    maxLifetimeSeconds: 300,        // Force rotation des connexions toutes les 5 min
  }
}

function getPublicPoolConfig() {
  return {
    host: process.env.PGBOUNCER_HOST || 'pgbouncer',
    port: parseInt(process.env.PGBOUNCER_PORT || '6432'),
    database: process.env.POSTGRES_DB || 'nexus',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'mysecretpassword',
    max: 8,                         // Réduit pour éviter saturation PgBouncer
    idleTimeoutMillis: 10000,       // Libère les connexions idle plus vite (10s)
    connectionTimeoutMillis: 30000, // Fail fast si pool saturé
    allowExitOnIdle: true,          // Permet de fermer les connexions idle
    maxLifetimeSeconds: 300,        // Force rotation des connexions toutes les 5 min
  }
}

// Création des pools avec singleton via globalThis
function getNextAuthPool(): Pool {
  if (!globalThis.__nextAuthPool) {
    console.log('Database', 'getNextAuthPool', 'Creating new nextAuthPool singleton')
    globalThis.__nextAuthPool = new Pool(getNextAuthPoolConfig())
    globalThis.__nextAuthPool.on('error', (err: Error) => {
      console.log('Database', 'nextAuthPool', 'Unexpected error on idle client', undefined, { error: err.message })
    })
    globalThis.__nextAuthPool.on('connect', () => {
      // console.log('Database', 'nextAuthPool', 'New client connected')
    })
    globalThis.__nextAuthPool.on('remove', () => {
      // console.log('Database', 'nextAuthPool', 'Client removed from pool')
    })
  }
  return globalThis.__nextAuthPool
}

function getPublicPool(): Pool {
  if (!globalThis.__publicPool) {
    console.log('Database', 'getPublicPool', 'Creating new publicPool singleton')
    globalThis.__publicPool = new Pool(getPublicPoolConfig())
    globalThis.__publicPool.on('error', (err: Error) => {
      console.log('Database', 'publicPool', 'Unexpected error on idle client', undefined, { error: err.message })
    })
    globalThis.__publicPool.on('connect', () => {
      // console.log('Database', 'publicPool', 'New client connected')
    })
    globalThis.__publicPool.on('remove', () => {
      // console.log('Database', 'publicPool', 'Client removed from pool')
    })
  }
  return globalThis.__publicPool
}

// Export des pools via getters (pour compatibilité avec le code existant)
export const nextAuthPool = new Proxy({} as Pool, {
  get(_, prop) {
    const pool = getNextAuthPool()
    const value = (pool as any)[prop]
    // Bind les méthodes au pool pour conserver le contexte
    return typeof value === 'function' ? value.bind(pool) : value
  }
})

export const publicPool = new Proxy({} as Pool, {
  get(_, prop) {
    const pool = getPublicPool()
    const value = (pool as any)[prop]
    return typeof value === 'function' ? value.bind(pool) : value
  }
})

// Helper pour exécuter une query sur le pool next-auth
export async function queryNextAuth<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now()
  const client = await nextAuthPool.connect()
  try {
    // Définir le search_path pour cette connexion
    await client.query('SET search_path TO "next-auth", public')
    const result = await client.query<T>(text, params)
    const duration = Date.now() - start
    
   
    
    return result
  } catch (error) {
    console.log('Database', 'queryNextAuth', 'Query failed', undefined, {
      text,
      params,
      error
    })
    throw error
  } finally {
    client.release()
  }
}

// Helper pour exécuter une query sur le pool public
export async function queryPublic<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now()
  const client = await publicPool.connect()
  try {
    // Définir le search_path pour cette connexion
    await client.query('SET search_path TO public')
    const result = await client.query<T>(text, params)
    const duration = Date.now() - start
    
    return result
  } catch (error) {
   console.log('Database', 'queryPublic', 'Query failed', undefined, {
      text,
      params,
      error
    })
    throw error
  } finally {
    client.release()
  }
}

// Helper pour les transactions sur next-auth
export async function transactionNextAuth<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await nextAuthPool.connect()
  
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    console.log('Database', 'transactionNextAuth', 'Transaction failed and rolled back', undefined, { error })
    throw error
  } finally {
    client.release()
  }
}

// Helper pour les transactions sur public
export async function transactionPublic<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await publicPool.connect()
  
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    console.log('Database', 'transactionPublic', 'Transaction failed and rolled back', undefined, { error })
    throw error
  } finally {
    client.release()
  }
}

// Fonction pour fermer les pools (utile pour les tests et le shutdown)
export async function closePools(): Promise<void> {
  if (globalThis.__nextAuthPool) {
    await globalThis.__nextAuthPool.end()
    globalThis.__nextAuthPool = undefined
  }
  if (globalThis.__publicPool) {
    await globalThis.__publicPool.end()
    globalThis.__publicPool = undefined
  }
  console.log('Database', 'closePools', 'All database pools closed')
}

// Fonction pour vérifier la connexion
export async function checkConnection(): Promise<boolean> {
  try {
    await queryNextAuth('SELECT 1')
    await queryPublic('SELECT 1')
   console.log('Database', 'checkConnection', 'Database connection successful')
    return true
  } catch (error) {
 console.log('Database', 'checkConnection', 'Database connection failed', undefined, { error })
    return false
  }
}
