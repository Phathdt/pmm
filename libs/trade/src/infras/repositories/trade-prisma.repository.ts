import { Injectable } from '@nestjs/common'
import { DatabaseService } from '@optimex-pmm/database'
import { Trade } from '@prisma/client'

import {
  CreateTradeData,
  ITradeRepository,
  TradeEntity,
  TradeStatus,
  TradeTypeEnum,
  UpdateTradeQuoteData,
} from '../../domain'

@Injectable()
export class TradePrismaRepository implements ITradeRepository {
  constructor(private db: DatabaseService) {}

  async create(data: CreateTradeData): Promise<TradeEntity> {
    const trade = await this.db.trade.create({
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
        isLiquid: data.isLiquid || false,
        positionId: data.positionId,
        liquidationId: data.liquidationId,
        apm: data.apm,
        validatorSignature: data.validatorSignature,
        tradeType: data.tradeType || TradeTypeEnum.SWAP,
        metadata: data.metadata as never,
      },
    })

    return this.mapToEntity(trade)
  }

  async findById(tradeId: string): Promise<TradeEntity | null> {
    const trade = await this.db.trade.findUnique({
      where: { tradeId },
    })

    return trade ? this.mapToEntity(trade) : null
  }

  async updateQuote(tradeId: string, data: UpdateTradeQuoteData): Promise<TradeEntity> {
    const trade = await this.db.trade.update({
      where: { tradeId },
      data: {
        ...data,
        status: TradeStatus.QUOTE_PROVIDED,
      },
    })

    return this.mapToEntity(trade)
  }

  async updateStatus(tradeId: string, status: TradeStatus, error?: string): Promise<TradeEntity> {
    const trade = await this.db.trade.update({
      where: { tradeId },
      data: {
        status,
        ...(error && { error }),
      },
    })

    return this.mapToEntity(trade)
  }

  async delete(tradeId: string): Promise<void> {
    await this.db.trade.deleteMany({
      where: { tradeId },
    })
  }

  private mapToEntity(trade: Trade): TradeEntity {
    return {
      id: trade.id,
      tradeId: trade.tradeId,
      fromTokenId: trade.fromTokenId,
      fromNetworkId: trade.fromNetworkId,
      toTokenId: trade.toTokenId,
      toNetworkId: trade.toNetworkId,
      fromUser: trade.fromUser,
      toUser: trade.toUser,
      amount: trade.amount,
      status: trade.status as TradeStatus,
      userDepositTx: trade.userDepositTx ?? undefined,
      userDepositVault: trade.userDepositVault ?? undefined,
      tradeDeadline: trade.tradeDeadline ?? undefined,
      scriptDeadline: trade.scriptDeadline ?? undefined,
      isLiquid: trade.isLiquid,
      positionId: trade.positionId ?? undefined,
      liquidationId: trade.liquidationId ?? undefined,
      apm: trade.apm ?? undefined,
      validatorSignature: trade.validatorSignature ?? undefined,
      tradeType: trade.tradeType as TradeTypeEnum,
      indicativeQuote: trade.indicativeQuote ?? undefined,
      commitmentQuote: trade.commitmentQuote ?? undefined,
      settlementQuote: trade.settlementQuote ?? undefined,
      executedPriceUsd: trade.executedPriceUsd ?? undefined,
      settlementTx: trade.settlementTx ?? undefined,
      error: trade.error ?? undefined,
      metadata: trade.metadata as Record<string, unknown> | undefined,
      createdAt: trade.createdAt,
      updatedAt: trade.updatedAt,
    }
  }
}
