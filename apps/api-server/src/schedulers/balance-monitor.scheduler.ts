import { Inject, Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { BITCOIN_SERVICE, deriveP2TRAddress, IBitcoinService } from '@optimex-pmm/bitcoin'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { INotificationService, NOTIFICATION_SERVICE } from '@optimex-pmm/notification'
import { ITokenService, TOKEN_SERVICE } from '@optimex-pmm/token'
import { config } from '@optimex-xyz/market-maker-sdk'
import { Connection, PublicKey } from '@solana/web3.js'

import { BaseScheduler } from './base.scheduler'

@Injectable()
export class BalanceMonitorScheduler extends BaseScheduler {
  protected readonly logger: EnhancedLogger
  private readonly MIN_BALANCE_USD: number
  private readonly solanaConnection: Connection
  private readonly btcAddress: string
  private readonly solAddress: string

  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    @Inject(BITCOIN_SERVICE) private readonly bitcoinService: IBitcoinService,
    private readonly configService: CustomConfigService,
    @Inject(NOTIFICATION_SERVICE) private readonly notificationService: INotificationService,
    logger: EnhancedLogger
  ) {
    super()
    this.logger = logger.with({ context: BalanceMonitorScheduler.name })
    this.solanaConnection = new Connection(this.configService.rpc.solanaUrl)
    this.btcAddress = deriveP2TRAddress({ privateKeyWIF: this.configService.pmm.btc.privateKey }).address
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
    try {
      this.logger.log({
        message: 'Fetching BTC balance',
        address: this.btcAddress,
        network: config.isTestnet() ? 'testnet' : 'mainnet',
        operation: 'btc_balance_fetch',
        timestamp: new Date().toISOString(),
      })

      const balanceSatoshis = await this.bitcoinService.getBalance(this.btcAddress)
      const balanceBtc = Number(balanceSatoshis) / 1e8

      this.logger.log({
        message: 'Successfully fetched BTC balance',
        balance: balanceBtc,
        address: this.btcAddress,
        operation: 'btc_balance_fetch',
        status: 'success',
        timestamp: new Date().toISOString(),
      })

      return balanceBtc
    } catch (error: unknown) {
      this.logger.error({
        message: 'Error fetching BTC balance',
        address: this.btcAddress,
        error: error instanceof Error ? error.message : String(error),
        operation: 'btc_balance_fetch',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })
      return 0
    }
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
