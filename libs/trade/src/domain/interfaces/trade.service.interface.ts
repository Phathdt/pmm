import { TradeEntity, TradeStatus } from '../entities'
import { CreateTradeData, UpdateTradeQuoteData } from '../schemas'

export interface ITradeService {
  createTrade(data: CreateTradeData): Promise<TradeEntity>
  deleteTrade(tradeId: string): Promise<void>
  findTradeById(tradeId: string): Promise<TradeEntity | null>
  updateTradeQuote(tradeId: string, data: UpdateTradeQuoteData): Promise<TradeEntity>
  updateTradeStatus(tradeId: string, status: TradeStatus, error?: string): Promise<TradeEntity>
}
