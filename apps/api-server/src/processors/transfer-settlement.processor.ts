import { InjectQueue, Process, Processor } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  l2Decode,
  SETTLEMENT_QUEUE,
  SubmitSettlementEvent,
  TransferFactory,
  TransferSettlementEvent,
} from '@optimex-pmm/settlement'
import { stringToHex, toObject, toString } from '@optimex-pmm/shared'
import { TradeService } from '@optimex-pmm/trade'
import { ITypes, routerService, tokenService } from '@optimex-xyz/market-maker-sdk'
import { Trade } from '@prisma/client'

import { Job, Queue } from 'bull'

@Processor(SETTLEMENT_QUEUE.TRANSFER.NAME)
export class TransferSettlementProcessor {
  private pmmId: string
  private readonly MAX_RETRIES = 60
  private readonly RETRY_DELAY = 60000

  private routerService = routerService
  private tokenRepo = tokenService

  private readonly logger = new Logger(TransferSettlementProcessor.name)

  constructor(
    private configService: ConfigService,
    private transferFactory: TransferFactory,
    @InjectQueue(SETTLEMENT_QUEUE.SUBMIT.NAME) private submitSettlementQueue: Queue,
    @InjectQueue(SETTLEMENT_QUEUE.TRANSFER.NAME) private transferSettlementQueue: Queue,
    private tradeService: TradeService
  ) {
    this.pmmId = stringToHex(this.configService.getOrThrow<string>('PMM_ID'))
  }

  @Process(SETTLEMENT_QUEUE.TRANSFER.JOBS.PROCESS)
  async transfer(job: Job<string>) {
    const { tradeId, retryCount = 0 } = toObject(job.data) as TransferSettlementEvent & { retryCount?: number }

    this.logger.log({
      message: 'Processing transfer settlement retry',
      tradeId,
      retryCount,
      maxRetries: this.MAX_RETRIES,
      operation: 'transfer_settlement',
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
          operation: 'transfer_settlement',
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
          operation: 'transfer_settlement',
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
          operation: 'transfer_settlement',
          error: 'trade_expired',
          timestamp: new Date().toISOString(),
        })
        return
      }

      const paymentTxId = await this.transferToken(pmmInfo, trade, tradeDb, tradeId)

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
        message: 'Transfer settlement completed successfully',
        tradeId,
        paymentTxId,
        operation: 'transfer_settlement',
        status: 'success',
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      if (retryCount < this.MAX_RETRIES - 1) {
        this.logger.warn({
          message: 'Transfer settlement retry scheduled',
          tradeId,
          retryCount: retryCount + 1,
          maxRetries: this.MAX_RETRIES,
          error: error.message || error.toString(),
          operation: 'transfer_settlement',
          nextRetryDelayMs: this.RETRY_DELAY,
          timestamp: new Date().toISOString(),
        })

        await this.transferSettlementQueue.add(
          SETTLEMENT_QUEUE.TRANSFER.JOBS.PROCESS,
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
        message: 'Transfer settlement failed after maximum retries',
        tradeId,
        maxRetries: this.MAX_RETRIES,
        error: error.message || error.toString(),
        operation: 'transfer_settlement',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })

      throw error
    }
  }

  private async transferToken(
    pmmInfo: { amountOut: bigint },
    trade: ITypes.TradeDataStructOutput,
    tradeDb: Trade,
    tradeId: string
  ): Promise<string> {
    const amount = pmmInfo.amountOut
    const {
      address: toUserAddress,
      networkId,
      tokenAddress: toTokenAddress,
    } = await this.decodeChainInfo(trade.tradeInfo.toChain)

    this.logger.log({
      message: 'Chain information decoded successfully',
      tradeId,
      toUserAddress,
      networkId,
      tokenAddress: toTokenAddress,
      operation: 'chain_info_decode',
      timestamp: new Date().toISOString(),
    })

    const toToken = await this.tokenRepo.getToken(networkId, toTokenAddress)

    try {
      const strategy = this.transferFactory.getStrategy(toToken.networkType.toUpperCase(), tradeDb.tradeType)
      const tx = await strategy.transfer({
        toAddress: toUserAddress,
        amount,
        token: toToken,
        tradeId,
        isLiquid: tradeDb.isLiquid,
      })

      return tx
    } catch (error) {
      this.logger.error({
        message: 'Token transfer failed',
        tradeId,
        error: error.message || error.toString(),
        operation: 'token_transfer',
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
