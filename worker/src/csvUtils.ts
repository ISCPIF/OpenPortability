import { spawn } from 'child_process';
import { logEvent } from './log_utils';

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

export async function convertToRelationsCSV(
  data: any[],
  userId: string,
  dataType: 'followers' | 'targets',
  workerId: string
): Promise<{ relationsContent: string; count: number }> {
  try {
    const isFollowers = dataType === 'followers';
    const itemKey = isFollowers ? 'follower' : 'following';

    // Sort by twitter_id for consistent COPY performance
    const sortedData = data.sort((a, b) => {
      const idA = parseInt(a[itemKey].accountId);
      const idB = parseInt(b[itemKey].accountId);
      return idA - idB;
    });

    const relationsRows = sortedData
      .map(item => {
        const twitterId = item[itemKey].accountId;
        return `"${userId}","${twitterId}"`;
      })
      .join('\n');

    const relationsHeader = 'source_id,node_id';
    const relationsContent = `${relationsHeader}\n${relationsRows}`;

    console.log(`[Worker ${workerId}] ✅ Relations CSV created (sorted): ${sortedData.length} rows`);

    return { relationsContent, count: sortedData.length };
  } catch (error) {
    console.log(`[Worker ${workerId}] ❌ Error creating relations CSV:`, error);
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
        logEvent('psql_error', { userId, workerId, dataType }, { attempt, maxRetries, reason: result.error, retryable: false });
        return result;
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`[Worker ${workerId}] 🔄 Retry attempt ${attempt}/${maxRetries} after ${delayMs}ms delay`);
      logEvent('retry', { userId, workerId, dataType }, { attempt, maxRetries, delayMs, reason: result.error });
      await new Promise(resolve => setTimeout(resolve, delayMs));

    } catch (error) {
      console.log(`[Worker ${workerId}] ❌ Unexpected error in retry attempt ${attempt}:`, error);
      logEvent('psql_error', { userId, workerId, dataType }, { attempt, maxRetries, reason: String(error), retryable: true });
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

  // Parse to get counts (skip nodes when preloaded once per job)
  const relationsLines = relationsContent.trim().split('\n');
  const relationsCount = Math.max(0, relationsLines.length - 1);
  const dataCount = skipNodesImport ? 0 : Math.max(0, dataContent.trim().split('\n').length - 1);

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
        logEvent('psql_error', { userId, workerId, dataType }, { phase: 'nodes_import', error: nodesResult.error, timeoutSec: timeoutValue });
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
    //moins de ram pcq pas operation de tri / hash only du copy

    const relationsImportSql = `
BEGIN;

SET LOCAL statement_timeout TO '${timeoutValue}s';
SET LOCAL synchronous_commit TO OFF;
SET LOCAL work_mem = '128MB';

${disableTriggersSQL}
COPY ${relationTableName} (source_id, node_id) FROM STDIN WITH (FORMAT csv, HEADER true);
${enableTriggersSQL}
COMMIT;
`;

    console.log(`[Worker ${workerId}] 🚀 Step 2: Importing relationships into ${relationTableName}...`);
    console.log(`[Worker ${workerId}] 🔍 Sending ${relationsContent.length} bytes to PostgreSQL...`);
    const relationResult = await executePostgresCommandWithStdin(relationsImportSql, relationsContent, workerId, timeoutValue * 1000);
    if (!relationResult.success) {
      logEvent('psql_error', { userId, workerId, dataType }, { phase: 'relations_import', table: relationTableName, error: relationResult.error, timeoutSec: timeoutValue });
      throw new Error(`Relationships import failed: ${relationResult.error}`);
    }

    const executionTime = Date.now() - startTime;
    console.log(`[Worker ${workerId}] 🎉 Bulk import completed for ${dataType} | Nodes: ${dataCount} | Relations: ${relationsCount} | Time: ${executionTime}ms`);

    return { success: true, processed: relationsCount };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.log(`[Worker ${workerId}] ❌ Bulk import failed for ${dataType} | Time: ${executionTime}ms | Error: ${error}`);
    logEvent('psql_error', { userId, workerId, dataType }, { phase: 'attempt', error: String(error), durationMs: executionTime });
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
      PGHOST: 'postgres-db',  // Nom du container PostgreSQL (direct, pas pgbouncer)
      PGPORT: '5432',  // Port interne du container PostgreSQL
      PGDATABASE: 'nexus',
      PGUSER: process.env.POSTGRES_USER || 'postgres',
      PGPASSWORD: process.env.POSTGRES_PASSWORD || 'mysecretpassword'
    };

    console.log("ENV of the worker -->", env)

    console.log(`[Worker ${workerId}] 🕒 Using timeout: ${timeoutMs}ms (${Math.round(timeoutMs/1000)}s)`);
    const psqlProcess = spawn('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-c', sql], {
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
        const needsStdin = /COPY\s+[\s\S]*FROM\s+STDIN/i.test(sql);
        if (needsStdin) {
          psqlProcess.stdin.write(stdinData);
        }
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
        const stderrTrimmed = (stderr || '').trim();
        console.log(`[Worker ${workerId}] ❌ psql failed due to write error: ${writeError.message}`);
        if (stderrTrimmed) {
          console.log(`[Worker ${workerId}] 🔎 psql stderr (on EPIPE): ${stderrTrimmed}`);
        }
        resolve({ success: false, error: `Write error: ${writeError.message}${stderrTrimmed ? ` | psql: ${stderrTrimmed}` : ''}` });
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
  workerId: string,
  onProgress?: (processed: number, total: number) => Promise<void>
): Promise<{ success: boolean; processed: number; error?: string }> {
  const lines = nodesCSVContent.trim().split('\n');
  const header = 'twitter_id';

  const rawIds: bigint[] = [];
  let invalidLines = 0;
  for (const line of lines.slice(1)) {
    const cleaned = line
      .trim()
      .replace(/^"+|"+$/g, '')
      .replace(/,$/, '');
    if (!cleaned) continue;
    if (!/^-?\d+$/.test(cleaned)) {
      invalidLines += 1;
      if (invalidLines <= 5) {
        console.log(`[Worker ${workerId}] ⚠️ preloadNodesOnce: invalid twitter_id line skipped: ${JSON.stringify(line)}`);
      }
      continue;
    }
    rawIds.push(BigInt(cleaned));
  }
  if (invalidLines > 0) {
    console.log(`[Worker ${workerId}] ⚠️ preloadNodesOnce: skipped ${invalidLines} invalid twitter_id lines`);
  }

  // 1. Dédupliquer
  const uniqueIds = [...new Set(rawIds)];

  // 2. 🔥 GROUPER PAR PARTITION
  const partitions: Map<number, bigint[]> = new Map();
  for (let i = 0; i < 8; i++) {
    partitions.set(i, []);
  }

  for (const id of uniqueIds) {
    const partition = Number(id % 8n);
    partitions.get(partition)!.push(id);
  }

  for (const [, partitionIds] of partitions) {
    partitionIds.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  console.log(`[Worker ${workerId}] 🔧 Grouped into partitions:`);
  for (const [partNum, ids] of partitions) {
    console.log(`  Partition ${partNum}: ${ids.length} IDs`);
  }

  let processed = 0;
  const total = uniqueIds.length;

  // 3. 🔥 INSÉRER PARTITION PAR PARTITION
  for (const [partNum, partitionIds] of partitions) {
    if (partitionIds.length === 0) continue;

    const chunkSize = 10_000;
    const partitionChunks = Math.ceil(partitionIds.length / chunkSize);

    for (let i = 0; i < partitionIds.length; i += chunkSize) {
      const chunk = partitionIds.slice(i, i + chunkSize);

      const timeoutValue = 300;
      const nodesTempTable = `temp_nodes_p${partNum}_${Date.now()}_${i}`;

      const sql = `
BEGIN;
SET LOCAL statement_timeout TO '${timeoutValue}s';
SET LOCAL synchronous_commit TO OFF;
SET LOCAL work_mem = '256MB';

CREATE TEMP TABLE ${nodesTempTable} (twitter_id BIGINT) ON COMMIT DROP;
COPY ${nodesTempTable} FROM STDIN WITH (FORMAT csv, HEADER true);

INSERT INTO nodes (twitter_id)
SELECT twitter_id FROM ${nodesTempTable}
ON CONFLICT (twitter_id) DO NOTHING;

COMMIT;
`;

      const chunkCSV = `${header}\n${chunk.join('\n')}`;
      const chunkIndex = Math.floor(i / chunkSize) + 1;

      const startTime = Date.now();
      console.log(`[Worker ${workerId}] 🚀 Partition ${partNum} | Chunk ${chunkIndex}/${partitionChunks} | rows=${chunk.length}`);

      const res = await executePostgresCommandWithStdin(sql, chunkCSV, workerId, timeoutValue * 1000);

      const duration = Date.now() - startTime;

      if (!res.success) {
        return { success: false, processed, error: `P${partNum} Chunk ${chunkIndex} failed: ${res.error}` };
      }

      console.log(`[Worker ${workerId}] ✅ P${partNum} Chunk ${chunkIndex} done in ${duration}ms (~${Math.round(chunk.length / (duration / 1000))}/sec)`);

      processed += chunk.length;
      if (onProgress) await onProgress(processed, total);
    }
  }

  return { success: true, processed };
}