import { queryPublic } from '../../database'
import logger from '../../log_utils'

export type PythonTaskRow = {
  id: string
  user_id: string
  task_type: string
  platform: 'bluesky' | 'mastodon'
  payload: any
  created_at: string
  updated_at: string
  status: 'pending' | 'waiting' | 'processing' | 'completed' | 'failed'
}

function normalizePayload(payload: any): any {
  if (!payload) return null
  if (typeof payload === 'string') {
    try { return JSON.parse(payload) } catch { return null }
  }
  return payload
}

export const pgPythonTasksRepository = {
  async getRecentlyActivatedPendingTasks(
    userId: string,
    platform: 'bluesky' | 'mastodon',
    sinceIso: string,
    taskType: string
  ): Promise<PythonTaskRow[]> {
    try {
      const res = await queryPublic<PythonTaskRow>(
        `SELECT id, user_id, task_type, platform, payload, created_at, updated_at, status
         FROM python_tasks
         WHERE user_id = $1
           AND platform = $2
           AND status = 'pending'
           AND task_type = $3
           AND updated_at >= $4
         ORDER BY updated_at DESC`,
        [userId, platform, taskType, sinceIso]
      )
      return res.rows.map((r: PythonTaskRow) => ({ ...r, payload: normalizePayload((r as any).payload) }))
    } catch (error) {
      logger.logError('Repository', 'pgPythonTasksRepository.getRecentlyActivatedPendingTasks', 'Error fetching tasks', userId, { platform, taskType, sinceIso, error })
      throw error
    }
  },

  async getTasksForDayStatuses(
    statuses: Array<'pending' | 'waiting' | 'processing' | 'completed' | 'failed'>,
    dayIsoYYYYMMDD: string
  ): Promise<PythonTaskRow[]> {
    const start = `${dayIsoYYYYMMDD}T00:00:00Z`
    // next day
    const startDate = new Date(`${dayIsoYYYYMMDD}T00:00:00Z`)
    const nextDay = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
    const end = `${nextDay.toISOString().split('T')[0]}T00:00:00Z`

    try {
      const res = await queryPublic<PythonTaskRow>(
        `SELECT id, user_id, task_type, platform, payload, created_at, updated_at, status
         FROM python_tasks
         WHERE status = ANY($1)
           AND created_at >= $2
           AND created_at < $3`,
        [statuses, start, end]
      )
      return res.rows.map((r: PythonTaskRow) => ({ ...r, payload: normalizePayload((r as any).payload) }))
    } catch (error) {
      logger.logError('Repository', 'pgPythonTasksRepository.getTasksForDayStatuses', 'Error fetching daily tasks', undefined, { statuses, dayIsoYYYYMMDD, error })
      throw error
    }
  },

  async pendingTaskExists(
    userId: string,
    platform: 'bluesky' | 'mastodon',
    taskType: string
  ): Promise<boolean> {
    try {
      const res = await queryPublic<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM python_tasks 
           WHERE user_id = $1 AND platform = $2 AND task_type = $3 AND status = 'pending'
         ) as exists`,
        [userId, platform, taskType]
      )
      return !!res.rows[0]?.exists
    } catch (error) {
      logger.logError('Repository', 'pgPythonTasksRepository.pendingTaskExists', 'Error checking pending task', userId, { platform, taskType, error })
      throw error
    }
  },

  async createPendingTask(
    userId: string,
    platform: 'bluesky' | 'mastodon',
    taskType: string,
    payload: any
  ): Promise<string> {
    try {
      const res = await queryPublic<{ id: string }>(
        `INSERT INTO python_tasks (user_id, status, task_type, platform, payload)
         VALUES ($1, 'pending', $2, $3, $4::jsonb)
         RETURNING id`,
        [userId, taskType, platform, JSON.stringify(payload)]
      )
      return res.rows[0].id
    } catch (error) {
      logger.logError('Repository', 'pgPythonTasksRepository.createPendingTask', 'Error creating pending task', userId, { platform, taskType, error })
      throw error
    }
  },

  async waitingTaskExists(
    userId: string,
    platform: 'bluesky' | 'mastodon',
    taskType: string
  ): Promise<boolean> {
    try {
      const res = await queryPublic<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM python_tasks 
           WHERE user_id = $1 AND platform = $2 AND task_type = $3 AND status = 'waiting'
         ) as exists`,
        [userId, platform, taskType]
      )
      return !!res.rows[0]?.exists
    } catch (error) {
      logger.logError('Repository', 'pgPythonTasksRepository.waitingTaskExists', 'Error checking waiting task', userId, { platform, taskType, error })
      throw error
    }
  },

  async createWaitingTask(
    userId: string,
    platform: 'bluesky' | 'mastodon',
    taskType: string
  ): Promise<string> {
    try {
      const res = await queryPublic<{ id: string }>(
        `INSERT INTO python_tasks (user_id, status, task_type, platform)
         VALUES ($1, 'waiting', $2, $3)
         RETURNING id`,
        [userId, taskType, platform]
      )
      return res.rows[0].id
    } catch (error) {
      logger.logError('Repository', 'pgPythonTasksRepository.createWaitingTask', 'Error creating waiting task', userId, { platform, taskType, error })
      throw error
    }
  },

  async deleteTasks(
    userId: string,
    platform: 'bluesky' | 'mastodon',
    statuses: Array<'pending' | 'waiting' | 'processing' | 'completed' | 'failed'>
  ): Promise<void> {
    try {
      await queryPublic(
        `DELETE FROM python_tasks WHERE user_id = $1 AND platform = $2 AND status = ANY($3)`,
        [userId, platform, statuses]
      )
    } catch (error) {
      logger.logError('Repository', 'pgPythonTasksRepository.deleteTasks', 'Error deleting tasks', userId, { platform, statuses, error })
      throw error
    }
  },
}
