/**
 * Web Worker pour charger les données followers depuis DuckDB
 * 
 * Avantages:
 * - Mémoire isolée du main thread
 * - Les TypedArrays sont transférés (pas copiés) via Transferable
 * - Quand le worker termine, sa mémoire est libérée
 */

import { tableFromIPC } from 'apache-arrow';

interface WorkerMessage {
  type: 'start';
  apiUrl: string;
  batchSize: number;
}

interface ProgressMessage {
  type: 'progress';
  loaded: number;
  total: number;
  progress: number;
}

interface BatchReadyMessage {
  type: 'batch_ready';
  x: Float32Array;
  y: Float32Array;
  community: Uint8Array;
  count: number;
  isFirst: boolean;
  isLast: boolean;
}

interface CompleteMessage {
  type: 'complete';
  x: Float32Array;
  y: Float32Array;
  community: Uint8Array;
  count: number;
}

interface ErrorMessage {
  type: 'error';
  error: string;
}

type OutgoingMessage = ProgressMessage | BatchReadyMessage | CompleteMessage | ErrorMessage;

// Fonction pour envoyer un message typé
function postTypedMessage(message: OutgoingMessage, transfer?: Transferable[]) {
  if (transfer) {
    (self as unknown as Worker).postMessage(message, transfer);
  } else {
    self.postMessage(message);
  }
}

// Gestionnaire de messages
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, apiUrl, batchSize } = event.data;
  
  if (type !== 'start') return;
  
  console.log('🔧 [Worker] Starting followers loading...');
  
  try {
    // 1. Obtenir le nombre total de nœuds
    const countSql = 'SELECT COUNT(*) as total FROM postgres_db.public.graph_100_communities';
    const countResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: countSql, type: 'arrow' }),
      credentials: 'include', // Inclure les cookies de session
    });
    
    if (!countResponse.ok) throw new Error('Failed to get node count');
    const countBuffer = await countResponse.arrayBuffer();
    const countTable = tableFromIPC(countBuffer);
    const totalCol = countTable.getChild('total');
    const totalNodes = Number(totalCol?.get(0) ?? 0);
    
    console.log(`🔧 [Worker] Total nodes to load: ${totalNodes}`);
    
    // 2. Pré-allouer les TypedArrays
    const allX = new Float32Array(totalNodes);
    const allY = new Float32Array(totalNodes);
    const allCommunity = new Uint8Array(totalNodes);
    
    let currentIndex = 0;
    let offset = 0;
    let batchNum = 0;
    
    // 3. Charger par batch
    while (offset < totalNodes) {
      const sql = `SELECT x, y, community FROM postgres_db.public.graph_100_communities ORDER BY id LIMIT ${batchSize} OFFSET ${offset}`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, type: 'arrow' }),
        credentials: 'include', // Inclure les cookies de session
      });
      
      if (!response.ok) throw new Error(`Failed to load batch at offset ${offset}`);
      
      const buffer = await response.arrayBuffer();
      const arrowTable = tableFromIPC(buffer);
      const numRows = arrowTable.numRows;
      
      // Extraire les colonnes Arrow
      const xCol = arrowTable.getChild('x');
      const yCol = arrowTable.getChild('y');
      const communityCol = arrowTable.getChild('community');
      
      // Copier dans les TypedArrays pré-alloués
      for (let i = 0; i < numRows; i++) {
        allX[currentIndex] = Number(xCol?.get(i) ?? 0);
        allY[currentIndex] = Number(yCol?.get(i) ?? 0);
        const comm = communityCol?.get(i);
        allCommunity[currentIndex] = comm != null && comm >= 0 ? Math.min(255, Number(comm)) : 0;
        currentIndex++;
      }
      
      offset += batchSize;
      batchNum++;
      const progress = Math.min(100, Math.round((offset / totalNodes) * 100));
      
      const isFirst = batchNum === 1;
      const isLast = offset >= totalNodes;
      
      // Envoyer la progression
      postTypedMessage({
        type: 'progress',
        loaded: currentIndex,
        total: totalNodes,
        progress,
      });
      
      // Envoyer les données à CHAQUE batch pour affichage progressif
      // Créer des copies pour le transfert (subarray partage le buffer)
      const xSlice = allX.slice(0, currentIndex);
      const ySlice = allY.slice(0, currentIndex);
      const communitySlice = allCommunity.slice(0, currentIndex);
      
      postTypedMessage({
        type: 'batch_ready',
        x: xSlice,
        y: ySlice,
        community: communitySlice,
        count: currentIndex,
        isFirst,
        isLast,
      }, [xSlice.buffer, ySlice.buffer, communitySlice.buffer]);
      
      console.log(`🔧 [Worker] Batch ${batchNum}: ${currentIndex}/${totalNodes} (${progress}%)`);
    }
    
    console.log(`🔧 [Worker] Loading complete: ${currentIndex} nodes`);
    
    // Note: Les données finales ont déjà été envoyées dans le dernier batch_ready
    // On envoie juste un message de completion
    postTypedMessage({
      type: 'complete',
      x: new Float32Array(0), // Vide car déjà transféré
      y: new Float32Array(0),
      community: new Uint8Array(0),
      count: currentIndex,
    });
    
  } catch (error) {
    console.error('🔧 [Worker] Error:', error);
    postTypedMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export {};
