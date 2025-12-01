import { Inject, Injectable } from '@nestjs/common'

import {
  TradeStatus,
  type CreateTradeData,
  type ITradeRepository,
  type ITradeService,
  type Trade,
  type UpdateTradeQuoteData,
} from '../../domain'
import { TRADE_REPOSITORY } from '../../infras'

@Injectable()
export class TradeService implements ITradeService {
  constructor(@Inject(TRADE_REPOSITORY) private readonly tradeRepository: ITradeRepository) {}

  async createTrade(data: CreateTradeData): Promise<void> {
    return this.tradeRepository.create(data)
  }

  async deleteTrade(tradeId: string): Promise<void> {
    return this.tradeRepository.delete(tradeId)
  }

  async findTradeById(tradeId: string): Promise<Trade> {
    return this.tradeRepository.findById(tradeId)
  }

  async updateTradeQuote(tradeId: string, data: UpdateTradeQuoteData): Promise<void> {
    return this.tradeRepository.updateQuote(tradeId, data)
  }

  async updateTradeStatus(tradeId: string, status: TradeStatus, error?: string): Promise<void> {
    return this.tradeRepository.updateStatus(tradeId, status, error)
  }
}
