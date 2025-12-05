import { Trade, TradeStatus } from '../entities'
import { CreateTradeData, UpdateTradeQuoteData } from '../schemas'

export interface UpdateStatusOptions {
  error?: string
  settlementTxId?: string
}

export interface ITradeRepository {
  create(data: CreateTradeData): Promise<void>
  findById(tradeId: string): Promise<Trade>
  updateQuote(tradeId: string, data: UpdateTradeQuoteData): Promise<void>
  updateStatus(tradeId: string, status: TradeStatus, options?: UpdateStatusOptions): Promise<void>
  delete(tradeId: string): Promise<void>
  findSettlingTrades(): Promise<Trade[]>
  findBtcLiquidationTrades(): Promise<Trade[]>
}
