import { type EnhancedLogger } from '@optimex-pmm/custom-logger'

import { type Job } from 'bull'
import { ClsServiceManager } from 'nestjs-cls'
import { v7 as uuidv7 } from 'uuid'

/**
 * Base processor class that provides common functionality for all Bull queue processors
 * Handles traceId management and provides utility methods
 */
export abstract class BaseProcessor {
  protected abstract readonly logger: EnhancedLogger

  /**
   * Wraps job processing with traceId context
   * Automatically generates and sets traceId in CLS for the job execution
   *
   * @param job - The Bull job to process
   * @param handler - The actual processing logic
   * @returns The result from the handler
   *
   * @example
   * ```typescript
   * @Process('my-job')
   * async processMyJob(job: Job<MyData>) {
   *   return this.executeWithTraceId(job, async (job) => {
   *     // Your processing logic here
   *     this.logger.info('Processing job', { data: job.data })
   *     return { success: true }
   *   })
   * }
   * ```
   */
  protected async executeWithTraceId<T, R = unknown>(job: Job<T>, handler: (job: Job<T>) => Promise<R>): Promise<R> {
    try {
      // Generate traceId for this job execution
      const traceId = `job-${job.id}-${uuidv7()}`

      // Get CLS instance from global manager
      const cls = ClsServiceManager.getClsService()

      // Run processor in CLS context
      return await cls.run(async () => {
        cls.set('traceId', traceId)

        this.logger.with({ traceId, jobId: job.id }).debug('Starting job processing')

        const result = await handler(job)

        this.logger.with({ traceId, jobId: job.id }).debug('Completed job processing')

        return result
      })
    } catch (error) {
      this.logger.error(error as Error, `Failed to execute job ${job.id}`)
      throw error
    }
  }

  /**
   * Executes a job without traceId wrapper (for processors that don't need CLS)
   * Useful for simple processors or when traceId is not required
   */
  protected async executeJob<T, R = unknown>(job: Job<T>, handler: (job: Job<T>) => Promise<R>): Promise<R> {
    try {
      this.logger.with({ jobId: job.id }).debug('Starting job processing')

      const result = await handler(job)

      this.logger.with({ jobId: job.id }).debug('Completed job processing')

      return result
    } catch (error) {
      this.logger.error(error as Error, `Failed to execute job ${job.id}`)
      throw error
    }
  }
}
