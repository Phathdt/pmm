import { Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '@optimex-pmm/database'
import { Trade as TradePrisma } from '@prisma/client'

import {
  CreateTradeData,
  ITradeRepository,
  Trade,
  TradeStatus,
  TradeTypeEnum,
  UpdateTradeQuoteData,
} from '../../domain'

@Injectable()
export class TradePrismaRepository implements ITradeRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(data: CreateTradeData): Promise<void> {
    await this.db.trade.create({
      data: {
        tradeId: data.tradeId,
        fromTokenId: data.fromTokenId,
        fromNetworkId: data.fromNetworkId,
        toTokenId: data.toTokenId,
        toNetworkId: data.toNetworkId,
        fromUser: data.fromUser,
        toUser: data.toUser,
        amount: data.amount,
        status: TradeStatus.PENDING,
        userDepositTx: data.userDepositTx,
        userDepositVault: data.userDepositVault,
        tradeDeadline: data.tradeDeadline,
        scriptDeadline: data.scriptDeadline,
        tradeType: data.tradeType || TradeTypeEnum.SWAP,
        metadata: data.metadata as never,
      },
    })
  }

  async findById(tradeId: string): Promise<Trade> {
    const trade = await this.db.trade.findUnique({
      where: { tradeId },
    })

    if (!trade) {
      throw new NotFoundException(`Trade with ID '${tradeId}' not found`)
    }

    return this.toEntity(trade)
  }

  async updateQuote(tradeId: string, data: UpdateTradeQuoteData): Promise<void> {
    await this.db.trade.update({
      where: { tradeId },
      data: {
        ...data,
        status: TradeStatus.QUOTE_PROVIDED,
      },
    })
  }

  async updateStatus(tradeId: string, status: TradeStatus, error?: string): Promise<void> {
    await this.db.trade.update({
      where: { tradeId },
      data: {
        status,
        ...(error && { error }),
      },
    })
  }

  async delete(tradeId: string): Promise<void> {
    await this.db.trade.deleteMany({
      where: { tradeId },
    })
  }

  private toEntity(data: TradePrisma): Trade {
    return {
      id: data.id,
      tradeId: data.tradeId,
      fromTokenId: data.fromTokenId,
      fromNetworkId: data.fromNetworkId,
      toTokenId: data.toTokenId,
      toNetworkId: data.toNetworkId,
      fromUser: data.fromUser,
      toUser: data.toUser,
      amount: data.amount,
      status: data.status as TradeStatus,
      userDepositTx: data.userDepositTx ?? undefined,
      userDepositVault: data.userDepositVault ?? undefined,
      tradeDeadline: data.tradeDeadline ?? undefined,
      scriptDeadline: data.scriptDeadline ?? undefined,
      tradeType: data.tradeType as TradeTypeEnum,
      indicativeQuote: data.indicativeQuote ?? undefined,
      commitmentQuote: data.commitmentQuote ?? undefined,
      settlementQuote: data.settlementQuote ?? undefined,
      settlementTx: data.settlementTx ?? undefined,
      error: data.error ?? undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }
}
