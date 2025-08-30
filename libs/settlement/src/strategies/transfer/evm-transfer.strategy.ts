import { Injectable, Logger } from '@nestjs/common'
import { TransactionService } from '@optimex-pmm/blockchain'
import { errorDecoder } from '@optimex-pmm/shared'
import { config, Payment__factory, routerService } from '@optimex-xyz/market-maker-sdk'

import { ZeroAddress } from 'ethers'
import { DecodedError } from 'ethers-decode-error'

import { ITransferStrategy, TransferParams } from '../../interfaces'

@Injectable()
export class EVMTransferStrategy implements ITransferStrategy {
  private readonly logger = new Logger(EVMTransferStrategy.name)

  private routerService = routerService

  constructor(private transactionService: TransactionService) {}

  async transfer(params: TransferParams): Promise<string> {
    const { token, toAddress, amount, tradeId } = params
    const { tokenAddress, networkId } = token

    const paymentAddress = this.getPaymentAddress(networkId)

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

      this.logger.log(`Normal transfer transaction sent: ${result.hash}`)
      return result.hash
    } catch (error) {
      const decodedError: DecodedError = await decoder.decode(error)

      this.logger.error(
        `Processing normal transfer tradeId ${tradeId} Execution reverted!\nReason: ${decodedError.reason}`
      )

      throw error
    }
  }

  private getPaymentAddress(networkId: string) {
    const paymentAddress = config.getPaymentAddress(networkId)
    if (!paymentAddress) {
      throw new Error(`Unsupported networkId: ${networkId}`)
    }

    return paymentAddress
  }
}
