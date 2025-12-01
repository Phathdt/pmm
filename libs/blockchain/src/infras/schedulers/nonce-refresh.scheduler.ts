import { Inject, Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'

import { INonceManagerService } from '../../domain'
import { NONCE_MANAGER_SERVICE } from '../di'

/**
 * Scheduler service for refreshing nonce managers periodically
 * Helps prevent stale nonce issues by refreshing cached nonces
 */
@Injectable()
export class NonceRefreshScheduler {
  private readonly logger: EnhancedLogger

  constructor(
    @Inject(NONCE_MANAGER_SERVICE) private readonly nonceManagerService: INonceManagerService,
    logger: EnhancedLogger
  ) {
    this.logger = logger.with({ context: NonceRefreshScheduler.name })
  }

  /**
   * Refresh nonces
   * Can be configured via NONCE_REFRESH_ENABLED environment variable
   */
  @Cron('* * * * *')
  async handleNonceRefresh(): Promise<void> {
    try {
      this.logger.log({
        message: 'Starting scheduled nonce refresh',
        operation: 'nonce_refresh_scheduler',
        status: 'starting',
        timestamp: new Date().toISOString(),
      })
      await this.nonceManagerService.refreshAllNonces()
      this.logger.log({
        message: 'Completed scheduled nonce refresh',
        operation: 'nonce_refresh_scheduler',
        status: 'completed',
        timestamp: new Date().toISOString(),
      })
    } catch (error: unknown) {
      this.logger.error({
        message: 'Failed to refresh nonces during scheduled job',
        error: error instanceof Error ? error.message : String(error),
        operation: 'nonce_refresh_scheduler',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })
    }
  }
}
