import { Inject, Injectable } from '@nestjs/common'
import { ITransactionService, TRANSACTION_SERVICE } from '@optimex-pmm/blockchain'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { errorDecoder } from '@optimex-pmm/shared'
import {
  AssetChainContractRole,
  OptimexEvmNetwork,
  Payment__factory,
  protocolService,
  routerService,
} from '@optimex-xyz/market-maker-sdk'

import { ZeroAddress } from 'ethers'
import { DecodedError } from 'ethers-decode-error'

import { ITransferStrategy, TransferParams, TransferResult } from '../../../domain'

@Injectable()
export class EVMTransferStrategy implements ITransferStrategy {
  private readonly logger: EnhancedLogger

  private routerService = routerService

  constructor(
    @Inject(TRANSACTION_SERVICE) private transactionService: ITransactionService,
    logger: EnhancedLogger
  ) {
    this.logger = logger.with({ context: EVMTransferStrategy.name })
  }

  async transfer(params: TransferParams): Promise<TransferResult> {
    const { token, toAddress, amount, tradeId } = params
    const { tokenAddress, networkId } = token

    const paymentAddress = await this.getPaymentAddress(networkId)

    // Handle token approval if not native token
    if (tokenAddress !== 'native') {
      await this.transactionService.handleTokenApproval(networkId, tokenAddress, paymentAddress, amount)
    }

    const feeDetails = await this.routerService.getFeeDetails(tradeId)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60)
    const decoder = errorDecoder()

    try {
      // Execute contract method with single call - TypeChain provides type safety
      const result = await this.transactionService.executeContractMethod(
        Payment__factory,
        paymentAddress,
        'payment',
        [
          tradeId,
          tokenAddress === 'native' ? ZeroAddress : tokenAddress,
          toAddress,
          amount,
          feeDetails.totalAmount,
          deadline,
        ],
        networkId,
        {
          value: tokenAddress === 'native' ? amount : BigInt(0),
          description: `Normal payment for trade ${tradeId}`,
        }
      )

      this.logger.log({
        message: 'Normal EVM transfer transaction sent',
        txHash: result.hash,
        tradeId,
        networkId,
        tokenAddress,
        toAddress,
        amount: amount.toString(),
        nonce: result.nonce,
        gasLimit: result.gasLimit?.toString(),
        gasPrice: result.gasPrice?.toString(),
        maxFeePerGas: result.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: result.maxPriorityFeePerGas?.toString(),
        operation: 'evm_transfer',
        status: 'success',
        timestamp: new Date().toISOString(),
      })
      return result
    } catch (error: unknown) {
      const decodedError: DecodedError = await decoder.decode(error)

      this.logger.error({
        message: 'Normal EVM transfer transaction failed',
        tradeId,
        networkId,
        tokenAddress,
        toAddress,
        amount: amount.toString(),
        error:
          decodedError.reason ||
          (error && typeof error === 'object' && 'message' in error
            ? (error as { message: string }).message
            : error?.toString()) ||
          'Unknown error',
        operation: 'evm_transfer',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })

      throw error
    }
  }

  private async getPaymentAddress(networkId: string) {
    const paymentAddress = await protocolService.getAssetChainConfig(
      networkId as OptimexEvmNetwork,
      AssetChainContractRole.Payment
    )
    if (!paymentAddress) {
      throw new Error(`Unsupported networkId: ${networkId}`)
    }

    return paymentAddress[0]
  }
}
