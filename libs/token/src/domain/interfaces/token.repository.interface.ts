import { CoinGeckoToken, TokenPrice } from '../entities'
import { CoinGeckoApiParams } from '../schemas'

export interface ITokenRepository {
  getTokenPrice(symbol: string): Promise<TokenPrice>
  getTokens(params?: CoinGeckoApiParams): Promise<CoinGeckoToken[]>
  getFromCache(): Promise<CoinGeckoToken[] | null>
  fetchAndCacheTokens(params?: CoinGeckoApiParams): Promise<CoinGeckoToken[]>
}
