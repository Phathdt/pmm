import { Injectable, Logger } from '@nestjs/common'
import { NonceManagerService } from '@optimex-pmm/blockchain'
import { errorDecoder } from '@optimex-pmm/shared'
import { config, ERC20__factory, Payment__factory, routerService, Token } from '@optimex-xyz/market-maker-sdk'

import { ethers, TransactionRequest, ZeroAddress } from 'ethers'
import { DecodedError } from 'ethers-decode-error'

import { ITransferStrategy, TransferParams } from '../../interfaces'

@Injectable()
export class EVMTransferStrategy implements ITransferStrategy {
  private readonly logger = new Logger(EVMTransferStrategy.name)

  private routerService = routerService

  constructor(private nonceManagerService: NonceManagerService) {}

  async transfer(params: TransferParams): Promise<string> {
    const { token, toAddress, amount, tradeId } = params
    const { tokenAddress, networkId } = token

    const wallet = this.nonceManagerService.getNonceManager(token.networkId)
    const paymentAddress = this.getPaymentAddress(networkId)

    if (tokenAddress !== 'native') {
      await this.handleTokenApproval(tokenAddress, paymentAddress, amount, token, wallet)
    }

    const paymentContract = Payment__factory.connect(paymentAddress, wallet)
    const feeDetails = await this.routerService.getFeeDetails(tradeId)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60)
    const decoder = errorDecoder()

    try {
      const tx = await paymentContract.payment(
        tradeId,
        tokenAddress === 'native' ? ZeroAddress : tokenAddress,
        toAddress,
        amount,
        feeDetails.totalAmount,
        deadline,
        {
          value: tokenAddress === 'native' ? amount : 0n,
        }
      )

      this.logger.log(`Normal transfer transaction sent: ${tx.hash}`)

      return tx.hash
    } catch (error) {
      const decodedError: DecodedError = await decoder.decode(error)

      this.logger.error(
        `Processing normal transfer tradeId ${tradeId} Execution reverted!\nReason: ${decodedError.reason}`
      )

      throw error
    }
  }

  private async handleTokenApproval(
    tokenAddress: string,
    spenderAddress: string,
    amount: bigint,
    token: Token,
    wallet: ethers.NonceManager
  ): Promise<void> {
    const erc20Contract = ERC20__factory.connect(tokenAddress, wallet.provider)
    const walletAddress = await wallet.signer.getAddress()
    const currentAllowance = await erc20Contract.allowance(walletAddress, spenderAddress)
    const requiredAmount = ethers.parseUnits(amount.toString(), token.tokenDecimals)

    if (currentAllowance < requiredAmount) {
      if (currentAllowance !== 0n) {
        const erc20Interface = ERC20__factory.createInterface()
        const approveData = erc20Interface.encodeFunctionData('approve', [spenderAddress, 0n])

        const tx: TransactionRequest = {
          to: tokenAddress,
          data: approveData,
          value: 0n,
        }

        await wallet.sendTransaction(tx)
      }

      const erc20Interface = ERC20__factory.createInterface()
      const approveData = erc20Interface.encodeFunctionData('approve', [spenderAddress, ethers.MaxUint256])

      const tx: TransactionRequest = {
        to: tokenAddress,
        data: approveData,
        value: 0n,
      }

      await wallet.sendTransaction(tx)

      const updatedAllowance = await erc20Contract.allowance(walletAddress, spenderAddress)

      if (updatedAllowance < requiredAmount) {
        throw new Error(
          `Insufficient token spending allowance. Please increase your approve limit. ` +
            `Current allowance: ${ethers.formatUnits(updatedAllowance, token.tokenDecimals)} ${token.tokenSymbol}\n` +
            `Required allowance: ${amount} ${token.tokenSymbol}`
        )
      }
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
