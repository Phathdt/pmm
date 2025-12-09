import { InjectQueue, Process, Processor } from '@nestjs/bull'
import { Inject } from '@nestjs/common'
import { deriveP2TRAddress } from '@optimex-pmm/bitcoin'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import {
  INearService,
  NEAR_SERVICE,
  NearDepositType,
  NearQuoteResponse,
  NearRecipientType,
  NearSwapType,
} from '@optimex-pmm/near'
import { INotificationService, NOTIFICATION_SERVICE } from '@optimex-pmm/notification'
import {
  IRebalancingService,
  ISlippageService,
  REBALANCE_QUEUE,
  REBALANCING_SERVICE,
  RebalancingStatus,
  SLIPPAGE_SERVICE,
} from '@optimex-pmm/rebalance'
import { RebalanceNotification, toObject, toString } from '@optimex-pmm/shared'

import { Job, Queue } from 'bull'

import { BaseProcessor } from './base.processor'
import { RebalanceTransferJob } from './rebalance-transfer.processor'

export interface RebalanceQueueJob {
  id: number // Numeric DB ID for querying
  rebalancingId: string // Hex string for logging/debugging
  tradeHash: string
  amount: string
  realAmount: string // Actual UTXO amount received (after fees)
  txId: string
}

@Processor(REBALANCE_QUEUE.BTC_USDC.NAME)
export class RebalanceProcessor extends BaseProcessor {
  protected readonly logger: EnhancedLogger

  constructor(
    @InjectQueue(REBALANCE_QUEUE.BTC_USDC.NAME)
    private readonly rebalanceQueue: Queue,
    @Inject(REBALANCING_SERVICE) private rebalancingService: IRebalancingService,
    @Inject(SLIPPAGE_SERVICE) private slippageService: ISlippageService,
    @Inject(NEAR_SERVICE) private nearService: INearService,
    @Inject(NOTIFICATION_SERVICE) private notificationService: INotificationService,
    private configService: CustomConfigService,
    logger: EnhancedLogger
  ) {
    super()
    this.logger = logger.with({ context: RebalanceProcessor.name })
  }

  /**
   * Process rebalance: Get NEAR quote and validate slippage.
   * This processor handles quote acquisition only.
   * Actual BTC transfer and NEAR polling are handled separately.
   */
  @Process(REBALANCE_QUEUE.BTC_USDC.JOBS.PROCESS)
  async processRebalance(job: Job<string>) {
    return this.executeWithTraceId(job, async (job) => {
      const data = toObject(job.data) as RebalanceQueueJob
      const { id, rebalancingId, tradeHash, amount, realAmount } = data

      this.logger.log({
        message: 'Starting rebalance quote processing',
        rebalancingId,
        tradeHash,
        amount,
        realAmount,
        operation: 'rebalance_quote_start',
        timestamp: new Date().toISOString(),
      })

      try {
        const rebalancing = await this.rebalancingService.findById(id)

        if (!rebalancing) {
          throw new Error(`Rebalancing record not found: ${rebalancingId}`)
        }

        if (rebalancing.status === RebalancingStatus.COMPLETED || rebalancing.status === RebalancingStatus.STUCK) {
          this.logger.log({
            message: 'Rebalancing already in terminal state',
            rebalancingId,
            status: rebalancing.status,
            operation: 'rebalance_skip_terminal',
            timestamp: new Date().toISOString(),
          })
          return
        }

        let btcPrice: number
        try {
          btcPrice = await this.slippageService.getBtcPrice()
        } catch (_error) {
          await this.handleFailure(rebalancing.id, rebalancingId, tradeHash, 'Price provider unavailable')
          return
        }

        // Use realAmount (actual UTXO received) for NEAR quote request
        const quoteResponse = await this.requestQuote(rebalancingId, tradeHash, realAmount)

        if (!quoteResponse) {
          await this.handleFailure(rebalancing.id, rebalancingId, tradeHash, 'Quote request failed')
          return
        }

        const { quote } = quoteResponse
        const depositAddress = quote.depositAddress

        // Store quote response in metadata and update status
        await this.rebalancingService.updateStatus(rebalancing.id, RebalancingStatus.QUOTE_REQUESTED, {
          depositAddress: depositAddress,
          oraclePrice: btcPrice.toString(),
          quotePrice: quote.amountInUsd,
          expectedUsdc: quote.amountOut,
          metadata: {
            quoteResponse: quoteResponse,
            quoteReceivedAt: new Date().toISOString(),
          },
        })

        // Use realAmount for slippage check (actual BTC received in satoshis)
        const realAmountSats = BigInt(realAmount)
        const slippageResult = await this.slippageService.checkSlippage(realAmountSats, quote.amountOut)

        await this.rebalancingService.updateStatus(rebalancing.id, RebalancingStatus.QUOTE_REQUESTED, {
          slippageBps: slippageResult.slippageBps,
        })

        if (!slippageResult.isAcceptable) {
          // Slippage exceeded - set back to PENDING for scheduler to retry later
          await this.rebalancingService.updateStatus(rebalancing.id, RebalancingStatus.PENDING, {
            error: `Slippage exceeded: ${(slippageResult.slippageBps / 100).toFixed(2)}% > ${(slippageResult.thresholdBps / 100).toFixed(2)}%`,
          })

          await this.sendNotification(
            RebalanceNotification.slippageExceeded({
              rebalancingId,
              tradeHash,
              slippageBps: slippageResult.slippageBps,
              thresholdBps: slippageResult.thresholdBps,
            })
          )

          this.logger.log({
            message: 'Slippage exceeded, reset to PENDING for retry',
            rebalancingId,
            tradeHash,
            slippageBps: slippageResult.slippageBps,
            thresholdBps: slippageResult.thresholdBps,
            operation: 'rebalance_slippage_retry',
            timestamp: new Date().toISOString(),
          })
          return
        }

        // Slippage is acceptable - update status to QUOTE_ACCEPTED
        await this.rebalancingService.updateStatus(rebalancing.id, RebalancingStatus.QUOTE_ACCEPTED)

        // Enqueue transfer job to send BTC to NEAR vault
        const transferJob: RebalanceTransferJob = {
          id,
          rebalancingId,
          tradeHash,
          realAmount,
          depositAddress,
        }

        // Include retryCount in jobId to allow retry attempts
        await this.rebalanceQueue.add(REBALANCE_QUEUE.BTC_USDC.JOBS.TRANSFER, toString(transferJob), {
          jobId: `rebalance-transfer-${rebalancingId}-${rebalancing.retryCount}`,
          removeOnComplete: { age: 24 * 3600 },
          removeOnFail: { age: 24 * 3600 },
        })

        await this.sendNotification(
          RebalanceNotification.quoteAccepted({
            rebalancingId,
            tradeHash,
            depositAddress,
            realAmount,
            expectedUsdc: quote.amountOut,
            slippageBps: slippageResult.slippageBps,
          })
        )

        this.logger.log({
          message: 'Quote accepted, transfer job enqueued',
          rebalancingId,
          tradeHash,
          depositAddress,
          realAmount,
          expectedUsdc: quote.amountOut,
          slippageBps: slippageResult.slippageBps,
          operation: 'rebalance_quote_accepted',
          timestamp: new Date().toISOString(),
        })
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        this.logger.error({
          message: 'Rebalance quote processing error',
          rebalancingId,
          tradeHash,
          error: errorMessage,
          operation: 'rebalance_quote_error',
          timestamp: new Date().toISOString(),
        })

        await this.handleFailure(id, rebalancingId, tradeHash, errorMessage)
      }
    })
  }

