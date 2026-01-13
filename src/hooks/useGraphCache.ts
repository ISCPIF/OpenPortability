/**
 * Hook pour gérer le cache IndexedDB du graphe total
 * 
 * Stocke les données x, y, community (~162 MB pour 18M nœuds)
 * Évite les appels répétés à DuckDB
 */

import { useCallback, useRef } from 'react'

// Configuration du cache
const CACHE_CONFIG = {
  dbName: 'total_graph_cache',
  storeName: 'graph_data',
  key: 'total_graph',
  version: 1,
  // TTL de 7 jours (en millisecondes)
  ttl: 7 * 24 * 60 * 60 * 1000,
  // Version des données - incrémenter quand les données DuckDB changent
  dataVersion: '2024-12-15',
}

export interface CachedGraphData {
  x: Float32Array
  y: Float32Array
  community: Uint8Array
  count: number
  timestamp: number
  dataVersion: string
}

interface CacheMetadata {
  timestamp: number
  dataVersion: string
  count: number
}

/**
 * Ouvre la base IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_CONFIG.dbName, CACHE_CONFIG.version)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(CACHE_CONFIG.storeName)) {
        db.createObjectStore(CACHE_CONFIG.storeName)
      }
    }
  })
}

/**
 * Vérifie si le cache est valide (non expiré et bonne version)
 */
function isCacheValid(metadata: CacheMetadata): boolean {
  const now = Date.now()
  const isExpired = now > metadata.timestamp + CACHE_CONFIG.ttl
  const isOutdated = metadata.dataVersion !== CACHE_CONFIG.dataVersion
  
  if (isExpired) {
    console.log('🗄️ [Cache] Expiré (TTL dépassé)')
    return false
  }
  if (isOutdated) {
    console.log(`🗄️ [Cache] Version obsolète (${metadata.dataVersion} vs ${CACHE_CONFIG.dataVersion})`)
    return false
  }
  
  return true
}

/**
 * Hook pour gérer le cache du graphe
 */
