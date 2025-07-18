import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Token, tokenService } from '@optimex-xyz/market-maker-sdk'

import { ethers } from 'ethers'

import { TokenRepository } from './token.repository'

@Injectable()
export class TokenService {
  private readonly MIN_TRADE: number
  private readonly SOFT_CAP: number
  private readonly HARD_CAP: number
  private readonly COMMITMENT_BPS: number
  private readonly INDICATIVE_BPS: number

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenRepo: TokenRepository
  ) {
    this.MIN_TRADE = Number(this.configService.getOrThrow<string>('MIN_TRADE'))
    this.SOFT_CAP = Number(this.configService.getOrThrow<string>('SOFT_CAP'))
    this.HARD_CAP = Number(this.configService.getOrThrow<string>('HARD_CAP'))
    this.COMMITMENT_BPS = Number(this.configService.getOrThrow<string>('COMMITMENT_BPS', '9000'))
    this.INDICATIVE_BPS = Number(this.configService.getOrThrow<string>('INDICATIVE_BPS', '9000'))
  }

  async validateIndicativeAmount(amount: string, token: Token): Promise<void> {
    const tokenPrice = await this.tokenRepo.getTokenPrice(token.tokenSymbol)
    const actualAmount = ethers.formatUnits(amount, token.tokenDecimals)
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

  async validateCommitmentAmount(amount: string, token: Token): Promise<void> {
    const tokenPrice = await this.tokenRepo.getTokenPrice(token.tokenSymbol)
    const actualAmount = ethers.formatUnits(amount, token.tokenDecimals)
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

  async calculateBestQuote(amountIn: string, fromToken: Token, toToken: Token, isCommitment = false): Promise<string> {
    const fromTokenPrice = await this.tokenRepo.getTokenPrice(fromToken.tokenSymbol)
    const toTokenPrice = await this.tokenRepo.getTokenPrice(toToken.tokenSymbol)
    const amount = ethers.getBigInt(amountIn)
    const fromDecimals = ethers.getBigInt(fromToken.tokenDecimals)
    const toDecimals = ethers.getBigInt(toToken.tokenDecimals)
    const fromPrice = ethers.getBigInt(Math.round(fromTokenPrice.currentPrice * 1e6))
    const toPrice = ethers.getBigInt(Math.round(toTokenPrice.currentPrice * 1e6))
    const rawQuote = (amount * fromPrice * 10n ** toDecimals) / (toPrice * 10n ** fromDecimals)
    const baseBps = 10000n
    const bpsMultiplier = isCommitment ? BigInt(this.COMMITMENT_BPS) : BigInt(this.INDICATIVE_BPS)
    const finalQuote = (rawQuote * bpsMultiplier) / baseBps
    return finalQuote.toString()
  }

  async getTokenByTokenId(tokenId: string) {
    return tokenService.getTokenByTokenId(tokenId)
  }
}
