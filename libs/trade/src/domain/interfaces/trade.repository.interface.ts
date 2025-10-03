import { Trade, TradeStatus } from '../entities'
import { CreateTradeData, UpdateTradeQuoteData } from '../schemas'

export interface ITradeRepository {
  create(data: CreateTradeData): Promise<void>
  findById(tradeId: string): Promise<Trade>
  updateQuote(tradeId: string, data: UpdateTradeQuoteData): Promise<void>
  updateStatus(tradeId: string, status: TradeStatus, error?: string): Promise<void>
  delete(tradeId: string): Promise<void>
}
