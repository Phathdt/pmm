import { Inject, Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { INotificationService, NOTIFICATION_SERVICE } from '@optimex-pmm/notification'
import { ITokenService, TOKEN_SERVICE } from '@optimex-pmm/token'
import { config } from '@optimex-xyz/market-maker-sdk'
import { Connection, PublicKey } from '@solana/web3.js'

import axios from 'axios'

import { BaseScheduler } from './base.scheduler'

interface BtcBalanceApiResponse {
  chain_stats: {
    funded_txo_sum: number
    spent_txo_sum: number
  }
  mempool_stats: {
    funded_txo_sum: number
    spent_txo_sum: number
  }
}

@Injectable()
export class BalanceMonitorScheduler extends BaseScheduler {
  protected readonly logger: EnhancedLogger
  private readonly MIN_BALANCE_USD: number
  private readonly solanaConnection: Connection
  private readonly btcAddress: string
  private readonly solAddress: string

  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    private readonly configService: CustomConfigService,
    @Inject(NOTIFICATION_SERVICE) private readonly notificationService: INotificationService,
    logger: EnhancedLogger
  ) {
    super()
    this.logger = logger.with({ context: BalanceMonitorScheduler.name })
    this.solanaConnection = new Connection(this.configService.rpc.solanaUrl)
    this.btcAddress = this.configService.pmm.btc.address
    this.solAddress = this.configService.pmm.solana.address
    this.MIN_BALANCE_USD = this.configService.trade.minBalanceUsd
  }

  private async getSolanaBalance(): Promise<number> {
    try {
      const publicKey = new PublicKey(this.solAddress)
      const balance = await this.solanaConnection.getBalance(publicKey)
      return balance / 1e9 // Convert lamports to SOL
    } catch (error: unknown) {
      this.logger.error({
        message: 'Error fetching Solana balance',
        address: this.solAddress,
        error: error instanceof Error ? error.message : String(error),
        operation: 'solana_balance_fetch',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })
      return 0
    }
  }

  private async getBtcBalance(): Promise<number> {
    const maxRetries = 3
    const sleepTime = 5000

    const getBalanceFromBlockstream = async (): Promise<number> => {
      const baseUrl = config.isTestnet() ? 'https://blockstream.info/testnet4/api' : 'https://blockstream.info/api'
      const response = await axios.get<BtcBalanceApiResponse>(`${baseUrl}/address/${this.btcAddress}`)
      if (response?.data) {
        const confirmedBalance =
          response.data.chain_stats?.funded_txo_sum - response.data.chain_stats?.spent_txo_sum || 0
        const unconfirmedBalance =
          response.data.mempool_stats?.funded_txo_sum - response.data.mempool_stats?.spent_txo_sum || 0
        return Math.max(0, confirmedBalance + unconfirmedBalance) / 1e8
      }
      return 0
    }

    const getBalanceFromMempool = async (): Promise<number> => {
      const baseUrl = config.isTestnet() ? 'https://mempool.space/testnet4/api' : 'https://mempool.space/api'
      const response = await axios.get<BtcBalanceApiResponse>(`${baseUrl}/address/${this.btcAddress}`)
      if (response?.data) {
        const confirmedBalance =
          response.data.chain_stats?.funded_txo_sum - response.data.chain_stats?.spent_txo_sum || 0
        const unconfirmedBalance =
          response.data.mempool_stats?.funded_txo_sum - response.data.mempool_stats?.spent_txo_sum || 0
        return Math.max(0, confirmedBalance + unconfirmedBalance) / 1e8
      }
      return 0
    }

    for (let retryCount = 1; retryCount <= maxRetries; retryCount++) {
      try {
        this.logger.log({
          message: 'Attempting to fetch BTC balance',
          retryCount,
          maxRetries,
          address: this.btcAddress,
          network: config.isTestnet() ? 'testnet' : 'mainnet',
          operation: 'btc_balance_fetch',
          timestamp: new Date().toISOString(),
        })

        const [blockstreamBalance, mempoolBalance] = await Promise.allSettled([
          getBalanceFromBlockstream(),
          getBalanceFromMempool(),
        ])

        if (blockstreamBalance.status === 'fulfilled' && blockstreamBalance.value > 0) {
          this.logger.log({
            message: 'Successfully fetched BTC balance from Blockstream',
            balance: blockstreamBalance.value,
            address: this.btcAddress,
            source: 'blockstream',
            operation: 'btc_balance_fetch',
            status: 'success',
            timestamp: new Date().toISOString(),
          })
          return blockstreamBalance.value
        }

        if (mempoolBalance.status === 'fulfilled' && mempoolBalance.value > 0) {
          this.logger.log({
            message: 'Successfully fetched BTC balance from Mempool',
            balance: mempoolBalance.value,
            address: this.btcAddress,
            source: 'mempool',
            operation: 'btc_balance_fetch',
            status: 'success',
            timestamp: new Date().toISOString(),
          })
          return mempoolBalance.value
        }

        throw new Error('Both APIs failed to return valid balance')
      } catch (error: unknown) {
        this.logger.error({
          message: 'Error fetching BTC balance',
          retryCount,
          maxRetries,
          address: this.btcAddress,
          error: error instanceof Error ? error.message : String(error),
          operation: 'btc_balance_fetch',
          status: 'failed',
          timestamp: new Date().toISOString(),
        })

        if (retryCount < maxRetries) {
          this.logger.log({
            message: 'Retrying BTC balance fetch',
            retryCount,
            maxRetries,
            sleepTimeSeconds: sleepTime / 1000,
            operation: 'btc_balance_fetch',
            status: 'retrying',
            timestamp: new Date().toISOString(),
          })
          await new Promise((resolve) => setTimeout(resolve, sleepTime))
        } else {
          this.logger.error({
            message: 'Max retries reached for BTC balance check',
            maxRetries,
            address: this.btcAddress,
            operation: 'btc_balance_fetch',
            status: 'max_retries_exceeded',
            timestamp: new Date().toISOString(),
          })
          return 0
        }
      }
    }
    return 0
  }

  @Cron('*/5 * * * *')
  async checkBTCBalance(): Promise<void> {
    return this.executeWithTraceId('checkBTCBalance', async () => {
      const [btcPrice, btcBalance] = await Promise.all([this.tokenService.getTokenPrice('BTC'), this.getBtcBalance()])

      const btcValue = btcBalance * btcPrice

      if (btcValue < this.MIN_BALANCE_USD) {
        const message = `⚠️ BTC Balance Alert\n\nBalance: $${btcValue.toFixed(2)} (${btcBalance} BTC)\nAddress: ${this.btcAddress}\n\nBalance is below minimum threshold of $${this.MIN_BALANCE_USD}`
        this.logger.warn({
          message: 'BTC balance is below minimum threshold',
          currentBalanceBTC: btcBalance,
          currentBalanceUSD: btcValue.toFixed(2),
          minimumThresholdUSD: this.MIN_BALANCE_USD,
          address: this.btcAddress,
          btcPrice: btcPrice,
          operation: 'btc_balance_monitor',
          status: 'below_threshold',
          timestamp: new Date().toISOString(),
        })
        await this.notificationService.sendTelegramMessage(message)
      }

      this.logger.log({
        message: 'BTC balance check completed',
        currentBalanceBTC: btcBalance,
        currentBalanceUSD: btcValue.toFixed(2),
        minimumThresholdUSD: this.MIN_BALANCE_USD,
        address: this.btcAddress,
        btcPrice: btcPrice,
        operation: 'btc_balance_monitor',
        status: 'completed',
        timestamp: new Date().toISOString(),
      })
    })
  }

  @Cron('*/5 * * * *')
  async checkSOLBalance(): Promise<void> {
    return this.executeWithTraceId('checkSOLBalance', async () => {
      const [solPrice, solBalance] = await Promise.all([
        this.tokenService.getTokenPrice('SOL'),
        this.getSolanaBalance(),
      ])

      const solValue = solBalance * solPrice

      if (solValue < this.MIN_BALANCE_USD) {
        const message = `⚠️ SOL Balance Alert\n\nBalance: $${solValue.toFixed(2)} (${solBalance} SOL)\nAddress: ${this.solAddress}\n\nBalance is below minimum threshold of $${this.MIN_BALANCE_USD}`
        this.logger.warn({
          message: 'SOL balance is below minimum threshold',
          currentBalanceSOL: solBalance,
          currentBalanceUSD: solValue.toFixed(2),
          minimumThresholdUSD: this.MIN_BALANCE_USD,
          address: this.solAddress,
          solPrice: solPrice,
          operation: 'sol_balance_monitor',
          status: 'below_threshold',
          timestamp: new Date().toISOString(),
        })
        await this.notificationService.sendTelegramMessage(message)
      }

      this.logger.log({
        message: 'SOL balance check completed',
        currentBalanceSOL: solBalance,
        currentBalanceUSD: solValue.toFixed(2),
        minimumThresholdUSD: this.MIN_BALANCE_USD,
        address: this.solAddress,
        solPrice: solPrice,
        operation: 'sol_balance_monitor',
        status: 'completed',
        timestamp: new Date().toISOString(),
      })
    })
  }
}
