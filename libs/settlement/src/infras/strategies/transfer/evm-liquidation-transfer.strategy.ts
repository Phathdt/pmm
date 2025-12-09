import { Inject, Injectable } from '@nestjs/common'
import { ITransactionService, TRANSACTION_SERVICE } from '@optimex-pmm/blockchain'
import {
  errorDecoder,
  OptimexLiquidator__factory,
  OptimexLiquidatorService,
  PaymentRequestStruct,
} from '@optimex-pmm/contracts'
import { CustomConfigService, getProvider } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { ITradeService, TRADE_SERVICE } from '@optimex-pmm/trade'

import { Wallet } from 'ethers'
import { DecodedError } from 'ethers-decode-error'

import { ITransferStrategy, PaymentLiquidMetadata, TransferParams, TransferResult } from '../../../domain'

@Injectable()
export class EVMLiquidationTransferStrategy implements ITransferStrategy {
  private readonly logger: EnhancedLogger

  constructor(
    @Inject(TRADE_SERVICE) private tradeService: ITradeService,
    @Inject(TRANSACTION_SERVICE) private transactionService: ITransactionService,
    private readonly configService: CustomConfigService,
    logger: EnhancedLogger
  ) {
    this.logger = logger.with({ context: EVMLiquidationTransferStrategy.name })
  }

  async transfer(params: TransferParams): Promise<TransferResult> {
    const { amount, token, tradeId } = params
    const { tokenAddress, networkId } = token

    const trade = await this.tradeService.findTradeById(tradeId)
    if (!trade) {
      throw new Error(`Trade not found: ${tradeId}`)
    }

    const liquidationConfig = this.configService.liquidation
    if (!liquidationConfig?.enabled) {
      throw new Error('Liquidation is not enabled')
    }

    if (!liquidationConfig.contractAddress) {
      throw new Error('Liquidation contract address not configured')
    }

    if (!liquidationConfig.approvers || liquidationConfig.approvers.length < 2) {
      throw new Error('At least 2 approvers required for multisig')
    }

    const metadata = trade.metadata as PaymentLiquidMetadata
    if (!metadata?.paymentMetadata) {
      throw new Error(`Missing paymentMetadata for trade ${tradeId}`)
    }

    const paymentRequest: PaymentRequestStruct = {
      token: tokenAddress,
      amount: amount,
      externalCall: metadata.paymentMetadata,
    }

    const provider = getProvider(this.configService)
    const executorWallet = new Wallet(this.configService.pmm.evm.privateKey, provider)
    const executorAddress = await executorWallet.getAddress()

    // Create wallet signers from approver private keys
    const approverSigners = liquidationConfig.approvers.map((pk) => new Wallet(pk, provider))

    const multisigAuth = await OptimexLiquidatorService.buildMultisigAuth({
      provider,
      contractAddress: liquidationConfig.contractAddress,
      executorAddress,
      paymentRequest,
      approverSigners,
      deadlineSeconds: liquidationConfig.deadlineSeconds,
    })

    this.logger.debug({
      message: 'Built multisig auth',
      tradeId,
      threshold: multisigAuth.threshold,
      deadline: multisigAuth.deadline.toString(),
      signaturesCount: multisigAuth.signatures.length,
    })

    try {
      const result = await this.transactionService.executeContractMethod(
        OptimexLiquidator__factory,
        liquidationConfig.contractAddress,
        'payment',
        [paymentRequest, multisigAuth],
        networkId,
        { description: `Liquidation payment for trade ${tradeId}`, gasBufferPercentage: 40 }
      )

      this.logger.log({
        message: 'Liquidation transfer sent',
        txHash: result.hash,
        tradeId,
        networkId,
        tokenAddress,
        amount: amount.toString(),
      })

      return result
    } catch (error: unknown) {
      return this.handleTransferError(tradeId, networkId, error)
    }
  }

  private async handleTransferError(tradeId: string, networkId: string, error: unknown): Promise<TransferResult> {
    this.logger.error({
      message: 'Liquidation transfer error',
      tradeId,
      networkId,
      error: error instanceof Error ? error.message : String(error),
    })

    const decoder = errorDecoder()
    const decodedError: DecodedError = await decoder.decode(error)

    this.logger.error({
      message: 'Decoded liquidation error',
      tradeId,
      decodedReason: decodedError.reason,
    })

    const errorCode = this.extractErrorCode(error, decodedError)
    const paddedTxHash = '0x' + errorCode.replace('0x', '').padEnd(64, '0')

    this.logger.warn({
      message: 'Liquidation payment failed, using error code as txHash',
      tradeId,
      networkId,
      decodedReason: decodedError.reason,
      errorCode,
      paddedTxHash,
    })

    return { hash: paddedTxHash }
  }

  private extractErrorCode(error: unknown, decodedError: DecodedError): string {
    const errorObj = error && typeof error === 'object' ? (error as Record<string, unknown>) : {}
    const transactionObj = errorObj?.['transaction'] as Record<string, unknown> | undefined
    const errorData = errorObj?.['data'] || transactionObj?.['data'] || decodedError?.data

    if (!errorData) {
      throw new Error('No error data available')
    }

    return String(errorData).slice(0, 10)
  }
}
