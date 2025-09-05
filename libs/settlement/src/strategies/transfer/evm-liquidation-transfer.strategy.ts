import { Injectable, Logger } from '@nestjs/common'
import { TransactionService } from '@optimex-pmm/blockchain'
import { errorDecoder } from '@optimex-pmm/shared'
import { TradeService } from '@optimex-pmm/trade'
import { config, MorphoLiquidator__factory } from '@optimex-xyz/market-maker-sdk'

import { DecodedError } from 'ethers-decode-error'

import { ITransferStrategy, TransferParams, TransferResult } from '../../interfaces'

@Injectable()
export class EVMLiquidationTransferStrategy implements ITransferStrategy {
  private readonly logger = new Logger(EVMLiquidationTransferStrategy.name)

  constructor(
    private tradeService: TradeService,
    private transactionService: TransactionService
  ) {}

  async transfer(params: TransferParams): Promise<TransferResult> {
    const { amount, token, tradeId } = params
    const { tokenAddress, networkId } = token

    const trade = await this.tradeService.findTradeById(tradeId)

    if (!trade) {
      throw new Error(`Trade not found: ${tradeId}`)
    }

    const liquidAddress = this.getLiquidationPaymentAddress(networkId)

    // Handle token approval if not native token
    if (tokenAddress !== 'native') {
      await this.transactionService.handleTokenApproval(networkId, tokenAddress, liquidAddress, amount)
    }

    if (!trade.apm || !trade.positionId) {
      throw new Error(`Missing required liquidation data: apm=${trade.apm}, positionId=${trade.positionId}`)
    }

    const positionManager = trade.apm
    const signature = trade.validatorSignature || '0x'
    const positionId = trade.positionId
    const isLiquid = trade.isLiquid

    const decoder = errorDecoder()

    try {
      // Execute contract method with single call - TypeChain provides type safety
      const result = await this.transactionService.executeContractMethod(
        MorphoLiquidator__factory,
        liquidAddress,
        'payment',
        [positionManager, positionId, tradeId, amount, isLiquid, signature],
        networkId,
        {
          description: `Liquidation payment for trade ${tradeId}`,
          gasBufferPercentage: 40, // Slightly higher buffer for liquidation transactions
        }
      )

      this.logger.log({
        message: 'Liquidation transfer transaction sent',
        txHash: result.hash,
        tradeId,
        networkId,
        tokenAddress,
        amount: amount.toString(),
        positionManager,
        positionId,
        nonce: result.nonce,
        gasLimit: result.gasLimit?.toString(),
        gasPrice: result.gasPrice?.toString(),
        maxFeePerGas: result.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: result.maxPriorityFeePerGas?.toString(),
        operation: 'evm_liquidation_transfer',
        status: 'success',
        timestamp: new Date().toISOString(),
      })

      return result
    } catch (error) {
      this.logger.error({
        message: 'Liquidation transfer error details',
        tradeId,
        error: error.message || error.toString(),
        operation: 'evm_liquidation_transfer',
        timestamp: new Date().toISOString(),
      })
      const decodedError: DecodedError = await decoder.decode(error)
      this.logger.error({
        message: 'Decoded liquidation transfer error',
        tradeId,
        decodedError: decodedError.reason || decodedError.toString(),
        operation: 'evm_liquidation_transfer',
        timestamp: new Date().toISOString(),
      })

      const errorCode = this.extractErrorCode(tradeId, error, decodedError)
      const paddedTxHash = this.padErrorCodeToTxHash(errorCode)

      this.logger.warn({
        message: 'Liquidation payment failed, using error code as txHash',
        tradeId,
        networkId,
        decodedReason: decodedError.reason,
        errorCode,
        paddedTxHash,
        operation: 'evm_liquidation_transfer',
        status: 'failed_with_fallback',
        timestamp: new Date().toISOString(),
      })

      return { hash: paddedTxHash }
    }
  }

  private extractErrorCode(tradeId: string, error: any, decodedError: DecodedError): string {
    this.logger.debug({
      message: 'Extracting error code from decoded error',
      tradeId,
      decodedError: decodedError.toString(),
      operation: 'extract_error_code',
      timestamp: new Date().toISOString(),
    })
    this.logger.debug({
      message: 'Extracting error code from raw error',
      tradeId,
      error: error.message || error.toString(),
      errorData: error?.data || error?.transaction?.data,
      operation: 'extract_error_code',
      timestamp: new Date().toISOString(),
    })

    const errorData = error?.data || error?.transaction?.data || decodedError?.data
    if (!errorData) {
      throw new Error('No error data available to extract error code')
    }

    const selector = errorData.slice(0, 10)
    return selector
  }

  private padErrorCodeToTxHash(errorCode: string): string {
    const cleanErrorCode = errorCode.startsWith('0x') ? errorCode.slice(2) : errorCode
    const paddedHash = '0x' + cleanErrorCode.padEnd(64, '0')
    return paddedHash
  }

  private getLiquidationPaymentAddress(networkId: string) {
    const paymentAddress = config.getLiquidationAddress(networkId)
    if (!paymentAddress) {
      throw new Error(`Unsupported networkId: ${networkId}`)
    }

    return paymentAddress
  }
}
