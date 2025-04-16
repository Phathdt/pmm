import { TokenRepository } from '@bitfi-mock-pmm/token'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { Connection, PublicKey } from '@solana/web3.js'

import axios from 'axios'

interface ExplorerBalanceResponse {
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
export class BalanceMonitorScheduler {
  private readonly logger = new Logger(BalanceMonitorScheduler.name)
  private readonly MIN_BALANCE_USD = 1000
  private readonly solanaConnection: Connection
  private readonly btcNetwork: string
  private readonly btcAddress: string
  private readonly solAddress: string

  constructor(
    private readonly tokenRepo: TokenRepository,
    private readonly configService: ConfigService
  ) {
    this.solanaConnection = new Connection(this.configService.getOrThrow<string>('SOLANA_RPC_URL'))
    this.btcNetwork = this.configService.getOrThrow<string>('BTC_NETWORK')
    this.btcAddress = this.configService.getOrThrow<string>('PMM_BTC_ADDRESS')
    this.solAddress = this.configService.getOrThrow<string>('PMM_SOLANA_ADDRESS')
  }

  private async getSolanaBalance(): Promise<number> {
    try {
      const publicKey = new PublicKey(this.solAddress)
      const balance = await this.solanaConnection.getBalance(publicKey)
      return balance / 1e9 // Convert lamports to SOL
    } catch (error) {
      this.logger.error(error, 'Error fetching Solana balance:')
      return 0
    }
  }

  private async getBtcBalance(): Promise<number> {
    try {
      const baseUrl =
        this.btcNetwork === 'mainnet' ? 'https://blockstream.info/api' : 'https://blockstream.info/testnet/api'

      const response = await axios.get<ExplorerBalanceResponse>(`${baseUrl}/address/${this.btcAddress}`)

      if (response?.data) {
        const confirmedBalance =
          response.data.chain_stats?.funded_txo_sum - response.data.chain_stats?.spent_txo_sum || 0
        const unconfirmedBalance =
          response.data.mempool_stats?.funded_txo_sum - response.data.mempool_stats?.spent_txo_sum || 0
        const totalBalance = Math.max(0, confirmedBalance + unconfirmedBalance)
        return totalBalance / 1e8 // Convert satoshis to BTC
      }
      return 0
    } catch (error) {
      this.logger.error(error, 'Error fetching BTC balance:')
      return 0
    }
  }

  @Cron('*/10 * * * * *')
  async checkBTCBalance(): Promise<void> {
    try {
      const [btcPrice, btcBalance] = await Promise.all([this.tokenRepo.getTokenPrice('BTC'), this.getBtcBalance()])

      const btcValue = btcBalance * btcPrice.currentPrice

      if (btcValue < this.MIN_BALANCE_USD) {
        this.logger.warn(
          `BTC balance is below minimum threshold: $${btcValue.toFixed(2)} (${btcBalance} BTC) - Address: ${this.btcAddress}`
        )
      }

      this.logger.log(
        `BTC balance check completed - $${btcValue.toFixed(2)} (${btcBalance} BTC) - Address: ${this.btcAddress}`
      )
    } catch (error) {
      this.logger.error(error, 'Error checking BTC balance:')
    }
  }

  @Cron('*/10 * * * * *')
  async checkSOLBalance(): Promise<void> {
    try {
      const [solPrice, solBalance] = await Promise.all([this.tokenRepo.getTokenPrice('SOL'), this.getSolanaBalance()])

      const solValue = solBalance * solPrice.currentPrice

      if (solValue < this.MIN_BALANCE_USD) {
        this.logger.warn(
          `SOL balance is below minimum threshold: $${solValue.toFixed(2)} (${solBalance} SOL) - Address: ${this.solAddress}`
        )
      }

      this.logger.log(
        `SOL balance check completed - $${solValue.toFixed(2)} (${solBalance} SOL) - Address: ${this.solAddress}`
      )
    } catch (error) {
      this.logger.error(error, 'Error checking SOL balance:')
    }
  }
}
