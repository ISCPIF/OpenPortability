import { spawn } from 'child_process';

// CSV conversion functions for new schema
export async function convertTwitterDataToCSV(
  data: any[],
  userId: string,
  dataType: 'followers' | 'targets',
  workerId: string
): Promise<{ dataContent: string; relationsContent: string }> {
  try {
    // Prepare data for CSV export
    const isFollowers = dataType === 'followers';
    const itemKey = isFollowers ? 'follower' : 'following';
    
    // Sort data by twitter_id for better PostgreSQL performance
    const sortedData = data.sort((a, b) => {
      const idA = parseInt(a[itemKey].accountId);
      const idB = parseInt(b[itemKey].accountId);
      return idA - idB;
    });
    
    // Create nodes CSV content (for the unified nodes table)
    const dataRows = sortedData.map(item => {
      const twitterId = item[itemKey].accountId;
      return `"${twitterId}"`;
    }).join('\n');
    
    const dataHeader = 'twitter_id';
    const dataContent = `${dataHeader}\n${dataRows}`;
    
    // Create relations CSV content
    const relationsRows = sortedData.map(item => {
      const twitterId = item[itemKey].accountId;
      return `"${userId}","${twitterId}"`;
    }).join('\n');
    
    const relationsHeader = isFollowers 
      ? 'source_id,node_id' 
      : 'source_id,node_id';
    const relationsContent = `${relationsHeader}\n${relationsRows}`;
    
    console.log(`[Worker ${workerId}] ✅ CSV content created (sorted): ${sortedData.length} data rows, ${sortedData.length} relation rows`);
    
    return { dataContent, relationsContent };
    
  } catch (error) {
    console.log(`[Worker ${workerId}] ❌ Error creating CSV content:`, error);
    throw error;
  }
}

export async function importCSVViaPsql(
  dataContent: string,
  relationsContent: string,
  dataType: 'followers' | 'targets',
  userId: string,
  workerId: string,
  skipTriggerManagement: boolean = false,
  skipNodesImport: boolean = false
): Promise<{ success: boolean; processed: number; error?: string }> {
  const maxRetries = 3;
  const baseDelayMs = 1000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await importCSVViaPsqlAttempt(dataContent, relationsContent, dataType, userId, workerId, skipTriggerManagement, skipNodesImport);
      
      if (result.success || attempt === maxRetries) {
        return result;
      }
      
      // Check if error is retryable
      const isRetryable = result.error && (
        result.error.includes('deadlock detected') ||
        result.error.includes('Command timeout') ||
        result.error.includes('could not serialize access')
      );
      
      if (!isRetryable) {
        return result;
      }
      
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`[Worker ${workerId}] 🔄 Retry attempt ${attempt}/${maxRetries} after ${delayMs}ms delay`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
    } catch (error) {
      console.log(`[Worker ${workerId}] ❌ Unexpected error in retry attempt ${attempt}:`, error);
      if (attempt === maxRetries) {
        return { success: false, processed: 0, error: `Max retries exceeded: ${error}` };
      }
    }
  }
  
  return { success: false, processed: 0, error: 'Max retries exceeded' };
}

