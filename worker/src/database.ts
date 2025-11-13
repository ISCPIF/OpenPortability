// worker/src/database.ts
import { Pool, QueryResult, QueryResultRow } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

// Pool pour le schéma public
const publicPool = new Pool({
  host: process.env.PGBOUNCER_HOST || 'pgbouncer',
  port: parseInt(process.env.PGBOUNCER_PORT || '6432'),
  database: process.env.POSTGRES_DB || 'nexus',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'mysecretpassword',
  max: 20, // Worker peut avoir plus de connexions pour les imports massifs
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// Pool pour le schéma next-auth
const nextAuthPool = new Pool({
  host: process.env.PGBOUNCER_HOST || 'pgbouncer',
  port: parseInt(process.env.PGBOUNCER_PORT || '6432'),
  database: process.env.POSTGRES_DB || 'nexus',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'mysecretpassword',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

/**
 * Exécute une requête sur le schéma public
 */
export async function queryPublic<T extends QueryResultRow = any>(
  sql: string,
  params?: any[]
): Promise<{ rows: T[] }> {
  const client = await publicPool.connect()
  try {
    const result: QueryResult<T> = await client.query(sql, params)
    return { rows: result.rows }
  } finally {
    client.release()
  }
}

/**
 * Exécute une requête sur le schéma next-auth
 */
export async function queryNextAuth<T extends QueryResultRow = any>(
  sql: string,
  params?: any[]
): Promise<{ rows: T[] }> {
  const client = await nextAuthPool.connect()
  try {
    await client.query('SET search_path TO "next-auth", public')
    const result: QueryResult<T> = await client.query(sql, params)
    return { rows: result.rows }
  } finally {
    client.release()
  }
}

/**
 * Ferme les pools de connexion (pour graceful shutdown)
 */
export async function closeAllPools(): Promise<void> {
  await Promise.all([
    publicPool.end(),
    nextAuthPool.end()
  ])
}

// Log la configuration au démarrage
console.log('Worker Database', 'init', 'Pools initialized', {
  host: process.env.PGBOUNCER_HOST || 'pgbouncer',
  port: process.env.PGBOUNCER_PORT || '6432',
  database: process.env.POSTGRES_DB || 'nexus',
  publicPoolMax: 20,
  nextAuthPoolMax: 10
})
