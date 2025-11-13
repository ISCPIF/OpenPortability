// worker/src/repositories/importJobsRepository.ts
import { queryPublic } from '../database'

export interface ImportJobRow {
  id: string
  user_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  total_items: number
  error_log: string | null
  job_type: 'large_file_import' | 'direct_import'
  file_paths: string[]
  stats: any
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

export const importJobsRepository = {
  /**
   * Récupère tous les jobs en statut pending
   */
  async getPendingJobs(): Promise<ImportJobRow[]> {
    try {
      const res = await queryPublic<ImportJobRow>(
        `SELECT id, user_id, status, total_items, error_log, job_type,
                file_paths, stats, created_at, updated_at, started_at, completed_at
         FROM import_jobs
         WHERE status = 'pending'
         ORDER BY created_at ASC`
      )
      return res.rows
    } catch (error) {
      console.log('ImportJobsRepository', 'getPendingJobs', 'Error fetching pending jobs', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  },

  /**
   * Met à jour le statut et les stats d'un job
   */
  async updateJobStatus(
    jobId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    stats?: any,
    errorLog?: string | null
  ): Promise<void> {
    try {
      const updateFields: string[] = ['status = $1', 'updated_at = $2']
      const params: any[] = [status, new Date().toISOString()]
      let paramIndex = 3

      if (stats !== undefined) {
        updateFields.push(`stats = $${paramIndex}::jsonb`)
        params.push(JSON.stringify(stats))
        paramIndex++
      }

      if (errorLog !== undefined) {
        updateFields.push(`error_log = $${paramIndex}`)
        params.push(errorLog)
        paramIndex++
      }

      params.push(jobId)

      await queryPublic(
        `UPDATE import_jobs 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}`,
        params
      )
    } catch (error) {
      console.log('ImportJobsRepository', 'updateJobStatus', 'Error updating job status', {
        jobId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  },

  /**
   * Met à jour la progression d'un job (stats uniquement)
   */
  async updateJobProgress(
    jobId: string,
    stats: any
  ): Promise<void> {
    try {
      await queryPublic(
        `UPDATE import_jobs 
         SET stats = $1::jsonb, updated_at = $2
         WHERE id = $3`,
        [JSON.stringify(stats), new Date().toISOString(), jobId]
      )
    } catch (error) {
      console.log('ImportJobsRepository', 'updateJobProgress', 'Error updating job progress', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }
}
