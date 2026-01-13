import { type EnhancedLogger } from '@optimex-pmm/custom-logger'

import { type Job } from 'bullmq'
import { ClsServiceManager } from 'nestjs-cls'
import { v7 as uuidv7 } from 'uuid'

/**
 * Helper for BullMQ processors to add traceId support.
 * Uses composition pattern since processors must extend WorkerHost.
 */
export class ProcessorHelper {
  constructor(private readonly logger: EnhancedLogger) {}

  /**
   * Execute job handler with traceId context.
   * Re-throws errors for queue retry handling.
   */
  async executeWithTraceId<T, R = unknown>(job: Job<T>, handler: (job: Job<T>) => Promise<R>): Promise<R> {
    const traceId = `job-${job.id}-${uuidv7()}`
    const cls = ClsServiceManager.getClsService()

    return cls.run(async () => {
      cls.set('traceId', traceId)
      this.logger.with({ traceId, jobId: job.id }).debug('Starting job processing')
      try {
        const result = await handler(job)
        this.logger.with({ traceId, jobId: job.id }).debug('Completed job processing')
        return result
      } catch (error) {
        this.logger.error(
          {
            err: error,
            jobId: job.id,
            jobName: job.name,
            queueName: job.queueName,
          },
          `Job ${job.id} failed`
        )
        throw error // Re-throw for queue retry
      }
    })
  }
}
