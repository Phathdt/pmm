import { InjectQueue, Process, Processor } from '@nestjs/bull'
import { Inject } from '@nestjs/common'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import {
  ITransferFactory,
  l2Decode,
  SETTLEMENT_QUEUE,
  SubmitSettlementEvent,
  TRANSFER_FACTORY,
  TransferResult,
  TransferSettlementEvent,
} from '@optimex-pmm/settlement'
import { stringToHex, toObject, toString } from '@optimex-pmm/shared'
import { ITradeService, Trade, TRADE_SERVICE } from '@optimex-pmm/trade'
import { ITypes, routerService, tokenService } from '@optimex-xyz/market-maker-sdk'

import { Job, Queue } from 'bull'

import { BaseProcessor } from './base.processor'

@Processor(SETTLEMENT_QUEUE.EVM_TRANSFER.NAME)
export class EvmTransferSettlementProcessor extends BaseProcessor {
  private pmmId: string
  private readonly MAX_RETRIES = 60
  private readonly RETRY_DELAY = 60000

  private routerService = routerService
  private tokenRepo = tokenService

  protected readonly logger: EnhancedLogger

  constructor(
    @InjectQueue(SETTLEMENT_QUEUE.SUBMIT.NAME) private submitSettlementQueue: Queue,
    @InjectQueue(SETTLEMENT_QUEUE.EVM_TRANSFER.NAME) private transferSettlementQueue: Queue,
    @Inject(TRADE_SERVICE) private tradeService: ITradeService,
    private configService: CustomConfigService,
    @Inject(TRANSFER_FACTORY) private transferFactory: ITransferFactory,
    logger: EnhancedLogger
  ) {
    super()
    this.logger = logger.with({ context: EvmTransferSettlementProcessor.name })
    this.pmmId = stringToHex(this.configService.pmm.id)
  }

  @Process(SETTLEMENT_QUEUE.EVM_TRANSFER.JOBS.PROCESS)
  async transfer(job: Job<string>) {
    return this.executeWithTraceId(job, async (job) => {
      const { tradeId, retryCount = 0 } = toObject(job.data) as TransferSettlementEvent & { retryCount?: number }

      this.logger.log({
        message: 'Processing EVM transfer settlement retry',
        tradeId,
        retryCount,
        maxRetries: this.MAX_RETRIES,
        operation: 'evm_transfer_settlement',
        timestamp: new Date().toISOString(),
      })

      try {
        const pMMSelection = await this.routerService.getPMMSelection(tradeId)

        const { pmmInfo } = pMMSelection

        if (pmmInfo.selectedPMMId !== this.pmmId) {
          this.logger.error({
            message: 'Trade does not belong to this PMM',
            tradeId,
            pmmId: this.pmmId,
            operation: 'evm_transfer_settlement',
            error: 'trade_pmm_mismatch',
            timestamp: new Date().toISOString(),
          })
          return
        }

        const trade: ITypes.TradeDataStructOutput = await this.routerService.getTradeData(tradeId)

        const tradeDb = await this.tradeService.findTradeById(tradeId)

        if (!tradeDb) {
          this.logger.error({
            message: 'Trade not found in database',
            tradeId,
            operation: 'evm_transfer_settlement',
            error: 'trade_not_found',
            timestamp: new Date().toISOString(),
          })
          return
        }

        // Check if trade deadline has passed
        const now = Math.floor(Date.now() / 1000)
        if (tradeDb.tradeDeadline && parseInt(tradeDb.tradeDeadline) < now) {
          this.logger.error({
            message: 'Trade has expired',
            tradeId,
            tradeDeadline: tradeDb.tradeDeadline,
            currentTime: now,
            operation: 'evm_transfer_settlement',
            error: 'trade_expired',
            timestamp: new Date().toISOString(),
          })
          return
        }

        const transferResult = await this.transferToken(pmmInfo, trade, tradeDb, tradeId)
        const paymentTxId = transferResult.hash

        const eventData = {
          tradeId: tradeId,
          paymentTxId,
        } as SubmitSettlementEvent

        await this.submitSettlementQueue.add(SETTLEMENT_QUEUE.SUBMIT.JOBS.PROCESS, toString(eventData), {
          removeOnComplete: {
            age: 24 * 3600,
          },
          removeOnFail: {
            age: 24 * 3600,
          },
        })

        this.logger.log({
          message: 'EVM transfer settlement completed successfully',
          tradeId,
          paymentTxId,
          operation: 'evm_transfer_settlement',
          status: 'success',
          timestamp: new Date().toISOString(),
        })
      } catch (error: unknown) {
        if (retryCount < this.MAX_RETRIES - 1) {
          this.logger.warn({
            message: 'EVM transfer settlement retry scheduled',
            tradeId,
            retryCount: retryCount + 1,
            maxRetries: this.MAX_RETRIES,
            error: error instanceof Error ? error.message : String(error),
            operation: 'evm_transfer_settlement',
            nextRetryDelayMs: this.RETRY_DELAY,
            timestamp: new Date().toISOString(),
          })

          await this.transferSettlementQueue.add(
            SETTLEMENT_QUEUE.EVM_TRANSFER.JOBS.PROCESS,
            toString({ tradeId, retryCount: retryCount + 1 }),
            {
              delay: this.RETRY_DELAY,
              removeOnComplete: {
                age: 24 * 3600,
              },
              removeOnFail: {
                age: 24 * 3600,
              },
            }
          )
          return
        }
        this.logger.error({
          message: 'EVM transfer settlement failed after maximum retries',
          tradeId,
          maxRetries: this.MAX_RETRIES,
          error: error instanceof Error ? error.message : String(error),
          operation: 'evm_transfer_settlement',
          status: 'failed',
          timestamp: new Date().toISOString(),
        })

        throw error
      }
    })
  }

  private async transferToken(
    pmmInfo: { amountOut: bigint },
    trade: ITypes.TradeDataStructOutput,
    tradeDb: Trade,
    tradeId: string
  ): Promise<TransferResult> {
    const amount = pmmInfo.amountOut
    const {
      address: toUserAddress,
      networkId,
      tokenAddress: toTokenAddress,
    } = await this.decodeChainInfo(trade.tradeInfo.toChain)

    this.logger.log({
      message: 'EVM chain information decoded successfully',
      tradeId,
      toUserAddress,
      networkId,
      tokenAddress: toTokenAddress,
      operation: 'evm_chain_info_decode',
      timestamp: new Date().toISOString(),
    })

    const toToken = await this.tokenRepo.getToken(networkId, toTokenAddress)

    try {
      const strategy = this.transferFactory.getStrategy(toToken.networkType.toUpperCase(), tradeDb.tradeType!)
      const transferResult = await strategy.transfer({
        toAddress: toUserAddress,
        amount,
        token: toToken,
        tradeId,
      })

      return transferResult
    } catch (error: unknown) {
      this.logger.error({
        message: 'EVM token transfer failed',
        tradeId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'evm_token_transfer',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }

  private async decodeChainInfo(chainInfo: [string, string, string]): Promise<{
    address: string
    networkId: string
    tokenAddress: string
  }> {
    const [addressHex, networkIdHex, tokenAddressHex] = chainInfo

    return {
      address: l2Decode(addressHex),
      networkId: l2Decode(networkIdHex),
      tokenAddress: l2Decode(tokenAddressHex),
    }
  }
}