  private async requestQuote(
    rebalancingId: string,
    tradeHash: string,
    amount: string
  ): Promise<NearQuoteResponse | null> {
    try {
      const near = this.configService.rebalance.near
      const pmm = this.configService.pmm
      const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      // Derive BTC refund address from pmm.btc.privateKey
      const btcRefundAddress = deriveP2TRAddress({ privateKeyWIF: pmm.btc.privateKey }).address

      // Use liquidation contract address as recipient for USDC (rebalance back to vault)
      const liquidationConfig = this.configService.liquidation
      if (!liquidationConfig?.contractAddress) {
        throw new Error('Liquidation contract address not configured for rebalance recipient')
      }
      const recipient = liquidationConfig.contractAddress

      const quoteResponse = await this.nearService.requestQuote({
        dry: false,
        swapType: NearSwapType.FLEX_INPUT,
        slippageTolerance: near.slippageToleranceBps,
        originAsset: near.originAsset,
        depositType: NearDepositType.ORIGIN_CHAIN,
        destinationAsset: near.destinationAsset,
        amount: amount,
        refundTo: btcRefundAddress,
        refundType: NearDepositType.ORIGIN_CHAIN,
        recipient: recipient,
        recipientType: NearRecipientType.DESTINATION_CHAIN,
        deadline,
        referral: near.referral,
      })

      this.logger.log({
        message: 'Quote received',
        rebalancingId,
        tradeHash,
        depositAddress: quoteResponse.quote.depositAddress,
        amount,
        amountOut: quoteResponse.quote.amountOut,
        amountOutUsd: quoteResponse.quote.amountOutUsd,
        recipient,
        refundTo: btcRefundAddress,
        operation: 'quote_received',
        timestamp: new Date().toISOString(),
      })

      return quoteResponse
    } catch (error: unknown) {
      this.logger.error({
        message: 'Quote request failed',
        rebalancingId,
        tradeHash,
        error: error instanceof Error ? error.message : String(error),
        operation: 'quote_error',
        timestamp: new Date().toISOString(),
      })

      await this.sendNotification(
        RebalanceNotification.quoteFailed({
          tradeHash,
          error: error instanceof Error ? error.message : String(error),
        })
      )

      return null
    }
  }

  /**
   * Handle failures by setting status to PENDING for scheduler to retry later.
   * The scheduler will check tradeCompletedAt to determine if max retry time exceeded.
   */
  private async handleFailure(id: number, rebalancingId: string, tradeHash: string, errorMessage: string) {
    await this.rebalancingService.updateStatus(id, RebalancingStatus.PENDING, { error: errorMessage })

    this.logger.log({
      message: 'Rebalancing failed, reset to PENDING for retry',
      rebalancingId,
      tradeHash,
      error: errorMessage,
      operation: 'rebalance_failure_retry',
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
