import { Trade, TradeStatus } from '../entities'
import { CreateTradeData, UpdateTradeQuoteData } from '../schemas'

export interface ITradeService {
  createTrade(data: CreateTradeData): Promise<void>
  deleteTrade(tradeId: string): Promise<void>
  findTradeById(tradeId: string): Promise<Trade>
  updateTradeQuote(tradeId: string, data: UpdateTradeQuoteData): Promise<void>
  updateTradeStatus(tradeId: string, status: TradeStatus, error?: string): Promise<void>
}
