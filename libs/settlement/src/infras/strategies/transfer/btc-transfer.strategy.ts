import { Inject, Injectable } from '@nestjs/common'
import { BITCOIN_SERVICE, deriveP2TRAddress, IBitcoinService } from '@optimex-pmm/bitcoin'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { INotificationService, NOTIFICATION_SERVICE } from '@optimex-pmm/notification'
import { getTradeIdsHash } from '@optimex-xyz/market-maker-sdk'

import { ITransferStrategy, TransferParams, TransferResult } from '../../../domain'

@Injectable()
export class BTCTransferStrategy implements ITransferStrategy {
  private readonly logger: EnhancedLogger
  private readonly btcAddress: string

  constructor(
    @Inject(BITCOIN_SERVICE) private readonly bitcoinService: IBitcoinService,
    private configService: CustomConfigService,
    @Inject(NOTIFICATION_SERVICE) private readonly notificationService: INotificationService,
    logger: EnhancedLogger
  ) {
    this.logger = logger.with({ context: BTCTransferStrategy.name })
    this.btcAddress = deriveP2TRAddress({ privateKeyWIF: this.configService.pmm.btc.privateKey }).address
  }

  async transfer(params: TransferParams): Promise<TransferResult> {
    const { toAddress, amount, token, tradeId } = params

    try {
      this.logger.log({
        message: 'Starting BTC transfer',
        tradeId,
        toAddress,
        amount: amount.toString(),
        networkName: token.networkName,
        networkId: token.networkId,
        operation: 'btc_transfer',
        status: 'starting',
        timestamp: new Date().toISOString(),
      })

      // Check balance before proceeding
      const hasSufficientBalance = await this.checkBalance(amount)
      if (!hasSufficientBalance) {
        throw new Error('Insufficient balance for transfer')
      }

      // Generate OP_RETURN data from tradeId hash (without 0x prefix)
      const tradeIdsHash = getTradeIdsHash([tradeId])
      const opReturnData = tradeIdsHash.slice(2) // Remove 0x prefix

      const result = await this.bitcoinService.sendBtc({
        toAddress,
        amount: amount,
        opReturnData,
      })

      this.logger.log({
        message: 'BTC transfer completed successfully',
        tradeId,
        txId: result.txId,
        toAddress,
        amount: amount.toString(),
        feeSats: result.feeSats.toString(),
        networkId: token.networkId,
        operation: 'btc_transfer',
        status: 'success',
        timestamp: new Date().toISOString(),
      })

      return { hash: result.txId }
    } catch (error: unknown) {
      this.logger.error({
        message: 'BTC transfer failed',
        tradeId,
        toAddress,
        amount: amount.toString(),
        networkId: token.networkId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'btc_transfer',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }

  private async checkBalance(amount: bigint): Promise<boolean> {
    this.logger.log({
      message: 'Checking BTC balance',
      address: this.btcAddress,
      requiredAmount: amount.toString(),
      operation: 'btc_check_balance',
      timestamp: new Date().toISOString(),
    })

    try {
      const balance = await this.bitcoinService.getBalance(this.btcAddress)

      this.logger.log({
        message: 'Balance check completed',
        balance: balance.toString(),
        requiredAmount: amount.toString(),
        operation: 'btc_check_balance',
        timestamp: new Date().toISOString(),
      })

      if (balance < amount) {
        const message = `⚠️ Insufficient BTC Balance Alert\n\nRequired: ${amount.toString()} satoshis\nAvailable: ${balance.toString()} satoshis\nAddress: ${this.btcAddress}`
        await this.notificationService.sendTelegramMessage(message)
        return false
      }
      return true
    } catch (error: unknown) {
      this.logger.error({
        message: 'Error checking BTC balance',
        error: error instanceof Error ? error.message : String(error),
        operation: 'btc_check_balance',
        timestamp: new Date().toISOString(),
      })
      return false
    }
  }
}
