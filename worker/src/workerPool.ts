import { convertTwitterDataToCSV, importCSVViaPsql } from './csvUtils';

interface ChunkTask {
  data: any[];
  userId: string;
  dataType: 'followers' | 'targets';
  chunkIndex: number;
  workerId: string;
}

export interface WorkerPoolResult {
  success: boolean;
  processed: number;
  chunkIndex: number;
  error?: string;
  duration: number;
}

export class WorkerPool {
  private maxConcurrency: number;
  private activeWorkers: number = 0;
  private taskQueue: ChunkTask[] = [];
  private results: WorkerPoolResult[] = [];
  private onTaskComplete?: (result: WorkerPoolResult) => void;
  private onAllComplete?: (results: WorkerPoolResult[]) => void;
  private isShutdown: boolean = false;

  constructor(maxConcurrency: number = 3) {
    this.maxConcurrency = maxConcurrency;
  }

  // Add a task to the queue
  addTask(task: ChunkTask): void {
    if (this.isShutdown) {
      throw new Error('WorkerPool is shutdown, cannot add new tasks');
    }
    
    this.taskQueue.push(task);
    this.processNextTask();
  }

  // Add multiple tasks at once
  addTasks(tasks: ChunkTask[]): void {
    tasks.forEach(task => this.addTask(task));
  }

  // Set callback for when a task completes
  onTaskCompleted(callback: (result: WorkerPoolResult) => void): void {
    this.onTaskComplete = callback;
  }

  // Set callback for when all tasks are complete
  onAllCompleted(callback: (results: WorkerPoolResult[]) => void): void {
    this.onAllComplete = callback;
  }

  // Process the next task if workers are available
  private processNextTask(): void {
    if (this.activeWorkers >= this.maxConcurrency || this.taskQueue.length === 0) {
      return;
    }

    const task = this.taskQueue.shift();
    if (!task) return;

    this.activeWorkers++;
    this.executeTask(task);
  }

  // Execute a single task
  private async executeTask(task: ChunkTask): Promise<void> {
    const startTime = Date.now();
    const workerName = `${task.workerId}-${task.dataType.charAt(0).toUpperCase()}${task.chunkIndex}`;
    
    try {
      console.log(`[Worker ${workerName}] 🚀 Starting chunk ${task.chunkIndex + 1} (${task.data.length} records)`);
      
      // Convert to CSV
      const { dataContent, relationsContent } = await convertTwitterDataToCSV(
        task.data, 
        task.userId, 
        task.dataType, 
        workerName
      );
      
      // Import via psql COPY
      const result = await importCSVViaPsql(
        dataContent, 
        relationsContent, 
        task.dataType, 
        task.userId, 
        workerName, 
        true, // skipTriggerManagement=true
        true,  // skipNodesImport=true (nodes preloaded once per job)
        // true
      );
      
      const duration = Date.now() - startTime;
      const workerResult: WorkerPoolResult = {
        success: result.success,
        processed: result.processed,
        chunkIndex: task.chunkIndex,
        duration,
        error: result.error
      };

      if (result.success) {
        console.log(`[Worker ${workerName}] ✅ Chunk ${task.chunkIndex + 1} completed | Processed: ${result.processed} | Time: ${duration}ms`);
      } else {
        console.log(`[Worker ${workerName}] ❌ Chunk ${task.chunkIndex + 1} failed | Error: ${result.error} | Time: ${duration}ms`);
      }

      this.results.push(workerResult);
      
      // Call task completion callback
      if (this.onTaskComplete) {
        this.onTaskComplete(workerResult);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      const workerResult: WorkerPoolResult = {
        success: false,
        processed: 0,
        chunkIndex: task.chunkIndex,
        duration,
        error: String(error)
      };

      console.log(`[Worker ${workerName}] ❌ Chunk ${task.chunkIndex + 1} failed with exception | Error: ${error} | Time: ${duration}ms`);
      this.results.push(workerResult);
      
      if (this.onTaskComplete) {
        this.onTaskComplete(workerResult);
      }
    } finally {
      this.activeWorkers--;
      
      // Check if all tasks are complete
      if (this.activeWorkers === 0 && this.taskQueue.length === 0) {
        if (this.onAllComplete) {
          this.onAllComplete(this.results);
        }
      } else {
        // Process next task if available
        this.processNextTask();
      }
    }
  }

  // Wait for all tasks to complete
  async waitForCompletion(): Promise<WorkerPoolResult[]> {
    return new Promise((resolve) => {
      if (this.activeWorkers === 0 && this.taskQueue.length === 0) {
        resolve(this.results);
        return;
      }

      this.onAllCompleted((results) => {
        resolve(results);
      });
    });
  }

  // Get current status
  getStatus(): {
    activeWorkers: number;
    queuedTasks: number;
    completedTasks: number;
    totalTasks: number;
  } {
    return {
      activeWorkers: this.activeWorkers,
      queuedTasks: this.taskQueue.length,
      completedTasks: this.results.length,
      totalTasks: this.results.length + this.taskQueue.length + this.activeWorkers
    };
  }

  // Shutdown the pool (no new tasks accepted)
  shutdown(): void {
    this.isShutdown = true;
  }

  // Get results summary
  getResultsSummary(): {
    totalProcessed: number;
    successfulChunks: number;
    failedChunks: number;
    totalDuration: number;
    averageChunkTime: number;
    errors: string[];
  } {
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const totalProcessed = successful.reduce((sum, r) => sum + r.processed, 0);
    const totalDuration = Math.max(...this.results.map(r => r.duration));
    const averageChunkTime = this.results.length > 0 
      ? this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length 
      : 0;

    return {
      totalProcessed,
      successfulChunks: successful.length,
      failedChunks: failed.length,
      totalDuration,
      averageChunkTime,
      errors: failed.map(r => r.error || 'Unknown error')
    };
  }
}
