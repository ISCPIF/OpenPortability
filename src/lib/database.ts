import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'
import logger from './log_utils'

// Pools créés de manière lazy pour permettre le chargement des variables d'environnement
let _nextAuthPool: Pool | null = null
let _publicPool: Pool | null = null

function getNextAuthPoolConfig() {
  return {
    host: process.env.PGBOUNCER_HOST || 'pgbouncer',
    port: parseInt(process.env.PGBOUNCER_PORT || '6432'),
    database: process.env.POSTGRES_DB || 'nexus',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'mysecretpassword',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  }
}

function getPublicPoolConfig() {
  return {
    host: process.env.PGBOUNCER_HOST || 'pgbouncer',
    port: parseInt(process.env.PGBOUNCER_PORT || '6432'),
    database: process.env.POSTGRES_DB || 'nexus',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'mysecretpassword',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  }
}

// Getters qui créent les pools à la demande
export const nextAuthPool = new Proxy({} as Pool, {
  get(target, prop) {
    if (!_nextAuthPool) {
      _nextAuthPool = new Pool(getNextAuthPoolConfig())
      _nextAuthPool.on('error', (err) => {
        logger.logError('Database', 'nextAuthPool', 'Unexpected error on idle client', undefined, { error: err })
      })
    }
    return (_nextAuthPool as any)[prop]
  }
})

export const publicPool = new Proxy({} as Pool, {
  get(target, prop) {
    if (!_publicPool) {
      _publicPool = new Pool(getPublicPoolConfig())
      _publicPool.on('error', (err) => {
        logger.logError('Database', 'publicPool', 'Unexpected error on idle client', undefined, { error: err })
      })
    }
    return (_publicPool as any)[prop]
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
    
    logger.logDebug('Database', 'queryNextAuth', `Query executed in ${duration}ms`, undefined, {
      text,
      rows: result.rowCount,
      duration
    })
    
    return result
  } catch (error) {
    logger.logError('Database', 'queryNextAuth', 'Query failed', undefined, {
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
    
    logger.logDebug('Database', 'queryPublic', `Query executed in ${duration}ms`, undefined, {
      text,
      rows: result.rowCount,
      duration
    })
    
    return result
  } catch (error) {
    logger.logError('Database', 'queryPublic', 'Query failed', undefined, {
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
    logger.logError('Database', 'transactionNextAuth', 'Transaction failed and rolled back', undefined, { error })
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
    logger.logError('Database', 'transactionPublic', 'Transaction failed and rolled back', undefined, { error })
    throw error
  } finally {
    client.release()
  }
}

// Fonction pour fermer les pools (utile pour les tests et le shutdown)
export async function closePools(): Promise<void> {
  if (_nextAuthPool) {
    await _nextAuthPool.end()
  }
  if (_publicPool) {
    await _publicPool.end()
  }
  logger.logInfo('Database', 'closePools', 'All database pools closed')
}

// Fonction pour vérifier la connexion
export async function checkConnection(): Promise<boolean> {
  try {
    await queryNextAuth('SELECT 1')
    await queryPublic('SELECT 1')
    logger.logInfo('Database', 'checkConnection', 'Database connection successful')
    return true
  } catch (error) {
    logger.logError('Database', 'checkConnection', 'Database connection failed', undefined, { error })
    return false
  }
}
