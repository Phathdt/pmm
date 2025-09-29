import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ReqService } from '@optimex-pmm/req'

import { CoinGeckoApiParams, CoinGeckoToken, ITokenRepository, TokenPrice } from '../../domain'

function normalizeSymbol(symbol: string): string {
  switch (symbol.toUpperCase()) {
    case 'TBTC':
      return 'BTC'
    case 'WETH':
      return 'ETH'
    case 'WSOL':
      return 'SOL'
    default:
      return symbol
  }
}

@Injectable()
export class TokenRemoteRepository implements ITokenRepository {
  private readonly CACHE_KEY = 'token_data'
  private readonly TTL = 60 * 1000
  private readonly logger = new Logger(TokenRemoteRepository.name)

  constructor(
    @Inject('COINGECKO_REQ_SERVICE') private readonly reqService: ReqService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async getTokenPrice(symbol: string): Promise<TokenPrice> {
    const targetSymbol = normalizeSymbol(symbol)
    const tokens = await this.getTokens()

    const token = tokens.find((t) => t.symbol.toLowerCase() === targetSymbol.toLowerCase())

    if (!token) {
      throw new NotFoundException(`cannot find token info for symbol ${symbol}`)
    }

    return {
      id: token.id,
      symbol: token.symbol,
      name: token.name,
      image: token.image,
      currentPrice: token.currentPrice,
      marketCap: token.marketCap,
    }
  }

  async getTokens(params?: CoinGeckoApiParams): Promise<CoinGeckoToken[]> {
    let tokens = await this.getFromCache()
    if (!tokens) {
      tokens = await this.fetchAndCacheTokens(params)
    }
    return tokens
  }

  async getFromCache(): Promise<CoinGeckoToken[] | null> {
    const cachedData = await this.cacheManager.get<string>(this.CACHE_KEY)
    return cachedData ? JSON.parse(cachedData) : null
  }

  async fetchAndCacheTokens(params?: CoinGeckoApiParams): Promise<CoinGeckoToken[]> {
    const defaultParams: CoinGeckoApiParams = {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: 100,
      page: 1,
      sparkline: false,
    }

    const queryParams = { ...defaultParams, ...params }

    try {
      const response = await this.reqService.get<CoinGeckoToken[]>({
        url: '/coins/markets',
        params: queryParams,
      })

      await this.cacheManager.set(this.CACHE_KEY, JSON.stringify(response), this.TTL)

      return response
    } catch (error: unknown) {
      this.logger.error({
        message: 'Error fetching tokens from CoinGecko API',
        error: error instanceof Error ? error.message : String(error),
        operation: 'token_fetch',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })
      return []
    }
  }
}
