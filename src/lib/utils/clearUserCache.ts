/**
 * Utility to clear user-specific cached data on logout.
 * 
 * Clears:
 * - IndexedDB: hqx_graph_cache (personal graph data)
 * - IndexedDB: hqx_public_graph_cache (public graph data - optional)
 * - localStorage: user preferences
 * - sessionStorage: temporary data
 * 
 * Does NOT clear:
 * - Cookies (handled by next-auth signOut)
 * - Service worker cache (if any)
 */

// IndexedDB database names used by the app
const IDB_DATABASES = [
  'hqx_graph_cache',        // Personal graph data (GraphDataContext)
  'hqx_public_graph_cache', // Public graph data (PublicGraphDataContext) - optional
];

// localStorage keys to clear (user-specific)
const LOCAL_STORAGE_PATTERNS = [
  'user_language_',         // Language preference
  'hqx_',                   // Any app-specific keys
];

/**
 * Delete an IndexedDB database by name
 */
async function deleteIndexedDB(dbName: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(dbName);
      
      request.onsuccess = () => {
        console.log(`🗑️ [Cache Clear] Deleted IndexedDB: ${dbName}`);
        resolve(true);
      };
      
      request.onerror = () => {
        console.warn(`🗑️ [Cache Clear] Failed to delete IndexedDB: ${dbName}`, request.error);
        resolve(false);
      };
      
      request.onblocked = () => {
        console.warn(`🗑️ [Cache Clear] IndexedDB deletion blocked: ${dbName}`);
        resolve(false);
      };
    } catch (error) {
      console.warn(`🗑️ [Cache Clear] Error deleting IndexedDB: ${dbName}`, error);
      resolve(false);
    }
  });
}

/**
 * Clear localStorage keys matching patterns
 */
function clearLocalStorage(userId?: string): void {
  if (typeof localStorage === 'undefined') return;
  
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    
    // Check if key matches any pattern
    const shouldRemove = LOCAL_STORAGE_PATTERNS.some(pattern => key.startsWith(pattern));
    
    // Also remove user-specific keys if userId provided
    if (shouldRemove || (userId && key.includes(userId))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🗑️ [Cache Clear] Removed localStorage: ${key}`);
  });
}

/**
 * Clear sessionStorage
 */
function clearSessionStorage(): void {
  if (typeof sessionStorage === 'undefined') return;
  
  sessionStorage.clear();
  console.log('🗑️ [Cache Clear] Cleared sessionStorage');
}

/**
 * Clear global state references (window.__globalGraphState, etc.)
 */
function clearGlobalState(): void {
  if (typeof window === 'undefined') return;
  
  // Clear graph state
  if ((window as any).__globalGraphState) {
    (window as any).__globalGraphState = null;
  }
  
  // Clear followers network state
  if ((window as any).__followersNetworkState) {
    (window as any).__followersNetworkState = null;
  }
  
  console.log('🗑️ [Cache Clear] Cleared global state');
}

/**
 * Main function to clear all user cache on logout.
 * 
 * @param userId - Optional user ID for user-specific cleanup
 * @param clearPublicCache - Whether to also clear public graph cache (default: false)
 */
export async function clearUserCache(
  userId?: string,
  clearPublicCache: boolean = false
): Promise<void> {
  console.log('🗑️ [Cache Clear] Starting cache cleanup...');
  
  // 1. Clear IndexedDB databases
  const dbsToDelete = clearPublicCache 
    ? IDB_DATABASES 
    : IDB_DATABASES.filter(db => db !== 'hqx_public_graph_cache');
  
  await Promise.all(dbsToDelete.map(deleteIndexedDB));
  
  // 2. Clear localStorage
  clearLocalStorage(userId);
  
  // 3. Clear sessionStorage
  clearSessionStorage();
  
  // 4. Clear global state
  clearGlobalState();
  
  console.log('🗑️ [Cache Clear] Cache cleanup complete');
}

/**
 * Convenience function for logout - clears personal data only
 */
export async function clearCacheOnLogout(userId?: string): Promise<void> {
  await clearUserCache(userId, false);
}

/**
 * Convenience function for account deletion - clears everything
 */
export async function clearCacheOnAccountDelete(userId?: string): Promise<void> {
  await clearUserCache(userId, true);
}
