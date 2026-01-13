import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { QueueService } from '@optimex-pmm/queue'
import { SETTLEMENT_QUEUE, SETTLEMENT_REDIS_QUEUE, TransferSettlementEvent } from '@optimex-pmm/settlement'
import { toString } from '@optimex-pmm/shared'

import { Queue } from 'bullmq'

import { BaseScheduler } from '../schedulers'

@Injectable()
export class SolanaMonitorService extends BaseScheduler implements OnModuleInit, OnModuleDestroy {
  protected readonly logger: EnhancedLogger

  constructor(
    @InjectQueue(SETTLEMENT_QUEUE.SOLANA_TRANSFER.NAME) private readonly transferQueue: Queue,
    private readonly queueService: QueueService,
    logger: EnhancedLogger
  ) {
    super()
    this.logger = logger.with({ context: SolanaMonitorService.name })
  }

  async onModuleInit() {
    this.logger.log('SolanaMonitorService initialized')
  }

  async onModuleDestroy() {
    this.logger.log('SolanaMonitorService shutting down')
  }

  @Cron(CronExpression.EVERY_SECOND)
  async processTransferSettlementEvents() {
    return this.executeWithTraceId('processSolanaTransferSettlementEvents', async () => {
      // Pop messages from Redis queue
      const messages = await this.queueService.popFromQueue(SETTLEMENT_REDIS_QUEUE.SOLANA_TRANSFER.NAME, 10)

      if (messages.length > 0) {
        this.logger.debug({ message: 'Consumed messages from Redis queue', count: messages.length })

        // Process each message and convert to Bull job
        for (const message of messages) {
          const transferEvent = message as TransferSettlementEvent
          this.logger.debug({ message: 'Processing transfer event', tradeId: transferEvent.tradeId })

          await this.processTransfer(transferEvent)
        }
      }
    })
  }

  async processTransfer(eventData: TransferSettlementEvent) {
    const { tradeId } = eventData

    this.logger.log({
      message: 'Processing Solana transfer',
      tradeId,
      operation: 'solana_transfer_process',
      timestamp: new Date().toISOString(),
    })

    try {
      await this.transferQueue.add(SETTLEMENT_QUEUE.SOLANA_TRANSFER.JOBS.PROCESS, toString(eventData), {
        removeOnComplete: { age: 24 * 3600 }, // 24 hours
        removeOnFail: { age: 24 * 3600 }, // 24 hours
      })

      this.logger.log({
        message: 'Successfully forwarded Solana transfer to Bull queue',
        tradeId,
        operation: 'solana_transfer_process',
        status: 'success',
        timestamp: new Date().toISOString(),
      })
    } catch (error: unknown) {
      this.logger.error({
        message: 'Failed to process Solana transfer',
        tradeId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'solana_transfer_process',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }
}
