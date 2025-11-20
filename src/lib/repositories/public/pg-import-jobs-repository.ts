import { queryPublic } from '../../database'
import logger from '../../log_utils'

export type ImportJobRow = {
  id: string
  user_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  total_items: number | null
  error_log: string | null
  job_type: 'large_file_import' | 'direct_import'
  file_paths: string[] | null
  stats: any | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

export type CreateImportJobInput = {
  userId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  totalItems?: number
  jobType: 'large_file_import' | 'direct_import'
  filePaths?: string[]
  stats?: any
}

function normalizeStats(stats: any): any {
  if (!stats) return null
  if (typeof stats === 'string') {
    try { return JSON.parse(stats) } catch { return null }
  }
  return stats
}

export const pgImportJobsRepository = {
  async hasActiveJob(userId: string): Promise<boolean> {
    try {
      const res = await queryPublic<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM import_jobs 
           WHERE user_id = $1 AND status IN ('pending','processing')
         ) as exists`,
        [userId]
      )
      return !!res.rows[0]?.exists
    } catch (error) {
      logger.logError('Repository', 'pgImportJobsRepository.hasActiveJob', 'Error checking active job', userId, { error })
      throw error
    }
  },

  async getJobForUser(jobId: string, userId: string): Promise<ImportJobRow | null> {
    try {
      const res = await queryPublic<ImportJobRow>(
        `SELECT id, user_id, status, total_items, error_log, job_type,
                file_paths, stats, created_at, updated_at, started_at, completed_at
         FROM import_jobs
         WHERE id = $1 AND user_id = $2
         LIMIT 1`,
        [jobId, userId]
      )
      const row = res.rows[0]
      if (!row) return null
      return { ...row, stats: normalizeStats(row.stats) }
    } catch (error) {
      logger.logError('Repository', 'pgImportJobsRepository.getJobForUser', 'Error fetching job', userId, { jobId, error })
      throw error
    }
  },

  async createJob(input: CreateImportJobInput): Promise<ImportJobRow> {
    const filePaths = input.filePaths ?? []
    const statsJson = input.stats ? JSON.stringify(input.stats) : null

    try {
      const res = await queryPublic<ImportJobRow>(
        `INSERT INTO import_jobs (user_id, status, total_items, job_type, file_paths, stats)
         VALUES ($1, $2, $3, $4, $5::text[], $6::jsonb)
         RETURNING id, user_id, status, total_items, error_log, job_type,
                   file_paths, stats, created_at, updated_at, started_at, completed_at`,
        [
          input.userId,
          input.status,
          input.totalItems ?? 0,
          input.jobType,
          filePaths,
          statsJson,
        ]
      )
      const row = res.rows[0]
      return { ...row, stats: normalizeStats(row.stats) }
    } catch (error) {
      logger.logError('Repository', 'pgImportJobsRepository.createJob', 'Error creating job', input.userId, { input: { ...input, stats: undefined }, error })
      throw error
    }
  },
}
