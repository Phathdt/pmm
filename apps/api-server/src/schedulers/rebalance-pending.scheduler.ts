import { InjectQueue } from '@nestjs/bullmq'
import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { BITCOIN_SERVICE, IBitcoinService } from '@optimex-pmm/bitcoin'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { INotificationService, NOTIFICATION_SERVICE } from '@optimex-pmm/notification'
import {
  IRebalancingService,
  REBALANCE_QUEUE,
  Rebalancing,
  REBALANCING_SERVICE,
  RebalancingStatus,
} from '@optimex-pmm/rebalance'
import { RebalanceNotification, toString } from '@optimex-pmm/shared'

import { Queue } from 'bullmq'

import { BaseScheduler } from './base.scheduler'

export interface RebalanceQueueJob {
  id: number // Numeric DB ID for querying
  rebalancingId: string // Hex string for logging/debugging
  tradeHash: string
  amount: string
  realAmount: string // Actual UTXO amount received (after fees)
  txId: string
}

/**
 * Processes PENDING rebalancing records:
 * 1. Checks if max retry duration exceeded based on tradeCompletedAt
 * 2. Queries PENDING rebalancing records
 * 3. Verifies BTC transaction is confirmed on blockchain
 * 4. Extracts real UTXO amount from transaction output
 * 5. Pushes to rebalance queue for NEAR processing
 */
@Injectable()
export class RebalancePendingScheduler extends BaseScheduler implements OnModuleInit {
  protected readonly logger: EnhancedLogger
  private readonly rebalanceEnabled: boolean
  private readonly skipConfirm: boolean

  constructor(
    @InjectQueue(REBALANCE_QUEUE.QUOTE.NAME)
    private readonly quoteQueue: Queue,
    @Inject(REBALANCING_SERVICE) private readonly rebalancingService: IRebalancingService,
    @Inject(BITCOIN_SERVICE) private readonly bitcoinService: IBitcoinService,
    @Inject(NOTIFICATION_SERVICE) private readonly notificationService: INotificationService,
    private readonly configService: CustomConfigService,
    logger: EnhancedLogger
  ) {
    super()
    this.logger = logger.with({ context: RebalancePendingScheduler.name })
    this.rebalanceEnabled = this.configService.rebalance.enabled
    this.skipConfirm = this.configService.bitcoin.skipConfirm ?? false
  }