export function useGraphCache() {
  const dbRef = useRef<IDBDatabase | null>(null)
  
  /**
   * Récupère les données du cache si valides
   */
  const getFromCache = useCallback(async (): Promise<CachedGraphData | null> => {
    try {
      console.log('🗄️ [Cache] Vérification du cache IndexedDB...')
      
      const db = await openDB()
      dbRef.current = db
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CACHE_CONFIG.storeName, 'readonly')
        const store = transaction.objectStore(CACHE_CONFIG.storeName)
        
        // Récupérer les métadonnées d'abord
        const metaRequest = store.get(`${CACHE_CONFIG.key}_meta`)
        
        metaRequest.onerror = () => reject(metaRequest.error)
        metaRequest.onsuccess = () => {
          const metadata = metaRequest.result as CacheMetadata | undefined
          
          if (!metadata) {
            console.log('🗄️ [Cache] Aucun cache trouvé')
            resolve(null)
            return
          }
          
          if (!isCacheValid(metadata)) {
            resolve(null)
            return
          }
          
          // Cache valide, récupérer les données
          console.log(`🗄️ [Cache] Cache valide trouvé (${metadata.count.toLocaleString()} nœuds)`)
          
          const xRequest = store.get(`${CACHE_CONFIG.key}_x`)
          const yRequest = store.get(`${CACHE_CONFIG.key}_y`)
          const communityRequest = store.get(`${CACHE_CONFIG.key}_community`)
          
          transaction.oncomplete = () => {
            const x = xRequest.result as Float32Array | undefined
            const y = yRequest.result as Float32Array | undefined
            const community = communityRequest.result as Uint8Array | undefined
            
            if (x && y && community) {
              console.log(`🗄️ [Cache] Données chargées depuis IndexedDB`)
              resolve({
                x,
                y,
                community,
                count: metadata.count,
                timestamp: metadata.timestamp,
                dataVersion: metadata.dataVersion,
              })
            } else {
              console.log('🗄️ [Cache] Données incomplètes')
              resolve(null)
            }
          }
          
          transaction.onerror = () => reject(transaction.error)
        }
      })
    } catch (error) {
      console.error('🗄️ [Cache] Erreur lecture:', error)
      return null
    }
  }, [])
  
  /**
   * Sauvegarde les données dans le cache
   */
  const saveToCache = useCallback(async (data: {
    x: Float32Array
    y: Float32Array
    community: Uint8Array
    count: number
  }): Promise<boolean> => {
    try {
      console.log(`🗄️ [Cache] Sauvegarde de ${data.count.toLocaleString()} nœuds...`)
      
      const db = dbRef.current || await openDB()
      dbRef.current = db
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CACHE_CONFIG.storeName, 'readwrite')
        const store = transaction.objectStore(CACHE_CONFIG.storeName)
        
        const metadata: CacheMetadata = {
          timestamp: Date.now(),
          dataVersion: CACHE_CONFIG.dataVersion,
          count: data.count,
        }
        
        // Stocker les données séparément pour éviter les problèmes de sérialisation
        store.put(metadata, `${CACHE_CONFIG.key}_meta`)
        store.put(data.x, `${CACHE_CONFIG.key}_x`)
        store.put(data.y, `${CACHE_CONFIG.key}_y`)
        store.put(data.community, `${CACHE_CONFIG.key}_community`)
        
        transaction.oncomplete = () => {
          const sizeMB = Math.round((data.x.byteLength + data.y.byteLength + data.community.byteLength) / 1024 / 1024)
          console.log(`🗄️ [Cache] Sauvegardé (~${sizeMB} MB)`)
          resolve(true)
        }
        
        transaction.onerror = () => {
          console.error('🗄️ [Cache] Erreur sauvegarde:', transaction.error)
          reject(transaction.error)
        }
      })
    } catch (error) {
      console.error('🗄️ [Cache] Erreur sauvegarde:', error)
      return false
    }
  }, [])
  
  /**
   * Supprime le cache
   */
  const clearCache = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🗄️ [Cache] Suppression du cache...')
      
      const db = dbRef.current || await openDB()
      dbRef.current = db
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CACHE_CONFIG.storeName, 'readwrite')
        const store = transaction.objectStore(CACHE_CONFIG.storeName)
        
        store.delete(`${CACHE_CONFIG.key}_meta`)
        store.delete(`${CACHE_CONFIG.key}_x`)
        store.delete(`${CACHE_CONFIG.key}_y`)
        store.delete(`${CACHE_CONFIG.key}_community`)
        
        transaction.oncomplete = () => {
          console.log('🗄️ [Cache] Cache supprimé')
          resolve(true)
        }
        
        transaction.onerror = () => reject(transaction.error)
      })
    } catch (error) {
      console.error('🗄️ [Cache] Erreur suppression:', error)
      return false
    }
  }, [])
  
  /**
   * Retourne les infos sur le cache (pour debug/UI)
   */
  const getCacheInfo = useCallback(async (): Promise<{
    exists: boolean
    valid: boolean
    count: number
    sizeMB: number
    age: string
    expiresIn: string
  } | null> => {
    try {
      const db = await openDB()
      
      return new Promise((resolve) => {
        const transaction = db.transaction(CACHE_CONFIG.storeName, 'readonly')
        const store = transaction.objectStore(CACHE_CONFIG.storeName)
        
        const metaRequest = store.get(`${CACHE_CONFIG.key}_meta`)
        const xRequest = store.get(`${CACHE_CONFIG.key}_x`)
        const yRequest = store.get(`${CACHE_CONFIG.key}_y`)
        const communityRequest = store.get(`${CACHE_CONFIG.key}_community`)
        
        transaction.oncomplete = () => {
          const metadata = metaRequest.result as CacheMetadata | undefined
          const x = xRequest.result as Float32Array | undefined
          const y = yRequest.result as Float32Array | undefined
          const community = communityRequest.result as Uint8Array | undefined
          
          if (!metadata || !x || !y || !community) {
            resolve(null)
            return
          }
          
          const now = Date.now()
          const ageMs = now - metadata.timestamp
          const expiresInMs = (metadata.timestamp + CACHE_CONFIG.ttl) - now
          
          const formatDuration = (ms: number) => {
            const days = Math.floor(ms / (24 * 60 * 60 * 1000))
            const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
            if (days > 0) return `${days}j ${hours}h`
            const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
            if (hours > 0) return `${hours}h ${minutes}m`
            return `${minutes}m`
          }
          
          resolve({
            exists: true,
            valid: isCacheValid(metadata),
            count: metadata.count,
            sizeMB: Math.round((x.byteLength + y.byteLength + community.byteLength) / 1024 / 1024),
            age: formatDuration(ageMs),
            expiresIn: expiresInMs > 0 ? formatDuration(expiresInMs) : 'Expiré',
          })
        }
        
        transaction.onerror = () => resolve(null)
      })
    } catch {
      return null
    }
  }, [])
  
  return {
    getFromCache,
    saveToCache,
    clearCache,
    getCacheInfo,
    cacheConfig: CACHE_CONFIG,
  }
}