async function importCSVViaPsqlAttempt(
  dataContent: string,
  relationsContent: string,
  dataType: 'followers' | 'targets',
  userId: string,
  workerId: string,
  skipTriggerManagement: boolean = false,
  skipNodesImport: boolean = false
): Promise<{ success: boolean; processed: number; error?: string }> {
  const startTime = Date.now();
  const isFollowers = dataType === 'followers';
  
  // Parse data to get counts
  const dataLines = dataContent.trim().split('\n');
  const relationsLines = relationsContent.trim().split('\n');
  const dataCount = Math.max(0, dataLines.length - 1);
  const relationsCount = Math.max(0, relationsLines.length - 1);

  console.log(`[Worker ${workerId}] 🚀 Bulk import for ${dataType} | Nodes: ${dataCount} | Relations: ${relationsCount}...`);
  
  // Calculate timeout - smaller chunks need less time
  const baseTimeout = 120;
  const scalingFactor = 10;
  const maxTimeout = 600;
  
  const timeoutValue = Math.max(baseTimeout, Math.min(maxTimeout, baseTimeout + Math.floor((dataCount + relationsCount) / 1000) * scalingFactor));
  console.log(`[Worker ${workerId}] ⏱️ Using timeout: ${timeoutValue}s for ${dataCount + relationsCount} total records`);
  
  const relationTableName = isFollowers ? 'sources_followers' : 'sources_targets';
  const nodesTempTable = `temp_nodes_${Date.now()}`;
  const relationTempTable = `temp_${relationTableName}_${Date.now()}`;

  try {
    // STEP 1: Import nodes with conflict resolution (can be skipped if preloaded for the job)
    if (!skipNodesImport) {
      const nodesImportSql = `
    BEGIN;
    
    SET statement_timeout TO '${timeoutValue}s';
    SET synchronous_commit TO OFF;
    
    CREATE TEMP TABLE ${nodesTempTable} (twitter_id BIGINT);
    COPY ${nodesTempTable} FROM STDIN WITH (FORMAT csv, HEADER true);
    
    INSERT INTO nodes (twitter_id)
    SELECT t.twitter_id 
    FROM ${nodesTempTable} t
    ON CONFLICT (twitter_id) DO NOTHING;
    
    DROP TABLE ${nodesTempTable};
    COMMIT;
  `;

      console.log(`[Worker ${workerId}] 🚀 Step 1: Importing nodes...`);
      const nodesResult = await executePostgresCommandWithStdin(nodesImportSql, dataContent, workerId, timeoutValue * 1000);
      if (!nodesResult.success) {
        throw new Error(`Nodes import failed: ${nodesResult.error}`);
      }
      console.log(`[Worker ${workerId}] ✅ Step 1 completed: Nodes imported`);
    } else {
      console.log(`[Worker ${workerId}] ⏭️ Skipping Step 1 (nodes) — preloaded once per job`);
    }

    // STEP 2: Import relations with conditional trigger management
    console.log(`[Worker ${workerId}] 🚀 Step 2: Preparing relationships CSV with userId...`);
    console.log(`[Worker ${workerId}] 📝 Modified ${relationsLines.length - 1} relation records with userId: ${userId}`);

    const disableTriggersSQL = skipTriggerManagement ? '' : `\nALTER TABLE ${relationTableName} DISABLE TRIGGER ALL;\n`;
    const enableTriggersSQL = skipTriggerManagement ? '' : `\nALTER TABLE ${relationTableName} ENABLE TRIGGER ALL;\n`;
    
    const relationsImportSql = `
BEGIN;

SET statement_timeout TO '${timeoutValue}s';
SET synchronous_commit TO OFF;
${disableTriggersSQL}
COPY ${relationTableName} (source_id, node_id) FROM STDIN WITH (FORMAT csv, HEADER true);
${enableTriggersSQL}
COMMIT;
`;

    console.log(`[Worker ${workerId}] 🚀 Step 2: Importing relationships into ${relationTableName}...`);
    console.log(`[Worker ${workerId}] 🔍 Sending ${relationsContent.length} bytes to PostgreSQL...`);
    const relationResult = await executePostgresCommandWithStdin(relationsImportSql, relationsContent, workerId, timeoutValue * 1000);
    if (!relationResult.success) {
      throw new Error(`Relationships import failed: ${relationResult.error}`);
    }

    const executionTime = Date.now() - startTime;
    console.log(`[Worker ${workerId}] 🎉 Bulk import completed for ${dataType} | Nodes: ${dataCount} | Relations: ${relationsCount} | Time: ${executionTime}ms`);
    
    return { success: true, processed: relationsCount };
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.log(`[Worker ${workerId}] ❌ Bulk import failed for ${dataType} | Time: ${executionTime}ms | Error: ${error}`);
    return { success: false, processed: 0, error: String(error) };
  }
}

