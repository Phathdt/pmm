import { type EnhancedLogger } from '@optimex-pmm/custom-logger'

import { ClsServiceManager } from 'nestjs-cls'
import { v7 as uuidv7 } from 'uuid'

/**
 * Base scheduler class that provides common functionality for all NestJS schedulers
 * Handles traceId management for cron jobs and scheduled tasks
 */
export abstract class BaseScheduler {
  protected abstract readonly logger: EnhancedLogger

  /**
   * Wraps scheduler execution with traceId context
   * Automatically generates and sets traceId in CLS for the scheduled task execution
   *
   * @param schedulerName - Name of the scheduler/cron job for identification
   * @param handler - The actual scheduler logic
   * @returns The result from the handler
   *
   * @example
   * ```typescript
   * @Cron('* * * * * *')
   * async checkForNewEvents() {
   *   return this.executeWithTraceId('checkForNewEvents', async () => {
   *     // Your scheduler logic here
   *     this.logger.log('Processing events')
   *   })
   * }
   * ```
   */
  protected async executeWithTraceId<R = unknown>(
    schedulerName: string,
    handler: () => Promise<R>
  ): Promise<R | undefined> {
    try {
      // Generate traceId for this scheduler execution
      const traceId = `sched-${schedulerName}-${uuidv7()}`

      // Get CLS instance from global manager
      const cls = ClsServiceManager.getClsService()

      // Run scheduler in CLS context
      return await cls.run(async () => {
        cls.set('traceId', traceId)

        this.logger.debug({
          message: 'Starting scheduler execution',
          schedulerName,
          operation: 'scheduler_start',
        })

        const result = await handler()

        this.logger.debug({
          message: 'Completed scheduler execution',
          schedulerName,
          operation: 'scheduler_complete',
        })

        return result
      })
    } catch (error) {
      this.logger.error({
        message: 'Failed to execute scheduler',
        schedulerName,
        error: error instanceof Error ? error.message : String(error),
        stack: (error as Error).stack,
        operation: 'scheduler_error',
      })
      // Don't throw - schedulers should be resilient and not crash the app
      return undefined
    }
  }

  /**
   * Executes a scheduler without traceId wrapper
   * Useful for simple schedulers or when traceId is not required
   */
  protected async executeScheduler<R = unknown>(
    schedulerName: string,
    handler: () => Promise<R>
  ): Promise<R | undefined> {
    try {
      this.logger.debug({
        message: 'Starting scheduler execution',
        schedulerName,
        operation: 'scheduler_start',
      })

      const result = await handler()

      this.logger.debug({
        message: 'Completed scheduler execution',
        schedulerName,
        operation: 'scheduler_complete',
      })

      return result
    } catch (error) {
      this.logger.error({
        message: 'Failed to execute scheduler',
        schedulerName,
        error: error instanceof Error ? error.message : String(error),
        stack: (error as Error).stack,
        operation: 'scheduler_error',
      })
      // Don't throw - schedulers should be resilient and not crash the app
      return undefined
    }
  }
}
