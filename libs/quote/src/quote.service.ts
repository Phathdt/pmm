import * as crypto from 'crypto'
import { BadRequestException, HttpException, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ITokenService, TOKEN_SERVICE } from '@optimex-pmm/token'
import { ITradeService, TRADE_SERVICE, TradeTypeEnum } from '@optimex-pmm/trade'
import { Token } from '@optimex-xyz/market-maker-sdk'

import { QuoteSessionRepository } from './quote-session.repository'
import {
  CommitmentQuoteResponse,
  GetCommitmentQuoteDto,
  GetIndicativeQuoteDto,
  GetLiquidationQuoteDto,
  IndicativeQuoteResponse,
  LiquidationQuoteResponse,
} from './quote.dto'

@Injectable()
export class QuoteService {
  private readonly EVM_ADDRESS: string
  private readonly BTC_ADDRESS: string
  private readonly PMM_SOLANA_ADDRESS: string
  private readonly ONLY_SOLANA: boolean

  constructor(
    @Inject(TRADE_SERVICE) private readonly tradeService: ITradeService,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    private readonly configService: ConfigService,
    private readonly sessionRepo: QuoteSessionRepository
  ) {
    this.EVM_ADDRESS = this.configService.getOrThrow<string>('PMM_EVM_ADDRESS')
    this.BTC_ADDRESS = this.configService.getOrThrow<string>('PMM_BTC_ADDRESS')
    this.PMM_SOLANA_ADDRESS = this.configService.getOrThrow<string>('PMM_SOLANA_ADDRESS')
    this.ONLY_SOLANA = this.configService.get<string>('ONLY_SOLANA') === 'true'
  }

  private getPmmAddressByNetworkType(token: Token): string {
    switch (token.networkType.toUpperCase()) {
      case 'EVM':
        return this.EVM_ADDRESS
      case 'BTC':
      case 'TBTC':
        return this.BTC_ADDRESS
      case 'SOLANA':
        return this.PMM_SOLANA_ADDRESS
      default:
        throw new BadRequestException(`Unsupported network type: ${token.networkType}`)
    }
  }

  private generateSessionId(): string {
    return crypto.randomBytes(16).toString('hex')
  }

  private validateSolanaRequirement(fromToken: Token, toToken: Token) {
    if (!this.ONLY_SOLANA) {
      return
    }

    const isFromTokenSolana = fromToken.networkType.toUpperCase() === 'SOLANA'
    const isToTokenSolana = toToken.networkType.toUpperCase() === 'SOLANA'

    if (!isFromTokenSolana && !isToTokenSolana) {
      throw new Error('At least one token must be on the Solana network. Please check your token IDs.')
    }
  }

  async getIndicativeQuote(dto: GetIndicativeQuoteDto): Promise<IndicativeQuoteResponse> {
    const sessionId = dto.sessionId || this.generateSessionId()
    try {
      const [fromToken, toToken] = await Promise.all([
        this.tokenService.getTokenByTokenId(dto.fromTokenId),
        this.tokenService.getTokenByTokenId(dto.toTokenId),
      ]).catch((error) => {
        throw new BadRequestException(`Failed to fetch tokens: ${error.message}`)
      })

      if (!fromToken) {
        throw new BadRequestException(`From token not found: ${dto.fromTokenId}`)
      }
      if (!toToken) {
        throw new BadRequestException(`To token not found: ${dto.toTokenId}`)
      }

      this.validateSolanaRequirement(fromToken, toToken)

      await this.tokenService.validateIndicativeAmount({
        amount: dto.amount,
        tokenId: dto.fromTokenId,
        validationType: 'indicative',
      })

      const quote = await this.tokenService.calculateBestQuote({
        amountIn: dto.amount,
        fromTokenId: dto.fromTokenId,
        toTokenId: dto.toTokenId,
        isCommitment: false,
      })

      const pmmAddress = this.getPmmAddressByNetworkType(fromToken)
      await this.sessionRepo.save(sessionId, {
        fromToken: dto.fromTokenId,
        toToken: dto.toTokenId,
        amount: dto.amount,
        pmmReceivingAddress: pmmAddress,
        indicativeQuote: quote,
      })
      return {
        sessionId,
        pmmReceivingAddress: pmmAddress,
        indicativeQuote: quote,
        error: '',
      }
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      throw new BadRequestException(errorMessage)
    }
  }

