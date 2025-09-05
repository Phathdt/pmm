import { TradeEntity, TradeStatus } from '../entities'
import { CreateTradeData, UpdateTradeQuoteData } from '../schemas'

export interface ITradeRepository {
  create(data: CreateTradeData): Promise<TradeEntity>
  findById(tradeId: string): Promise<TradeEntity | null>
  updateQuote(tradeId: string, data: UpdateTradeQuoteData): Promise<TradeEntity>
  updateStatus(tradeId: string, status: TradeStatus, error?: string): Promise<TradeEntity>
  delete(tradeId: string): Promise<void>
}