  onModuleInit() {
    this.logger.log({
      message: 'RebalancePendingScheduler initialized',
      rebalanceEnabled: this.rebalanceEnabled,
      operation: 'scheduler_init',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Scans for PENDING rebalancing records every 5 minutes
   * and processes them if BTC transaction is confirmed
   */
  @Cron('*/5 * * * *')
  async processPendingRebalancing(): Promise<void> {
    if (!this.rebalanceEnabled) {
      return
    }

    return this.executeWithTraceId('processPendingRebalancing', async () => {
      const pendingRecords = await this.rebalancingService.findPending()

      if (pendingRecords.length === 0) {
        return
      }

      this.logger.log({
        message: 'Found pending rebalancing records to process',
        count: pendingRecords.length,
        operation: 'rebalance_pending_scan',
        timestamp: new Date().toISOString(),
      })

      for (const rebalancing of pendingRecords) {
        await this.verifyAndQueueRebalancing(rebalancing)
      }
    })
  }

  /**
   * Verifies transaction and queues for NEAR processing
   */
  private async verifyAndQueueRebalancing(rebalancing: Rebalancing): Promise<void> {
    const { id, rebalancingId, tradeId, txId, amount, vaultAddress, realAmount: existingRealAmount } = rebalancing

    // Check if max retry duration exceeded
    if (this.isMaxRetryDurationExceeded(rebalancing)) {
      await this.markAsStuck(rebalancing)
      return
    }

    if (!txId) {
      this.logger.warn({
        message: 'Rebalancing record missing txId',
        rebalancingId,
        tradeId,
        operation: 'rebalance_missing_tx_id',
        timestamp: new Date().toISOString(),
      })
      return
    }

    try {
      // If realAmount already exists (from previous verification), skip tx verification
      if (existingRealAmount) {
        await this.queueForProcessing(rebalancing, existingRealAmount)
        return
      }

      // Get transaction details from blockchain
      const transaction = await this.bitcoinService.getTransaction(txId)

      if (!transaction) {
        this.logger.debug({
          message: 'Transaction not found on blockchain',
          rebalancingId,
          tradeId,
          txId,
          operation: 'rebalance_tx_not_found',
          timestamp: new Date().toISOString(),
        })
        return
      }

      if (!transaction.status.confirmed && !this.skipConfirm) {
        this.logger.debug({
          message: 'Transaction not yet confirmed on blockchain',
          rebalancingId,
          tradeId,
          txId,
          operation: 'rebalance_tx_not_confirmed',
          timestamp: new Date().toISOString(),
        })
        return
      }

      // Extract real UTXO amount from transaction output
      const realAmount = this.extractRealAmount(transaction, vaultAddress ?? null)

      if (!realAmount) {
        this.logger.warn({
          message: 'Could not extract real amount from transaction',
          rebalancingId,
          tradeId,
          txId,
          vaultAddress,
          expectedAmount: amount,
          operation: 'rebalance_amount_extraction_failed',
          timestamp: new Date().toISOString(),
        })
        return
      }

      // Update status to indicate verification passed with real amount
      await this.rebalancingService.updateStatus(id, RebalancingStatus.MEMPOOL_VERIFIED, {
        mempoolVerified: true,
        realAmount,
      })

      await this.queueForProcessing(rebalancing, realAmount)
    } catch (error: unknown) {
      this.logger.error({
        message: 'Error processing pending rebalancing',
        rebalancingId,
        tradeId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'rebalance_pending_error',
        timestamp: new Date().toISOString(),
      })
    }
  }

  /**
   * Queues rebalancing for NEAR processing
   */
  private async queueForProcessing(rebalancing: Rebalancing, realAmount: string): Promise<void> {
    const { id, rebalancingId, tradeId, txId, amount, retryCount } = rebalancing

    const job: RebalanceQueueJob = {
      id,
      rebalancingId,
      tradeHash: tradeId || rebalancing.tradeHash,
      amount,
      realAmount,
      txId: txId!,
    }

    // Include retryCount in jobId to allow retry attempts
    await this.quoteQueue.add('quote', toString(job), {
      jobId: `rebalance-quote-${rebalancingId}-${retryCount}`,
      removeOnComplete: { age: 24 * 3600 },
      removeOnFail: { age: 24 * 3600 },
    })

    this.logger.log({
      message: 'Rebalancing queued for NEAR processing',
      rebalancingId,
      tradeId,
      amount,
      realAmount,
      txId,
      operation: 'rebalance_queued',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Checks if max retry duration has been exceeded based on tradeCompletedAt
   */
  private isMaxRetryDurationExceeded(rebalancing: Rebalancing): boolean {
    const timing = this.configService.rebalance.timing
    const maxRetryDurationMs = timing.maxRetryDurationHours * 60 * 60 * 1000

    const elapsedMs = Date.now() - rebalancing.tradeCompletedAt.getTime()

    return elapsedMs >= maxRetryDurationMs
  }

  /**
   * Marks rebalancing as STUCK when max retry duration exceeded
   */
  private async markAsStuck(rebalancing: Rebalancing): Promise<void> {
    const { id, rebalancingId, tradeId, tradeHash } = rebalancing
    const timing = this.configService.rebalance.timing
    const elapsedHours = Math.floor((Date.now() - rebalancing.tradeCompletedAt.getTime()) / 3600000)

    await this.rebalancingService.updateStatus(id, RebalancingStatus.STUCK, {
      error: `Max retry duration exceeded (${elapsedHours}h). Last error: ${rebalancing.error || 'N/A'}`,
    })

    await this.sendNotification(
      RebalanceNotification.stuck({
        rebalancingId,
        tradeId: tradeId || tradeHash,
        elapsedHours,
        maxHours: timing.maxRetryDurationHours,
        lastError: rebalancing.error ?? undefined,
      })
    )

    this.logger.error({
      message: 'Rebalancing marked as stuck - max retry duration exceeded',
      rebalancingId,
      tradeId,
      tradeHash,
      elapsedHours,
      maxHours: timing.maxRetryDurationHours,
      lastError: rebalancing.error,
      operation: 'rebalance_stuck',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Extracts real UTXO amount from settlement transaction.
   * The realAmount is the output that goes OUT of the vault (non-vault output).
   * This represents the actual BTC available for NEAR swap after settlement fees.
   *
   * @param transaction - The settlement transaction details
   * @param vaultAddress - The vault address (we want outputs NOT going to this address)
   * @returns Amount in satoshis as string, or null if not found
   */
  private extractRealAmount(
    transaction: { vout?: Array<{ scriptpubkey_address?: string; value: number }> },
    vaultAddress: string | null
  ): string | null {
    if (!transaction.vout || transaction.vout.length === 0) {
      return null
    }

    // If we have a vault address, find outputs that are NOT going back to vault (exclude change)
    if (vaultAddress) {
      const nonVaultOutputs = transaction.vout.filter((output) => output.scriptpubkey_address !== vaultAddress)

      if (nonVaultOutputs.length > 0) {
        // Use the largest non-vault output (the main transfer amount)
        const mainOutput = nonVaultOutputs.reduce((max, output) => (output.value > max.value ? output : max))
        return mainOutput.value.toString()
      }
    }

    // Fallback: use the largest output (likely the main transfer)
    const largestOutput = transaction.vout.reduce((max, output) => (output.value > max.value ? output : max))

    return largestOutput.value.toString()
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
