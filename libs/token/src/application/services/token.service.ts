import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { Token, tokenService } from '@optimex-xyz/market-maker-sdk'

import { ethers } from 'ethers'

import type { ITokenRepository, ITokenService, TokenQuoteCalculationData, TokenValidationData } from '../../domain'
import { TOKEN_REPOSITORY } from '../../infras'

@Injectable()
export class TokenService implements ITokenService {
  private readonly MIN_TRADE: number
  private readonly SOFT_CAP: number
  private readonly HARD_CAP: number
  private readonly COMMITMENT_BPS: number
  private readonly INDICATIVE_BPS: number

  constructor(
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepository: ITokenRepository,
    private readonly configService: CustomConfigService
  ) {
    this.MIN_TRADE = this.configService.trade.min
    this.SOFT_CAP = this.configService.trade.softCap
    this.HARD_CAP = this.configService.trade.hardCap
    this.COMMITMENT_BPS = this.configService.trade.commitmentBps
    this.INDICATIVE_BPS = this.configService.trade.indicativeBps
  }

  /**
   * Validates token amount against min/max limits
   * @private
   */
  private async validateAmount(
    validationData: TokenValidationData,
    minAmount: number,
    maxAmount: number,
    maxAmountName: string
  ): Promise<void> {
    const token = await this.getTokenByTokenId(validationData.tokenId)
    if (!token) {
      throw new BadRequestException(`Token with ID ${validationData.tokenId} not found`)
    }

    const tokenPrice = await this.tokenRepository.getTokenPrice(token.tokenSymbol)
    const actualAmount = ethers.formatUnits(validationData.amount, token.tokenDecimals)
    const amountInUsd = ethers.parseUnits((Number(actualAmount) * tokenPrice).toFixed(2), 2)
    const minTradeAmount = ethers.parseUnits(minAmount.toFixed(2), 2)
    const maxTradeAmount = ethers.parseUnits(maxAmount.toFixed(2), 2)

    if (amountInUsd < minTradeAmount) {
      throw new BadRequestException(
        `Trade amount ${ethers.formatUnits(amountInUsd, 2)} USD is below minimum allowed: ${minAmount} USD`
      )
    }
    if (amountInUsd > maxTradeAmount) {
      const message =
        maxAmountName === 'soft cap'
          ? `Trade amount ${ethers.formatUnits(amountInUsd, 2)} USD exceeds ${maxAmountName}: ${maxAmount} USD. Commitment not allowed.`
          : `Trade amount ${ethers.formatUnits(amountInUsd, 2)} USD exceeds ${maxAmountName}: ${maxAmount} USD`
      throw new BadRequestException(message)
    }
  }

  async validateIndicativeAmount(validationData: TokenValidationData): Promise<void> {
    await this.validateAmount(validationData, this.MIN_TRADE, this.HARD_CAP, 'hard cap')
  }

  async validateCommitmentAmount(validationData: TokenValidationData): Promise<void> {
    await this.validateAmount(validationData, this.MIN_TRADE, this.SOFT_CAP, 'soft cap')
  }

  async calculateBestQuote(calculationData: TokenQuoteCalculationData): Promise<string> {
    const fromToken = await this.getTokenByTokenId(calculationData.fromTokenId)
    const toToken = await this.getTokenByTokenId(calculationData.toTokenId)

    if (!fromToken || !toToken) {
      throw new BadRequestException('One or both tokens not found')
    }

    const fromTokenPrice = await this.tokenRepository.getTokenPrice(fromToken.tokenSymbol)
    const toTokenPrice = await this.tokenRepository.getTokenPrice(toToken.tokenSymbol)
    const amount = ethers.getBigInt(calculationData.amountIn)
    const fromDecimals = ethers.getBigInt(fromToken.tokenDecimals)
    const toDecimals = ethers.getBigInt(toToken.tokenDecimals)
    const fromPrice = ethers.getBigInt(Math.round(fromTokenPrice * 1e6))
    const toPrice = ethers.getBigInt(Math.round(toTokenPrice * 1e6))
    const rawQuote = (amount * fromPrice * 10n ** toDecimals) / (toPrice * 10n ** fromDecimals)
    const baseBps = 10000n
    const bpsMultiplier = calculationData.isCommitment ? BigInt(this.COMMITMENT_BPS) : BigInt(this.INDICATIVE_BPS)
    const finalQuote = (rawQuote * bpsMultiplier) / baseBps
    return finalQuote.toString()
  }

  async getTokenByTokenId(tokenId: string): Promise<Token | null> {
    return tokenService.getTokenByTokenId(tokenId)
  }

  async getTokenPrice(symbol: string): Promise<number> {
    return this.tokenRepository.getTokenPrice(symbol)
  }
}