  async getCommitmentQuote(dto: GetCommitmentQuoteDto): Promise<CommitmentQuoteResponse> {
    const session = await this.sessionRepo.findById(dto.sessionId)
    if (!session) {
      throw new BadRequestException('Session expired during processing')
    }
    const [fromToken, toToken] = await Promise.all([
      this.tokenService.getTokenByTokenId(dto.fromTokenId),
      this.tokenService.getTokenByTokenId(dto.toTokenId),
    ]).catch((error) => {
      throw new BadRequestException(`Failed to fetch tokens: ${error.message}`)
    })

    if (!fromToken) {
      throw new BadRequestException(`From token not found: ${dto.fromTokenId}`)
    }
    if (!toToken) {
      throw new BadRequestException(`To token not found: ${dto.toTokenId}`)
    }

    this.validateSolanaRequirement(fromToken, toToken)

    await this.tokenService.validateCommitmentAmount({
      amount: dto.amount,
      tokenId: dto.fromTokenId,
      validationType: 'commitment',
    })

    await this.tradeService.deleteTrade(dto.tradeId)

    const quote = await this.tokenService.calculateBestQuote({
      amountIn: dto.amount,
      fromTokenId: dto.fromTokenId,
      toTokenId: dto.toTokenId,
      isCommitment: true,
    })

    await this.tradeService.createTrade({
      tradeId: dto.tradeId,
      fromTokenId: dto.fromTokenId,
      toTokenId: dto.toTokenId,
      fromUser: dto.fromUserAddress,
      toUser: dto.toUserAddress,
      amount: dto.amount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      userDepositTx: dto.userDepositTx,
      userDepositVault: dto.userDepositVault,
      tradeDeadline: dto.tradeDeadline,
      scriptDeadline: dto.scriptDeadline,
      tradeType: TradeTypeEnum.SWAP,
    })

    await this.tradeService.updateTradeQuote(dto.tradeId, {
      commitmentQuote: quote,
    })
    return {
      tradeId: dto.tradeId,
      commitmentQuote: quote,
      error: '',
    }
  }

  async getLiquidationQuote(dto: GetLiquidationQuoteDto): Promise<LiquidationQuoteResponse> {
    const session = await this.sessionRepo.findById(dto.sessionId)
    if (!session) {
      throw new BadRequestException('Session expired during processing')
    }

    const [fromToken, toToken] = await Promise.all([
      this.tokenService.getTokenByTokenId(dto.fromTokenId),
      this.tokenService.getTokenByTokenId(dto.toTokenId),
    ]).catch((error) => {
      throw new BadRequestException(`Failed to fetch tokens: ${error.message}`)
    })

    if (!fromToken) {
      throw new BadRequestException(`From token not found: ${dto.fromTokenId}`)
    }
    if (!toToken) {
      throw new BadRequestException(`To token not found: ${dto.toTokenId}`)
    }

    this.validateSolanaRequirement(fromToken, toToken)

    await this.tokenService.validateCommitmentAmount({
      amount: dto.amount,
      tokenId: dto.fromTokenId,
      validationType: 'commitment',
    })

    await this.tradeService.deleteTrade(dto.tradeId)

    const quote = await this.tokenService.calculateBestQuote({
      amountIn: dto.amount,
      fromTokenId: dto.fromTokenId,
      toTokenId: dto.toTokenId,
      isCommitment: true,
    })

    await this.tradeService.createTrade({
      tradeId: dto.tradeId,
      fromTokenId: dto.fromTokenId,
      toTokenId: dto.toTokenId,
      fromUser: dto.fromUserAddress,
      toUser: dto.toUserAddress,
      amount: dto.amount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      userDepositTx: dto.userDepositTx,
      userDepositVault: dto.userDepositVault,
      tradeDeadline: dto.tradeDeadline,
      scriptDeadline: dto.scriptDeadline,
      tradeType: TradeTypeEnum.LENDING,
      metadata: {
        paymentMetadata: dto.paymentMetadata,
      },
    })

    await this.tradeService.updateTradeQuote(dto.tradeId, {
      commitmentQuote: quote,
    })

    return {
      tradeId: dto.tradeId,
      liquidationQuote: quote,
      error: '',
    }
  }
}
