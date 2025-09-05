import { Inject, Injectable } from '@nestjs/common'

import {
  CreateTradeData,
  ITradeRepository,
  ITradeService,
  TradeEntity,
  TradeStatus,
  UpdateTradeQuoteData,
} from '../../domain'
import { TRADE_REPOSITORY } from '../../infras'

@Injectable()
export class TradeService implements ITradeService {
  constructor(@Inject(TRADE_REPOSITORY) private readonly tradeRepository: ITradeRepository) {}

  // Domain interface implementation - uses pure domain types
  async createTrade(data: CreateTradeData): Promise<TradeEntity> {
    return this.tradeRepository.create(data)
  }

  async deleteTrade(tradeId: string): Promise<void> {
    return this.tradeRepository.delete(tradeId)
  }

  async findTradeById(tradeId: string): Promise<TradeEntity | null> {
    return this.tradeRepository.findById(tradeId)
  }

  async updateTradeQuote(tradeId: string, data: UpdateTradeQuoteData): Promise<TradeEntity> {
    return this.tradeRepository.updateQuote(tradeId, data)
  }

  async updateTradeStatus(tradeId: string, status: TradeStatus, error?: string): Promise<TradeEntity> {
    return this.tradeRepository.updateStatus(tradeId, status, error)
  }
}
