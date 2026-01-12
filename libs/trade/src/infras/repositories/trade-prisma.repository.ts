import { Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService, Trade as TradePrisma } from '@optimex-pmm/database'

import {
  CreateTradeData,
  ITradeRepository,
  Trade,
  TradeStatus,
  TradeTypeEnum,
  UpdateStatusOptions,
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

  async updateStatus(tradeId: string, status: TradeStatus, options?: UpdateStatusOptions): Promise<void> {
    await this.db.trade.update({
      where: { tradeId },
      data: {
        status,
        ...(options?.error && { error: options.error }),
        ...(options?.settlementTxId && { settlementTx: options.settlementTxId }),
        // Set completedAt when trade becomes COMPLETED
        ...(status === TradeStatus.COMPLETED && { completedAt: new Date() }),
      },
    })
  }

  async delete(tradeId: string): Promise<void> {
    await this.db.trade.deleteMany({
      where: { tradeId },
    })
  }

  async findSettlingTrades(): Promise<Trade[]> {
    // Only query LENDING trades created within the last 3 days
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const results = await this.db.trade.findMany({
      where: {
        status: TradeStatus.SETTLING,
        tradeType: TradeTypeEnum.LENDING,
        createdAt: {
          gte: threeDaysAgo,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })

    return results.map((r) => this.toEntity(r))
  }

  async findBtcLiquidationTrades(): Promise<Trade[]> {
    const results = await this.db.trade.findMany({
      where: {
        fromNetworkId: {
          in: ['btc', 'btc_testnet'],
        },
        isLiquid: true,
        status: TradeStatus.COMPLETED,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return results.map((r) => this.toEntity(r))
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
      isLiquid: data.isLiquid,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      completedAt: data.completedAt ?? undefined,
    }
  }
}