export async function executePostgresCommandWithStdin(
  sql: string, 
  stdinData: string, 
  workerId: string, 
  timeoutMs: number = 120000
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const env = {
      PGHOST: process.env.POSTGRES_HOST || 'localhost',
      PGPORT: process.env.POSTGRES_PORT || '5432',
      PGDATABASE: process.env.POSTGRES_DB || 'postgres',
      PGUSER: process.env.POSTGRES_USER || 'postgres',
      PGPASSWORD: process.env.POSTGRES_PASSWORD || 'postgres'
    };

    console.log(`[Worker ${workerId}] 🕒 Using timeout: ${timeoutMs}ms (${Math.round(timeoutMs/1000)}s)`);
    const psqlProcess = spawn('psql', ['-c', sql], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;
    let writeError: Error | null = null;

    // Timeout de sécurité
    const timeout = setTimeout(() => {
      if (!resolved) {
        console.log(`[Worker ${workerId}] ⏰ psql command timeout after ${timeoutMs}ms`);
        psqlProcess.kill('SIGTERM');
        resolved = true;
        resolve({ success: false, error: 'Command timeout' });
      }
    }, timeoutMs);

    psqlProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    psqlProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Gestion des erreurs d'écriture (EPIPE)
    psqlProcess.stdin.on('error', (error) => {
      console.log(`[Worker ${workerId}] ❌ stdin write error:`, error.message);
      writeError = error;
    });

    // Écriture des données avec gestion d'erreur
    try {
      if (!psqlProcess.killed) {
        psqlProcess.stdin.write(stdinData);
        psqlProcess.stdin.end();
      }
    } catch (error) {
      console.log(`[Worker ${workerId}] ❌ Error writing to stdin:`, error);
      writeError = error as Error;
    }

    psqlProcess.on('close', (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);

      if (writeError) {
        console.log(`[Worker ${workerId}] ❌ psql failed due to write error: ${writeError.message}`);
        resolve({ success: false, error: `Write error: ${writeError.message}` });
        return;
      }

      if (code === 0) {
        console.log(`[Worker ${workerId}] ✅ psql command executed successfully`);
        resolve({ success: true });
      } else {
        console.log(`[Worker ${workerId}] ❌ psql command failed with code ${code}`);
        console.log(`[Worker ${workerId}] stderr:`, stderr);
        console.log(`[Worker ${workerId}] stdout:`, stdout);
        resolve({ success: false, error: stderr || `Process exited with code ${code}` });
      }
    });

    psqlProcess.on('error', (error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      console.log(`[Worker ${workerId}] ❌ psql process error:`, error);
      resolve({ success: false, error: error.message });
    });
  });
}

export async function preloadNodesOnce(
  nodesCSVContent: string,
  workerId: string
): Promise<{ success: boolean; processed: number; error?: string }> {
  const lines = nodesCSVContent.trim().split('\n');
  const header = lines[0] || 'twitter_id';
  const ids = lines.slice(1);
  const total = ids.length;
  const chunkSize = 100_000; // process in ~100k rows per transaction
  const totalChunks = Math.max(1, Math.ceil(total / chunkSize));
  let processed = 0;

  console.log(`[Worker ${workerId}] 🔧 Preloading nodes once | Unique candidates: ~${total} | chunks=${totalChunks} (size=${chunkSize})`);

  for (let i = 0; i < total; i += chunkSize) {
    const end = Math.min(i + chunkSize, total);
    const chunk = ids.slice(i, end);
    const chunkCount = chunk.length;
    if (chunkCount === 0) continue;

    const baseTimeout = 180; // per-chunk
    const scalingFactor = 5;
    const maxTimeout = 1800; // 30min hard cap per chunk
    const timeoutValue = Math.max(baseTimeout, Math.min(maxTimeout, baseTimeout + Math.floor(chunkCount / 1000) * scalingFactor));

    const nodesTempTable = `temp_nodes_${Date.now()}_${i}`;
    const sql = `
BEGIN;
SET statement_timeout TO '${timeoutValue}s';
SET synchronous_commit TO OFF;
CREATE TEMP TABLE ${nodesTempTable} (twitter_id BIGINT);
COPY ${nodesTempTable} FROM STDIN WITH (FORMAT csv, HEADER true);
INSERT INTO nodes (twitter_id)
SELECT twitter_id FROM ${nodesTempTable}
ORDER BY twitter_id
ON CONFLICT (twitter_id) DO NOTHING;
DROP TABLE ${nodesTempTable};
COMMIT;
`;

    const chunkCSV = `${header}\n${chunk.join('\n')}`;
    const chunkIndex = Math.floor(i / chunkSize) + 1;
    console.log(`[Worker ${workerId}] 🔧 Preload chunk ${chunkIndex}/${totalChunks} | rows=${chunkCount} | timeout=${timeoutValue}s`);
    const res = await executePostgresCommandWithStdin(sql, chunkCSV, workerId, timeoutValue * 1000);
    if (!res.success) {
      return { success: false, processed, error: `Chunk ${chunkIndex}/${totalChunks} failed: ${res.error}` };
    }
    processed += chunkCount;
  }

  return { success: true, processed };
}
