import { InjectQueue } from '@nestjs/bull'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { QueueService } from '@optimex-pmm/queue'
import { SETTLEMENT_QUEUE, SETTLEMENT_REDIS_QUEUE, TransferSettlementEvent } from '@optimex-pmm/settlement'
import { toString } from '@optimex-pmm/shared'

import { Queue } from 'bull'

@Injectable()
export class EvmMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EvmMonitorService.name)

  constructor(
    @InjectQueue(SETTLEMENT_QUEUE.EVM_TRANSFER.NAME) private readonly transferQueue: Queue,
    private readonly queueService: QueueService
  ) {}

  async onModuleInit() {
    this.logger.log('EvmMonitorService initialized')
  }

  async onModuleDestroy() {
    this.logger.log('EvmMonitorService shutting down')
  }

  @Cron(CronExpression.EVERY_SECOND)
  async processTransferSettlementEvents() {
    try {
      // Pop messages from Redis queue
      const messages = await this.queueService.popFromQueue(SETTLEMENT_REDIS_QUEUE.EVM_TRANSFER.NAME, 10)

      if (messages.length > 0) {
        this.logger.debug(`Consumed ${messages.length} messages from Redis queue`)

        // Process each message and convert to Bull job
        for (const message of messages) {
          const transferEvent = message as TransferSettlementEvent
          this.logger.debug(`Processing transfer event`, { tradeId: transferEvent.tradeId })

          await this.processTransfer(transferEvent)
        }
      }
    } catch (error) {
      this.logger.error({
        message: 'Error processing transfer settlement events',
        error: error instanceof Error ? error.message : String(error),
        operation: 'transfer_settlement_processing',
        timestamp: new Date().toISOString(),
      })
    }
  }

  async processTransfer(eventData: TransferSettlementEvent) {
    const { tradeId } = eventData

    this.logger.log({
      message: 'Processing EVM transfer',
      tradeId,
      operation: 'evm_transfer_process',
      timestamp: new Date().toISOString(),
    })

    try {
      await this.transferQueue.add(SETTLEMENT_QUEUE.EVM_TRANSFER.JOBS.PROCESS, toString(eventData), {
        removeOnComplete: { age: 24 * 3600 }, // 24 hours
        removeOnFail: { age: 24 * 3600 }, // 24 hours
      })

      this.logger.log({
        message: 'Successfully forwarded EVM transfer to Bull queue',
        tradeId,
        operation: 'evm_transfer_process',
        status: 'success',
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error({
        message: 'Failed to process EVM transfer',
        tradeId,
        error: error.message || error.toString(),
        operation: 'evm_transfer_process',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }
}
