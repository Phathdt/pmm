import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { decodeAffiliateInfo, errorDecoder, getProvider, isLiquidateAffiliate } from '@optimex-pmm/shared'
import { TradeService } from '@optimex-pmm/trade'
import { config, ERC20__factory, MorphoLiquidator__factory, routerService, Token } from '@optimex-xyz/market-maker-sdk'

import { ethers, TransactionRequest } from 'ethers'
import { DecodedError } from 'ethers-decode-error'

import { ITransferStrategy, TransferParams } from '../../interfaces'

@Injectable()
export class EVMLiquidationTransferStrategy implements ITransferStrategy {
  private pmmPrivateKey: string
  private readonly logger = new Logger(EVMLiquidationTransferStrategy.name)
  private readonly retrySelectors = [
    '0xadb068de', // NotAuthorizedValidator(address) - When performing forceClose, the signature comes from invalid validator
    '0x5ebb051b', // NotEnoughPaymentAmount() - When performing liquidate, the amount PMM pay is not enough to cover the borrowedAmount and userRefund
    '0xf645eedf', // ECDSAInvalidSignature() - When the validator’s signature is incorrect
    '0xfce698f7', // ECDSAInvalidSignatureLength(uint256) - When the validator’s signature has invalid length
    '0xd78bce0c', // ECDSAInvalidSignatureS(bytes32) - When the validator’s signature s has wrong value
    '0x08c379a0', // Error(string) - When perform liquidate, the position becomes healthy that we can’t liquidate this position
  ]

  private routerService = routerService

  constructor(
    private configService: ConfigService,
    private tradeService: TradeService
  ) {
    this.pmmPrivateKey = this.configService.getOrThrow<string>('PMM_EVM_PRIVATE_KEY')
  }

  async transfer(params: TransferParams): Promise<string> {
    const { amount, token, tradeId } = params
    const { tokenAddress, networkId } = token

    const assetProvider = getProvider(token.networkId)
    const wallet = new ethers.Wallet(this.pmmPrivateKey, assetProvider)

    const trade = await this.tradeService.findTradeById(tradeId)

    if (!trade) {
      throw new Error(`Trade not found: ${tradeId}`)
    }

    const liquidAddress = this.getLiquidationPaymentAddress(networkId)

    if (tokenAddress !== 'native') {
      await this.handleTokenApproval(tokenAddress, liquidAddress, amount, token, wallet, assetProvider)
    }

    const liquidContract = MorphoLiquidator__factory.connect(liquidAddress, wallet)
    const decoder = errorDecoder()

    let positionManager = '0x'
    let signature = '0x'
    let isLiquid = false

    const affiliateInfo = await this.routerService.getAffiliateInfo(tradeId)
    const affiliate = decodeAffiliateInfo(affiliateInfo)

    if (!isLiquidateAffiliate(affiliate)) {
      throw new Error(`Cannot get affiliate info`)
    } else {
      positionManager = affiliate.apm
      signature = affiliate.validatorSignature
      isLiquid = affiliate.isLiquidate
    }

    try {
      const tx = await liquidContract.payment(
        tradeId,
        positionManager,
        amount,
        trade.positionId as string,
        isLiquid,
        signature
      )

      this.logger.log(`Liquid transfer transaction sent: ${tx.hash}`)

      return tx.hash
    } catch (error) {
      console.log('🚀 ~ EVMLiquidationTransferStrategy ~ transfer ~ error:', error)
      const decodedError: DecodedError = await decoder.decode(error)
      console.log('🚀 ~ EVMLiquidationTransferStrategy ~ transfer ~ decodedError:', decodedError)

      if (this.shouldRetryWithoutDryRun(error, decodedError)) {
        this.logger.warn(
          `Gas estimation failed for tradeId ${tradeId}, reason: ${decodedError.reason}, retrying without dry run`
        )

        try {
          const tx = await liquidContract.payment(
            tradeId,
            positionManager,
            amount,
            trade.positionId as string,
            isLiquid,
            signature,
            {
              gasLimit: 500000n,
              gasPrice: ethers.parseUnits('1', 'gwei'),
            }
          )

          this.logger.log(`Liquid transfer transaction sent (no dry run): ${tx.hash}`)
          return tx.hash
        } catch (retryError) {
          const retryDecodedError: DecodedError = await decoder.decode(retryError)
          this.logger.error(`Retry failed for liquid transfer tradeId ${tradeId}!\nReason: ${retryDecodedError.reason}`)
          throw retryError
        }
      }

      this.logger.error(
        `Processing liquid transfer tradeId ${tradeId} Execution reverted!\nReason: ${decodedError.reason}`
      )

      throw error
    }
  }

  private async handleTokenApproval(
    tokenAddress: string,
    spenderAddress: string,
    amount: bigint,
    token: Token,
    wallet: ethers.Wallet,
    assetProvider: ethers.JsonRpcProvider
  ): Promise<void> {
    const erc20Contract = ERC20__factory.connect(tokenAddress, assetProvider)
    const currentAllowance = await erc20Contract.allowance(wallet.address, spenderAddress)
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

      const updatedAllowance = await erc20Contract.allowance(wallet.address, spenderAddress)

      if (updatedAllowance < requiredAmount) {
        throw new Error(
          `Insufficient token spending allowance. Please increase your approve limit. ` +
            `Current allowance: ${ethers.formatUnits(updatedAllowance, token.tokenDecimals)} ${token.tokenSymbol}\n` +
            `Required allowance: ${amount} ${token.tokenSymbol}`
        )
      }
    }
  }

  private shouldRetryWithoutDryRun(error: any, decodedError: DecodedError): boolean {
    const errorData = error?.data || error?.transaction?.data || decodedError?.data
    if (!errorData) return false

    const selector = errorData.slice(0, 10)
    return this.retrySelectors.includes(selector)
  }

  private getLiquidationPaymentAddress(networkId: string) {
    const paymentAddress = config.getLiquidationAddress(networkId)
    if (!paymentAddress) {
      throw new Error(`Unsupported networkId: ${networkId}`)
    }

    return paymentAddress
  }
}
