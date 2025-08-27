import { Injectable, Logger } from '@nestjs/common'
import { NonceManagerService } from '@optimex-pmm/blockchain'
import { errorDecoder } from '@optimex-pmm/shared'
import { TradeService } from '@optimex-pmm/trade'
import { config, ERC20__factory, MorphoLiquidator__factory, Token } from '@optimex-xyz/market-maker-sdk'

import { ethers, TransactionRequest } from 'ethers'
import { DecodedError } from 'ethers-decode-error'

import { ITransferStrategy, TransferParams } from '../../interfaces'

@Injectable()
export class EVMLiquidationTransferStrategy implements ITransferStrategy {
  private readonly logger = new Logger(EVMLiquidationTransferStrategy.name)

  constructor(
    private tradeService: TradeService,
    private nonceManagerService: NonceManagerService
  ) {}

  async transfer(params: TransferParams): Promise<string> {
    const { amount, token, tradeId } = params
    const { tokenAddress, networkId } = token

    const wallet = this.nonceManagerService.getNonceManager(token.networkId)

    const trade = await this.tradeService.findTradeById(tradeId)

    if (!trade) {
      throw new Error(`Trade not found: ${tradeId}`)
    }

    const liquidAddress = this.getLiquidationPaymentAddress(networkId)

    if (tokenAddress !== 'native') {
      await this.handleTokenApproval(tokenAddress, liquidAddress, amount, token, wallet)
    }

    const liquidContract = MorphoLiquidator__factory.connect(liquidAddress, wallet)
    const decoder = errorDecoder()

    if (!trade.apm || !trade.positionId) {
      throw new Error(`Missing required liquidation data: apm=${trade.apm}, positionId=${trade.positionId}`)
    }

    const positionManager = trade.apm
    const signature = trade.validatorSignature || '0x'
    const positionId = trade.positionId
    const isLiquid = trade.isLiquid

    try {
      const tx = await liquidContract.payment(tradeId, positionManager, amount, positionId, isLiquid, signature)

      this.logger.log(`Liquid transfer transaction sent: ${tx.hash}`)

      return tx.hash
    } catch (error) {
      console.log('🚀 ~ EVMLiquidationTransferStrategy ~ transfer ~ error:', error)
      const decodedError: DecodedError = await decoder.decode(error)
      console.log('🚀 ~ EVMLiquidationTransferStrategy ~ transfer ~ decodedError:', decodedError)

      const errorCode = this.extractErrorCode(error, decodedError)
      const paddedTxHash = this.padErrorCodeToTxHash(errorCode)

      this.logger.warn(
        `Payment failed for tradeId ${tradeId}, reason: ${decodedError.reason}, submitting padded error code as txHash`
      )

      return paddedTxHash
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

  private extractErrorCode(error: any, decodedError: DecodedError): string {
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
