import { ITransferStrategy } from './transfer-strategy.interface'

/**
 * Factory interface for obtaining the appropriate transfer strategy
 */
export interface ITransferFactory {
  /**
   * Get the appropriate transfer strategy for a network and trade type combination
   * @param networkType The blockchain network type (EVM, BTC, TBTC, SOLANA)
   * @param tradeType The type of trade (swap, lending)
   * @returns The appropriate transfer strategy implementation
   * @throws Error if no strategy exists for the combination
   */
  getStrategy(networkType: string, tradeType: string): ITransferStrategy
}
