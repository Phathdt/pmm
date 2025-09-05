import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Token, tokenService } from '@optimex-xyz/market-maker-sdk'

import { ethers } from 'ethers'

import {
  ITokenRepository,
  ITokenService,
  TokenPrice,
  TokenQuoteCalculationData,
  TokenValidationData,
} from '../../domain'
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
    private readonly configService: ConfigService
  ) {
    this.MIN_TRADE = Number(this.configService.getOrThrow<string>('MIN_TRADE'))
    this.SOFT_CAP = Number(this.configService.getOrThrow<string>('SOFT_CAP'))
    this.HARD_CAP = Number(this.configService.getOrThrow<string>('HARD_CAP'))
    this.COMMITMENT_BPS = Number(this.configService.getOrThrow<string>('COMMITMENT_BPS', '9000'))
    this.INDICATIVE_BPS = Number(this.configService.getOrThrow<string>('INDICATIVE_BPS', '9000'))
  }

  async validateIndicativeAmount(validationData: TokenValidationData): Promise<void> {
    const token = await this.getTokenByTokenId(validationData.tokenId)
    if (!token) {
      throw new BadRequestException(`Token with ID ${validationData.tokenId} not found`)
    }

    const tokenPrice = await this.tokenRepository.getTokenPrice(token.tokenSymbol)
    const actualAmount = ethers.formatUnits(validationData.amount, token.tokenDecimals)
    const amountInUsd = ethers.parseUnits((Number(actualAmount) * tokenPrice.currentPrice).toFixed(2), 2)
    const minTradeAmount = ethers.parseUnits(this.MIN_TRADE.toFixed(2), 2)
    const hardCapAmount = ethers.parseUnits(this.HARD_CAP.toFixed(2), 2)

    if (amountInUsd < minTradeAmount) {
      throw new BadRequestException(
        `Trade amount ${ethers.formatUnits(amountInUsd, 2)} USD is below minimum allowed: ${this.MIN_TRADE} USD`
      )
    }
    if (amountInUsd > hardCapAmount) {
      throw new BadRequestException(
        `Trade amount ${ethers.formatUnits(amountInUsd, 2)} USD exceeds hard cap: ${this.HARD_CAP} USD`
      )
    }
  }

  async validateCommitmentAmount(validationData: TokenValidationData): Promise<void> {
    const token = await this.getTokenByTokenId(validationData.tokenId)
    if (!token) {
      throw new BadRequestException(`Token with ID ${validationData.tokenId} not found`)
    }

    const tokenPrice = await this.tokenRepository.getTokenPrice(token.tokenSymbol)
    const actualAmount = ethers.formatUnits(validationData.amount, token.tokenDecimals)
    const amountInUsd = ethers.parseUnits((Number(actualAmount) * tokenPrice.currentPrice).toFixed(2), 2)
    const minTradeAmount = ethers.parseUnits(this.MIN_TRADE.toFixed(2), 2)
    const softCapAmount = ethers.parseUnits(this.SOFT_CAP.toFixed(2), 2)

    if (amountInUsd < minTradeAmount) {
      throw new BadRequestException(
        `Trade amount ${ethers.formatUnits(amountInUsd, 2)} USD is below minimum allowed: ${this.MIN_TRADE} USD`
      )
    }
    if (amountInUsd > softCapAmount) {
      throw new BadRequestException(
        `Trade amount ${ethers.formatUnits(amountInUsd, 2)} USD exceeds soft cap: ${this.SOFT_CAP} USD. Commitment not allowed.`
      )
    }
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
    const fromPrice = ethers.getBigInt(Math.round(fromTokenPrice.currentPrice * 1e6))
    const toPrice = ethers.getBigInt(Math.round(toTokenPrice.currentPrice * 1e6))
    const rawQuote = (amount * fromPrice * 10n ** toDecimals) / (toPrice * 10n ** fromDecimals)
    const baseBps = 10000n
    const bpsMultiplier = calculationData.isCommitment ? BigInt(this.COMMITMENT_BPS) : BigInt(this.INDICATIVE_BPS)
    const finalQuote = (rawQuote * bpsMultiplier) / baseBps
    return finalQuote.toString()
  }

  async getTokenByTokenId(tokenId: string): Promise<Token | null> {
    return tokenService.getTokenByTokenId(tokenId)
  }

  async getTokenPrice(symbol: string): Promise<TokenPrice> {
    return this.tokenRepository.getTokenPrice(symbol)
  }
}
