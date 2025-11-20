export enum PriceProvider {
  COINGECKO = 'coingecko',
  BINANCE = 'binance',
}

export interface ITokenPriceProvider {
  readonly name: PriceProvider
  getTokenPrice(symbol: string): Promise<number>
}
