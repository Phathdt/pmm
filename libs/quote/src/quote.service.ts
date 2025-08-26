import * as crypto from 'crypto'
import { BadRequestException, HttpException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TokenService } from '@optimex-pmm/token'
import { TradeService, TradeTypeEnum } from '@optimex-pmm/trade'
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
    private readonly configService: ConfigService,
    private readonly tradeService: TradeService,
    private readonly sessionRepo: QuoteSessionRepository,
    private readonly tokenService: TokenService
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
      this.validateSolanaRequirement(fromToken, toToken)

      await this.tokenService.validateIndicativeAmount(dto.amount, fromToken)

      const quote = await this.tokenService.calculateBestQuote(dto.amount, fromToken, toToken, false)

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
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new BadRequestException(error.message)
    }
  }

  async getCommitmentQuote(dto: GetCommitmentQuoteDto): Promise<CommitmentQuoteResponse> {
    try {
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
      this.validateSolanaRequirement(fromToken, toToken)

      await this.tokenService.validateCommitmentAmount(dto.amount, fromToken)

      await this.tradeService.deleteTrade(dto.tradeId)

      const quote = await this.tokenService.calculateBestQuote(dto.amount, fromToken, toToken, true)

      const trade = await this.tradeService
        .createTrade({
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
        .catch((error) => {
          throw new BadRequestException(`Failed to create trade: ${error.message}`)
        })
      await this.tradeService
        .updateTradeQuote(trade.tradeId, {
          commitmentQuote: quote,
        })
        .catch((error) => {
          throw new BadRequestException(`Failed to update trade quote: ${error.message}`)
        })
      return {
        tradeId: dto.tradeId,
        commitmentQuote: quote,
        error: '',
      }
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new BadRequestException(error.message)
    }
  }

  async getLiquidationQuote(dto: GetLiquidationQuoteDto): Promise<LiquidationQuoteResponse> {
    try {
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
      this.validateSolanaRequirement(fromToken, toToken)

      await this.tokenService.validateCommitmentAmount(dto.amount, fromToken)

      await this.tradeService.deleteTrade(dto.tradeId)

      const quote = await this.tokenService.calculateBestQuote(dto.amount, fromToken, toToken, true)

      const trade = await this.tradeService
        .createTrade({
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
          isLiquid: dto.isLiquidate,
          positionId: dto.positionId,
          liquidationId: dto.liquidationId,
          apm: dto.apm,
          validatorSignature: dto.validatorSignature,
          tradeType: TradeTypeEnum.LIQUID,
        })
        .catch((error) => {
          throw new BadRequestException(`Failed to create liquidation trade: ${error.message}`)
        })

      await this.tradeService
        .updateTradeQuote(trade.tradeId, {
          commitmentQuote: quote,
        })
        .catch((error) => {
          throw new BadRequestException(`Failed to update liquidation trade quote: ${error.message}`)
        })

      return {
        tradeId: dto.tradeId,
        liquidationQuote: quote,
        error: '',
      }
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new BadRequestException(error.message)
    }
  }
}
