export interface ITokenRepository {
  getTokenPrice(symbol: string): Promise<number>
}
