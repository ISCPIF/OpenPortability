/**
 * IndexedDB storage for tile-based graph nodes
 * Stores tiles separately for efficient spatial loading
 */

import { GraphNode } from '@/lib/types/graph';
import { 
  TileKey, 
  CachedTileNode, 
  graphNodeToCachedTileNode, 
  cachedTileNodeToGraphNode 
} from './types';

const DB_NAME = 'graph_tiles_db';
const DB_VERSION = 1;

// Store names
const TILES_STORE = 'tiles';
const BASE_NODES_STORE = 'base_nodes';
const METADATA_STORE = 'metadata';

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface TileRecord {
  key: TileKey;
  nodes: CachedTileNode[];
  timestamp: number;
}

interface BaseNodesRecord {
  id: 'base_nodes';
  nodes: CachedTileNode[];
  minDegree: number;
  timestamp: number;
}

interface MetadataRecord {
  key: string;
  data: unknown;
  timestamp: number;
}

/**
 * Tile-based IndexedDB storage
 */
class TileIndexedDB {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize the database
   */
  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('💾 [TileIDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Tiles store: keyed by tile key
        if (!db.objectStoreNames.contains(TILES_STORE)) {
          db.createObjectStore(TILES_STORE, { keyPath: 'key' });
        }

        // Base nodes store: single record
        if (!db.objectStoreNames.contains(BASE_NODES_STORE)) {
          db.createObjectStore(BASE_NODES_STORE, { keyPath: 'id' });
        }

        // Metadata store: generic key-value
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_TTL_MS;
  }

  // ============================================
  // Base Nodes (100k top degree)
  // ============================================

  /**
   * Save base nodes
   */
  async saveBaseNodes(nodes: GraphNode[], minDegree: number): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BASE_NODES_STORE, 'readwrite');
      const store = tx.objectStore(BASE_NODES_STORE);
      
      const record: BaseNodesRecord = {
        id: 'base_nodes',
        nodes: nodes.map(graphNodeToCachedTileNode),
        minDegree,
        timestamp: Date.now(),
      };
      
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load base nodes
   */
  async loadBaseNodes(): Promise<{ nodes: GraphNode[]; minDegree: number; timestamp: number } | null> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BASE_NODES_STORE, 'readonly');
      const store = tx.objectStore(BASE_NODES_STORE);
      
      const request = store.get('base_nodes');
      request.onsuccess = () => {
        const record = request.result as BaseNodesRecord | undefined;
        if (record && this.isCacheValid(record.timestamp)) {
          resolve({
            nodes: record.nodes.map(cachedTileNodeToGraphNode),
            minDegree: record.minDegree,
            timestamp: record.timestamp,
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Tiles
  // ============================================

  /**
   * Save a single tile
   */
  async saveTile(tileKey: TileKey, nodes: GraphNode[]): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TILES_STORE, 'readwrite');
      const store = tx.objectStore(TILES_STORE);
      
      const record: TileRecord = {
        key: tileKey,
        nodes: nodes.map(graphNodeToCachedTileNode),
        timestamp: Date.now(),
      };
      
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load a single tile
   */
  async loadTile(tileKey: TileKey): Promise<GraphNode[] | null> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TILES_STORE, 'readonly');
      const store = tx.objectStore(TILES_STORE);
      
      const request = store.get(tileKey);
      request.onsuccess = () => {
        const record = request.result as TileRecord | undefined;
        if (record && this.isCacheValid(record.timestamp)) {
          resolve(record.nodes.map(cachedTileNodeToGraphNode));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load multiple tiles at once
   */
  async loadTiles(tileKeys: TileKey[]): Promise<Map<TileKey, GraphNode[]>> {
    const db = await this.getDB();
    const result = new Map<TileKey, GraphNode[]>();
    
    if (tileKeys.length === 0) return result;
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TILES_STORE, 'readonly');
      const store = tx.objectStore(TILES_STORE);
      
      let completed = 0;
      
      for (const tileKey of tileKeys) {
        const request = store.get(tileKey);
        request.onsuccess = () => {
          const record = request.result as TileRecord | undefined;
          if (record && this.isCacheValid(record.timestamp)) {
            result.set(tileKey, record.nodes.map(cachedTileNodeToGraphNode));
          }
          completed++;
          if (completed === tileKeys.length) {
            resolve(result);
          }
        };
        request.onerror = () => {
          completed++;
          if (completed === tileKeys.length) {
            resolve(result);
          }
        };
      }
    });
  }

  /**
   * Check if a tile exists in cache
   */
  async hasTile(tileKey: TileKey): Promise<boolean> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TILES_STORE, 'readonly');
      const store = tx.objectStore(TILES_STORE);
      
      const request = store.get(tileKey);
      request.onsuccess = () => {
        const record = request.result as TileRecord | undefined;
        resolve(record !== undefined && this.isCacheValid(record.timestamp));
      };
      request.onerror = () => resolve(false);
    });
  }

  /**
   * Get all cached tile keys
   */
  async getCachedTileKeys(): Promise<TileKey[]> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TILES_STORE, 'readonly');
      const store = tx.objectStore(TILES_STORE);
      
      const request = store.getAllKeys();
      request.onsuccess = () => {
        resolve(request.result as TileKey[]);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a tile
   */
  async deleteTile(tileKey: TileKey): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TILES_STORE, 'readwrite');
      const store = tx.objectStore(TILES_STORE);
      
      const request = store.delete(tileKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all tiles
   */
  async clearTiles(): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TILES_STORE, 'readwrite');
      const store = tx.objectStore(TILES_STORE);
      
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Metadata
  // ============================================

  /**
   * Save metadata
   */
  async saveMetadata<T>(key: string, data: T): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(METADATA_STORE, 'readwrite');
      const store = tx.objectStore(METADATA_STORE);
      
      const record: MetadataRecord = {
        key,
        data,
        timestamp: Date.now(),
      };
      
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load metadata
   */
  async loadMetadata<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(METADATA_STORE, 'readonly');
      const store = tx.objectStore(METADATA_STORE);
      
      const request = store.get(key);
      request.onsuccess = () => {
        const record = request.result as MetadataRecord | undefined;
        if (record) {
          resolve({ data: record.data as T, timestamp: record.timestamp });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Clear All
  // ============================================

  /**
   * Clear all data (tiles, base nodes, metadata)
   */
  async clearAll(): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction([TILES_STORE, BASE_NODES_STORE, METADATA_STORE], 'readwrite');
      
      tx.objectStore(TILES_STORE).clear();
      tx.objectStore(BASE_NODES_STORE).clear();
      tx.objectStore(METADATA_STORE).clear();
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// Singleton instance
export const tileIDB = new TileIndexedDB();
