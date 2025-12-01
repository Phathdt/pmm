import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'

import { PriceProvider, type ITokenPriceProvider, type ITokenRepository } from '../../domain'
import { normalizeSymbol } from '../../utils'
import { BinancePriceProvider, CoinGeckoPriceProvider } from '../providers'

// Stablecoins pegged to USD (always 1.0)
const STABLECOINS = ['USDT', 'USDC']

@Injectable()
export class TokenRemoteRepository implements ITokenRepository {
  private readonly CACHE_PREFIX = 'optimex:token:price'
  private readonly TTL = 60 * 1000 // 1 minute
  private readonly logger = new Logger(TokenRemoteRepository.name)
  private readonly providers: ITokenPriceProvider[]

  constructor(
    private readonly coinGeckoProvider: CoinGeckoPriceProvider,
    private readonly binanceProvider: BinancePriceProvider,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {
    // Priority order: CoinGecko first (more data), then Binance (faster, but less data)
    this.providers = [this.coinGeckoProvider, this.binanceProvider]
  }

  async getTokenPrice(symbol: string): Promise<number> {
    const normalizedSymbol = normalizeSymbol(symbol)

    // Handle stablecoins - always return 1.0 without API calls
    if (STABLECOINS.includes(normalizedSymbol)) {
      this.logger.debug({
        message: 'Stablecoin detected, returning 1.0',
        symbol,
        normalizedSymbol,
      })
      return 1.0
    }

    // Check cache first (single point of caching)
    const cacheKey = `${this.CACHE_PREFIX}:${normalizedSymbol}`
    const cachedPrice = await this.cacheManager.get<number>(cacheKey)

    if (cachedPrice !== null && cachedPrice !== undefined) {
      this.logger.debug({
        message: 'Cache hit for token price',
        symbol,
        normalizedSymbol,
        cachedPrice,
      })
      return cachedPrice
    }

    // Cache miss - race providers for fresh data
    this.logger.debug({
      message: 'Cache miss - racing providers for fresh price',
      symbol,
      normalizedSymbol,
      providerCount: this.providers.length,
    })

    const price = await this.raceProviders(symbol)

    // Cache the result
    await this.cacheManager.set(cacheKey, price, this.TTL)

    this.logger.debug({
      message: 'Cached token price',
      symbol,
      normalizedSymbol,
      price,
      ttl: this.TTL,
    })

    return price
  }

  private async raceProviders(symbol: string): Promise<number> {
    const TIMEOUT_MS = 3000

    // Call all providers simultaneously with proper race strategy
    const providerPromises = this.providers.map((provider) =>
      Promise.race([
        provider.getTokenPrice(symbol).then((price) => ({
          success: true as const,
          price,
          provider: provider.name,
        })),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Provider ${provider.name} timed out`)), TIMEOUT_MS)
        ),
      ]).catch((error: unknown) => ({
        success: false as const,
        error: error instanceof Error ? error.message : String(error),
        provider: provider.name,
      }))
    )

    try {
      // Use allSettled to get all results regardless of failures
      const results = await Promise.allSettled(providerPromises)

      // Extract successful and failed results
      const settledResults = results
        .filter((r): r is PromiseFulfilledResult<Awaited<(typeof providerPromises)[0]>> => r.status === 'fulfilled')
        .map((r) => r.value)

      // Prefer CoinGecko if it succeeded (primary provider)
      const coinGeckoResult = settledResults.find((r) => r.success && r.provider === PriceProvider.COINGECKO)
      if (coinGeckoResult?.success) {
        this.logger.log({
          message: 'Successfully fetched token price from CoinGecko',
          symbol,
          provider: coinGeckoResult.provider,
          price: coinGeckoResult.price,
        })
        return coinGeckoResult.price
      }

      // Fallback to any successful provider
      const successResult = settledResults.find((r) => r.success)
      if (successResult?.success) {
        this.logger.log({
          message: 'Successfully fetched token price',
          symbol,
          provider: successResult.provider,
          price: successResult.price,
        })
        return successResult.price
      }

      // All providers failed - collect errors with proper type narrowing
      const errors = settledResults
        .filter((r): r is { success: false; error: string; provider: PriceProvider } => !r.success)
        .map((r) => ({
          provider: r.provider,
          error: r.error,
        }))

      this.logger.error({
        message: 'All price providers failed',
        symbol,
        errors,
      })

      throw new NotFoundException(`cannot find token price for symbol ${symbol} from any provider`)
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error
      }

      this.logger.error({
        message: 'Unexpected error fetching token price',
        symbol,
        error: error instanceof Error ? error.message : String(error),
      })

      throw new NotFoundException(`Failed to fetch price for symbol ${symbol}`)
    }
  }
}
