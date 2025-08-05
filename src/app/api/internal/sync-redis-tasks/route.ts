import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';

/**
 * Endpoint pour synchroniser les tâches python_tasks vers Redis
 * À appeler quotidiennement via cron job
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [sync-redis-tasks] Starting daily sync...');

    console.log("sync-redis-tasks request --->", request )

    console.log('🧹 Cleaning existing Redis queues...');
    const existingKeys = await redis.keys('consent_tasks:*');
    if (existingKeys.length > 0) {
      for (const key of existingKeys) {
        await redis.del(key);
      }
      console.log(`🗑️ Deleted ${existingKeys.length} existing queues`);
    }
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const queueKey = `consent_tasks:${today}`;
    
    // 1. Récupérer toutes les tâches pending/waiting du jour
    const { data: tasks, error } = await supabase
      .from('python_tasks')
      .select('id, user_id, task_type, platform, payload, created_at, status')
      .in('status', ['pending', 'waiting'])
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}T00:00:00Z`);
    
    if (error) {
      console.error('❌ [sync-redis-tasks] DB error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    
    if (!tasks || tasks.length === 0) {
      console.log('✅ [sync-redis-tasks] No tasks to sync');
      return NextResponse.json({ 
        success: true, 
        message: 'No tasks to sync',
        synced: 0 
      });
    }
    
    // 2. Vérifier quelles tâches sont déjà dans Redis
    const existingTasksInRedis = await redis.lrange(queueKey, 0, -1);
    const existingTaskIds = new Set(
      existingTasksInRedis.map(taskJson => {
        try {
          return JSON.parse(taskJson).id;
        } catch {
          return null;
        }
      }).filter(Boolean)
    );
    
    // 3. Ajouter les tâches manquantes à Redis
    let syncedCount = 0;
    
    for (const task of tasks) {
      // Skip si déjà dans Redis
      if (existingTaskIds.has(task.id)) {
        continue;
      }
      
      // Construire le handle depuis le payload
      const handle = task.payload?.handle || 'unknown';
      
      const taskData = {
        id: task.id,
        user_id: task.user_id,
        task_type: task.task_type,
        platform: task.platform,
        handle: handle,
        created_at: task.created_at,
        status: task.status
      };
      
      // Ajouter à la queue Redis
      await redis.lpush(queueKey, JSON.stringify(taskData));
      
      // Ajouter clé de déduplication (expire dans 24h)
      const dedupKey = `task_dedup:${task.user_id}:${task.platform}:${task.task_type}`;
      await redis.setex(dedupKey, 86400, JSON.stringify(taskData)); // 24h
      
      syncedCount++;
    }
    
    console.log(`✅ [sync-redis-tasks] Synced ${syncedCount}/${tasks.length} tasks to Redis`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Synced ${syncedCount} tasks`,
      synced: syncedCount,
      total: tasks.length
    });
    
  } catch (error) {
    console.error('❌ [sync-redis-tasks] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync tasks' },
      { status: 500 }
    );
  }
}

/**
 * GET pour vérifier le statut de la sync
 */
export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const queueKey = `consent_tasks:${today}`;
    
    // Compter les tâches dans Redis
    const redisCount = await redis.llen(queueKey);
    
    // Compter les tâches dans DB
    const { count: dbCount } = await supabase
      .from('python_tasks')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'waiting'])
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}T00:00:00Z`);
    
    return NextResponse.json({
      date: today,
      redis_tasks: redisCount,
      db_tasks: dbCount || 0,
      in_sync: redisCount === (dbCount || 0)
    });
    
  } catch (error) {
    console.error('❌ [sync-redis-tasks] Status error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
