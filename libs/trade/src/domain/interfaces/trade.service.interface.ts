import { UpdateStatusOptions } from './trade.repository.interface'

import { Trade, TradeStatus } from '../entities'
import { CreateTradeData, UpdateTradeQuoteData } from '../schemas'

export interface ITradeService {
  createTrade(data: CreateTradeData): Promise<void>
  deleteTrade(tradeId: string): Promise<void>
  findTradeById(tradeId: string): Promise<Trade>
  updateTradeQuote(tradeId: string, data: UpdateTradeQuoteData): Promise<void>
  updateTradeStatus(tradeId: string, status: TradeStatus, options?: UpdateStatusOptions): Promise<void>
  findSettlingTrades(): Promise<Trade[]>
  findBtcLiquidationTrades(): Promise<Trade[]>
}
