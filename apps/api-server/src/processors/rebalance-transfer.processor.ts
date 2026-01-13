import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject } from '@nestjs/common'
import { BITCOIN_SERVICE, IBitcoinService } from '@optimex-pmm/bitcoin'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { INearService, NEAR_SERVICE } from '@optimex-pmm/near'
import { INotificationService, NOTIFICATION_SERVICE } from '@optimex-pmm/notification'
import { ProcessorHelper } from '@optimex-pmm/queue'
import { IRebalancingService, REBALANCE_QUEUE, REBALANCING_SERVICE, RebalancingStatus } from '@optimex-pmm/rebalance'
import { RebalanceNotification, toObject } from '@optimex-pmm/shared'

import { Job } from 'bullmq'

export interface RebalanceTransferJob {
  id: number // Numeric DB ID for querying
  rebalancingId: string // Hex string for logging/debugging
  tradeHash: string
  realAmount: string // Amount to transfer in satoshis
  depositAddress: string // NEAR vault address to send BTC
}

/**
 * Processes BTC transfers to NEAR vault for rebalancing.
 * This processor handles the actual BTC transfer after quote is accepted.
 */
@Processor(REBALANCE_QUEUE.TRANSFER.NAME)
export class RebalanceTransferProcessor extends WorkerHost {
  private readonly logger: EnhancedLogger
  private readonly processorHelper: ProcessorHelper

  constructor(
    @Inject(REBALANCING_SERVICE) private rebalancingService: IRebalancingService,
    @Inject(BITCOIN_SERVICE) private bitcoinService: IBitcoinService,
    @Inject(NEAR_SERVICE) private nearService: INearService,
    @Inject(NOTIFICATION_SERVICE) private notificationService: INotificationService,
    logger: EnhancedLogger
  ) {
    super()
    this.logger = logger.with({ context: RebalanceTransferProcessor.name })
    this.processorHelper = new ProcessorHelper(this.logger)
  }

  /**
   * Process BTC transfer to NEAR vault.
   * Transfers BTC from PMM wallet to the deposit address provided by NEAR quote.
   */
  async process(job: Job<string, unknown, string>): Promise<void> {
    return this.processorHelper.executeWithTraceId(job, async (job) => {
      const data = toObject(job.data) as RebalanceTransferJob
      const { id, rebalancingId, tradeHash, realAmount, depositAddress } = data

      this.logger.log({
        message: 'Starting BTC transfer to NEAR vault',
        rebalancingId,
        tradeHash,
        realAmount,
        depositAddress,
        operation: 'rebalance_transfer_start',
        timestamp: new Date().toISOString(),
      })

      try {
        const rebalancing = await this.rebalancingService.findById(id)

        if (!rebalancing) {
          throw new Error(`Rebalancing record not found: ${rebalancingId}`)
        }

        // Only process if status is QUOTE_ACCEPTED
        if (rebalancing.status !== RebalancingStatus.QUOTE_ACCEPTED) {
          this.logger.log({
            message: 'Rebalancing not in QUOTE_ACCEPTED state, skipping transfer',
            rebalancingId,
            status: rebalancing.status,
            operation: 'rebalance_transfer_skip',
            timestamp: new Date().toISOString(),
          })
          return
        }

        // Execute BTC transfer to NEAR vault using BitcoinService
        const amountSats = BigInt(realAmount)

        this.logger.log({
          message: 'Executing BTC transfer to NEAR vault',
          rebalancingId,
          toAddress: depositAddress,
          amountSats: amountSats.toString(),
          operation: 'rebalance_transfer_execute',
          timestamp: new Date().toISOString(),
        })

        const result = await this.bitcoinService.sendBtc({
          toAddress: depositAddress,
          amount: amountSats,
        })

        const nearVaultTxId = result.txId

        this.logger.log({
          message: 'BTC transfer completed, submitting deposit to NEAR',
          rebalancingId,
          txHash: nearVaultTxId,
          depositAddress,
          operation: 'rebalance_submit_deposit',
          timestamp: new Date().toISOString(),
        })

        // Submit deposit to NEAR to accelerate processing
        try {
          await this.nearService.submitDeposit({
            txHash: nearVaultTxId,
            depositAddress,
          })

          this.logger.log({
            message: 'Deposit submitted to NEAR successfully',
            rebalancingId,
            txHash: nearVaultTxId,
            depositAddress,
            operation: 'rebalance_submit_deposit_success',
            timestamp: new Date().toISOString(),
          })
        } catch (submitError) {
          // Log but don't fail - NEAR will still detect the deposit eventually
          this.logger.warn({
            message: 'Failed to submit deposit to NEAR (will be detected automatically)',
            rebalancingId,
            txHash: nearVaultTxId,
            depositAddress,
            error: submitError instanceof Error ? submitError.message : String(submitError),
            operation: 'rebalance_submit_deposit_warning',
            timestamp: new Date().toISOString(),
          })
        }

        // Update status to DEPOSIT_SUBMITTED
        await this.rebalancingService.updateStatus(id, RebalancingStatus.DEPOSIT_SUBMITTED, {
          nearVaultTxId,
        })

        await this.sendNotification(
          RebalanceNotification.btcTransferred({
            rebalancingId,
            tradeHash,
            realAmount,
            depositAddress,
            txId: nearVaultTxId,
          })
        )

        this.logger.log({
          message: 'BTC transfer to NEAR vault completed',
          rebalancingId,
          tradeHash,
          nearVaultTxId,
          depositAddress,
          realAmount,
          operation: 'rebalance_transfer_complete',
          timestamp: new Date().toISOString(),
        })
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        this.logger.error({
          message: 'BTC transfer to NEAR vault failed',
          rebalancingId,
          tradeHash,
          error: errorMessage,
          operation: 'rebalance_transfer_error',
          timestamp: new Date().toISOString(),
        })

        await this.handleFailure(id, rebalancingId, tradeHash, errorMessage)
      }
    })
  }

  private async handleFailure(id: number, rebalancingId: string, tradeHash: string, errorMessage: string) {
    // Set back to QUOTE_ACCEPTED for retry (transfer can be retried)
    await this.rebalancingService.updateStatus(id, RebalancingStatus.QUOTE_ACCEPTED, { error: errorMessage })

    await this.sendNotification(
      RebalanceNotification.btcTransferFailed({
        rebalancingId,
        tradeHash,
        error: errorMessage,
      })
    )

    this.logger.log({
      message: 'BTC transfer failed, keeping QUOTE_ACCEPTED for retry',
      rebalancingId,
      tradeHash,
      error: errorMessage,
      operation: 'rebalance_transfer_failure',
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
