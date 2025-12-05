import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { IRebalancingService, REBALANCING_SERVICE } from '@optimex-pmm/rebalance'
import {
  extractReleaseTxIdFromEvent,
  isConfirmSettlementEvent,
  ITradeService,
  SdkTradeEvent,
  Trade,
  TRADE_SERVICE,
  TradeStatus,
} from '@optimex-pmm/trade'
import { tradeService as sdkTradeService, TradeStatus as SdkTradeStatus } from '@optimex-xyz/market-maker-sdk'

import { BaseScheduler } from './base.scheduler'

/**
 * Monitors trades in SETTLING status and updates them to COMPLETED
 * when confirmed on-chain via SDK. Also creates rebalancing records for
 * BTC liquidation trades (separate job will process them).
 */
@Injectable()
export class SettlementMonitorScheduler extends BaseScheduler implements OnModuleInit {
  protected readonly logger: EnhancedLogger
  private readonly rebalanceEnabled: boolean

  constructor(
    @Inject(TRADE_SERVICE) private readonly tradeService: ITradeService,
    @Inject(REBALANCING_SERVICE) private readonly rebalancingService: IRebalancingService,
    private readonly configService: CustomConfigService,
    logger: EnhancedLogger
  ) {
    super()
    this.logger = logger.with({ context: SettlementMonitorScheduler.name })
    this.rebalanceEnabled = this.configService.rebalance.enabled
  }

  onModuleInit() {
    this.logger.log({
      message: 'SettlementMonitorScheduler initialized',
      rebalanceEnabled: this.rebalanceEnabled,
      operation: 'scheduler_init',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Scans for trades in SETTLING status every 10 minutes
   * and checks if they are completed on-chain
   */
  @Cron('*/10 * * * *')
  async monitorSettlingTrades(): Promise<void> {
    return this.executeWithTraceId('monitorSettlingTrades', async () => {
      this.logger.debug({
        message: 'Starting settlement monitor scan',
        operation: 'settlement_monitor_start',
        timestamp: new Date().toISOString(),
      })

      const settlingTrades = await this.tradeService.findSettlingTrades()

      if (settlingTrades.length === 0) {
        this.logger.debug({
          message: 'No settling trades found',
          operation: 'settlement_monitor_empty',
          timestamp: new Date().toISOString(),
        })
        return
      }

      this.logger.log({
        message: 'Found settling trades to monitor',
        count: settlingTrades.length,
        tradeIds: settlingTrades.map((t) => t.tradeId),
        operation: 'settlement_monitor_scan',
        timestamp: new Date().toISOString(),
      })

      for (const trade of settlingTrades) {
        await this.checkAndUpdateTradeStatus(trade)
      }
    })
  }

  /**
   * Checks if a trade is completed on-chain and updates its status
   */
  private async checkAndUpdateTradeStatus(trade: Trade): Promise<void> {
    const tradeId = trade.tradeId

    try {
      // Query SDK to get on-chain trade status
      const sdkTrade = await sdkTradeService.getTradeById(tradeId)

      if (!sdkTrade) {
        this.logger.debug({
          message: 'Trade not found in SDK',
          tradeId,
          operation: 'settlement_monitor_sdk_check',
          timestamp: new Date().toISOString(),
        })
        return
      }

      // Check if trade is completed on-chain (SDK uses SETTLEMENT_CONFIRMED)
      if (sdkTrade.status === SdkTradeStatus.SETTLEMENT_CONFIRMED) {
        // Extract BTC release_tx_id from ConfirmSettlement event for rebalancing
        const btcReleaseTxId = this.extractReleaseTxId(sdkTrade.events)

        // Update local trade status to COMPLETED with settlementTxId
        await this.tradeService.updateTradeStatus(tradeId, TradeStatus.COMPLETED, {
          settlementTxId: btcReleaseTxId ?? undefined,
        })

        this.logger.log({
          message: 'Trade status updated to COMPLETED',
          tradeId,
          sdkStatus: sdkTrade.status,
          settlementTxId: sdkTrade.settlementTxId,
          btcReleaseTxId,
          operation: 'settlement_monitor_completed',
          timestamp: new Date().toISOString(),
        })

        // Create rebalancing record for BTC liquidation trades (separate job will process)
        await this.createRebalancingIfEligible(trade, btcReleaseTxId, sdkTrade.status)
      } else if (sdkTrade.status === SdkTradeStatus.REFUNDED) {
        // Update local trade status to FAILED (SDK uses REFUNDED for failed/refunded trades)
        await this.tradeService.updateTradeStatus(tradeId, TradeStatus.FAILED, {
          error: 'Settlement refunded on-chain',
        })

        this.logger.warn({
          message: 'Trade status updated to FAILED (refunded)',
          tradeId,
          sdkStatus: sdkTrade.status,
          operation: 'settlement_monitor_refunded',
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error: unknown) {
      this.logger.error({
        message: 'Error checking trade status',
        tradeId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'settlement_monitor_error',
        timestamp: new Date().toISOString(),
      })
    }
  }

  /**
   * Extracts the BTC release transaction ID from ConfirmSettlement event.
   * Uses type-safe utilities from trade module.
   *
   * @param events - Array of trade events from SDK
   * @returns BTC transaction ID or null if not found
   */
  private extractReleaseTxId(events: SdkTradeEvent[] | unknown): string | null {
    if (!Array.isArray(events)) {
      return null
    }

    const confirmEvent = (events as SdkTradeEvent[]).find(isConfirmSettlementEvent)
    if (!confirmEvent) {
      return null
    }

    return extractReleaseTxIdFromEvent(confirmEvent)
  }

  /**
   * Creates rebalancing record for eligible BTC liquidation trades.
   * A separate scheduler will process PENDING rebalancing records.
   */
  private async createRebalancingIfEligible(
    trade: Trade,
    settlementTxId: string | null,
    sdkStatus: string
  ): Promise<void> {
    // Only process if rebalancing is enabled
    if (!this.rebalanceEnabled) {
      return
    }

    const tradeId = trade.tradeId
    const txId = settlementTxId

    if (!txId) {
      this.logger.warn({
        message: 'Completed trade missing settlement_tx_id for rebalancing',
        tradeId,
        operation: 'rebalance_no_tx_id',
        timestamp: new Date().toISOString(),
      })
      return
    }

    // Check if rebalancing already exists for this trade
    const exists = await this.rebalancingService.exists(tradeId)
    if (exists) {
      this.logger.debug({
        message: 'Rebalancing already exists for trade',
        tradeId,
        operation: 'rebalance_already_exists',
        timestamp: new Date().toISOString(),
      })
      return
    }

    try {
      // Create rebalancing record with PENDING status
      // A separate job will verify transaction and process with NEAR
      const amount = trade.amount
      // Use completedAt from trade, or fallback to now for old trades
      const tradeCompletedAt = trade.completedAt ?? new Date()

      const rebalancing = await this.rebalancingService.create({
        tradeHash: tradeId,
        tradeId,
        amount,
        txId,
        vaultAddress: trade.userDepositVault,
        optimexStatus: sdkStatus,
        tradeCompletedAt,
        metadata: undefined,
      })

      this.logger.log({
        message: 'Rebalancing record created',
        tradeId,
        rebalancingId: rebalancing.rebalancingId,
        amount,
        txId,
        status: 'PENDING',
        operation: 'rebalance_record_created',
        timestamp: new Date().toISOString(),
      })
    } catch (error: unknown) {
      this.logger.error({
        message: 'Error creating rebalancing record',
        tradeId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'rebalance_create_error',
        timestamp: new Date().toISOString(),
      })
    }
  }
}
