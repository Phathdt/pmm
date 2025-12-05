import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { INearService, NEAR_SERVICE, NearStatus } from '@optimex-pmm/near'
import { INotificationService, NOTIFICATION_SERVICE } from '@optimex-pmm/notification'
import { IRebalancingService, Rebalancing, REBALANCING_SERVICE, RebalancingStatus } from '@optimex-pmm/rebalance'
import { RebalanceNotification } from '@optimex-pmm/shared'

import { BaseScheduler } from './base.scheduler'

/**
 * Polls NEAR status for rebalancing records that are in DEPOSIT_SUBMITTED or SWAP_PROCESSING state.
 * Updates rebalancing status based on NEAR swap result.
 */
@Injectable()
export class RebalanceNearStatusScheduler extends BaseScheduler implements OnModuleInit {
  protected readonly logger: EnhancedLogger
  private readonly rebalanceEnabled: boolean

  constructor(
    @Inject(REBALANCING_SERVICE) private readonly rebalancingService: IRebalancingService,
    @Inject(NEAR_SERVICE) private readonly nearService: INearService,
    @Inject(NOTIFICATION_SERVICE) private readonly notificationService: INotificationService,
    private readonly configService: CustomConfigService,
    logger: EnhancedLogger
  ) {
    super()
    this.logger = logger.with({ context: RebalanceNearStatusScheduler.name })
    this.rebalanceEnabled = this.configService.rebalance.enabled
  }

