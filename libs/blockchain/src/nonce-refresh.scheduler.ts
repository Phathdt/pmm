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
      this.logger.log('Starting scheduled nonce refresh...')
      await this.nonceManagerService.refreshAllNonces()
      this.logger.log('Completed scheduled nonce refresh')
    } catch (error) {
      this.logger.error('Failed to refresh nonces during scheduled job:', error)
    }
  }
}
