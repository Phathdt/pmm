import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'

import { NonceManagerService } from './nonce-manager.service'

/**
 * Scheduler service for refreshing nonce managers periodically
 * Helps prevent stale nonce issues by refreshing cached nonces
 */
@Injectable()
export class NonceRefreshScheduler {
  private readonly logger = new Logger(NonceRefreshScheduler.name)

  constructor(private readonly nonceManagerService: NonceManagerService) {}

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