  onModuleInit() {
    this.logger.log({
      message: 'RebalanceNearStatusScheduler initialized',
      rebalanceEnabled: this.rebalanceEnabled,
      operation: 'scheduler_init',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Polls NEAR status for processing rebalancing records every 30 seconds
   */
  @Cron('*/30 * * * * *')
  async pollNearStatus(): Promise<void> {
    if (!this.rebalanceEnabled) {
      return
    }

    return this.executeWithTraceId('pollNearStatus', async () => {
      // Find records that need status polling (DEPOSIT_SUBMITTED or SWAP_PROCESSING)
      const processingRecords = await this.rebalancingService.findByStatuses([
        RebalancingStatus.DEPOSIT_SUBMITTED,
        RebalancingStatus.SWAP_PROCESSING,
      ])

      if (processingRecords.length === 0) {
        return
      }

      this.logger.log({
        message: 'Found rebalancing records to poll NEAR status',
        count: processingRecords.length,
        operation: 'near_status_poll_start',
        timestamp: new Date().toISOString(),
      })

      for (const rebalancing of processingRecords) {
        await this.checkNearStatus(rebalancing)
      }
    })
  }

  /**
   * Checks NEAR status for a single rebalancing record
   */
  private async checkNearStatus(rebalancing: Rebalancing): Promise<void> {
    const { id, rebalancingId, tradeId, depositAddress, tradeHash } = rebalancing
    const tradeIdentifier = tradeId || tradeHash

    if (!depositAddress) {
      this.logger.warn({
        message: 'Rebalancing record missing deposit address',
        rebalancingId,
        tradeId: tradeIdentifier,
        operation: 'near_status_missing_deposit_address',
        timestamp: new Date().toISOString(),
      })
      return
    }

    try {
      const statusResponse = await this.nearService.getStatus(depositAddress)
      const { status, swapDetails } = statusResponse
      const nearTxHash = swapDetails.nearTxHashes[0] || swapDetails.destinationChainTxHashes[0]?.hash

      this.logger.log({
        message: 'NEAR status received',
        rebalancingId,
        tradeId: tradeIdentifier,
        depositAddress,
        status,
        operation: 'near_status_received',
        timestamp: new Date().toISOString(),
      })

      switch (status) {
        case NearStatus.SUCCESS:
          await this.handleSuccess(rebalancing, swapDetails, nearTxHash)
          break

        case NearStatus.FAILED:
          await this.handleFailed(rebalancing)
          break

        case NearStatus.REFUNDED:
          await this.handleRefunded(rebalancing, swapDetails)
          break

        case NearStatus.PROCESSING:
        case NearStatus.KNOWN_DEPOSIT_TX:
        case NearStatus.PENDING_DEPOSIT:
          // Still processing - update to SWAP_PROCESSING if not already
          if (rebalancing.status !== RebalancingStatus.SWAP_PROCESSING) {
            await this.rebalancingService.updateStatus(id, RebalancingStatus.SWAP_PROCESSING)
          }
          break

        case NearStatus.INCOMPLETE_DEPOSIT:
          this.logger.warn({
            message: 'Incomplete deposit detected',
            rebalancingId,
            tradeId: tradeIdentifier,
            depositAddress,
            operation: 'near_incomplete_deposit',
            timestamp: new Date().toISOString(),
          })
          break

        default:
          this.logger.warn({
            message: 'Unknown NEAR status',
            rebalancingId,
            tradeId: tradeIdentifier,
            status,
            operation: 'near_unknown_status',
            timestamp: new Date().toISOString(),
          })
      }
    } catch (error: unknown) {
      this.logger.error({
        message: 'Error checking NEAR status',
        rebalancingId,
        tradeId: tradeIdentifier,
        depositAddress,
        error: error instanceof Error ? error.message : String(error),
        operation: 'near_status_error',
        timestamp: new Date().toISOString(),
      })
    }
  }

  private async handleSuccess(
    rebalancing: Rebalancing,
    swapDetails: { amountOut: string; amountOutFormatted: string },
    nearTxHash: string | undefined
  ): Promise<void> {
    const { id, rebalancingId, tradeId, tradeHash } = rebalancing
    const tradeIdentifier = tradeId || tradeHash

    await this.rebalancingService.updateStatus(id, RebalancingStatus.COMPLETED, {
      actualUsdc: swapDetails.amountOut,
      nearTxId: nearTxHash,
    })

    await this.sendNotification(
      RebalanceNotification.completed({
        rebalancingId,
        tradeId: tradeIdentifier,
        usdcAmount: swapDetails.amountOut,
        txHash: nearTxHash,
      })
    )

    this.logger.log({
      message: 'Rebalance completed successfully',
      rebalancingId,
      tradeId: tradeIdentifier,
      usdcAmount: swapDetails.amountOut,
      txHash: nearTxHash,
      operation: 'rebalance_complete',
      timestamp: new Date().toISOString(),
    })
  }

  private async handleFailed(rebalancing: Rebalancing): Promise<void> {
    const { id, rebalancingId, tradeId, tradeHash } = rebalancing
    const tradeIdentifier = tradeId || tradeHash

    // Set back to PENDING for scheduler to retry
    await this.rebalancingService.updateStatus(id, RebalancingStatus.PENDING, {
      error: 'NEAR swap failed',
    })

    await this.sendNotification(
      RebalanceNotification.swapFailed({
        rebalancingId,
        tradeId: tradeIdentifier,
      })
    )

    this.logger.warn({
      message: 'NEAR swap failed, reset to PENDING for retry',
      rebalancingId,
      tradeId: tradeIdentifier,
      operation: 'rebalance_swap_failed_retry',
      timestamp: new Date().toISOString(),
    })
  }

  private async handleRefunded(
    rebalancing: Rebalancing,
    swapDetails: { refundedAmount?: string; refundedAmountFormatted?: string }
  ): Promise<void> {
    const { id, rebalancingId, tradeId, tradeHash } = rebalancing
    const tradeIdentifier = tradeId || tradeHash

    await this.rebalancingService.updateStatus(id, RebalancingStatus.REFUNDED, {
      error: `Funds refunded: ${swapDetails.refundedAmountFormatted || 'N/A'}`,
    })

    await this.sendNotification(
      RebalanceNotification.refunded({
        rebalancingId,
        tradeId: tradeIdentifier,
        refundedAmount: swapDetails.refundedAmountFormatted,
      })
    )

    this.logger.error({
      message: 'Unexpected refund received',
      rebalancingId,
      tradeId: tradeIdentifier,
      refundedAmount: swapDetails.refundedAmount,
      operation: 'unexpected_refund',
      timestamp: new Date().toISOString(),
    })
  }

  private async sendNotification(message: string) {
    try {
      await this.notificationService.sendTelegramMessage(message)
    } catch (error: unknown) {
      this.logger.warn({
        message: 'Failed to send notification',
        error: error instanceof Error ? error.message : String(error),
        operation: 'notification_error',
        timestamp: new Date().toISOString(),
      })
    }
  }
}
