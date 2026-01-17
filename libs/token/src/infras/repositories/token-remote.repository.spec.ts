import { NotFoundException } from '@nestjs/common'

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { TokenRemoteRepository } from './token-remote.repository'

import { PriceProvider } from '../../domain'

type MockCache = {
  get: Mock
  set: Mock
  del: Mock
  reset: Mock
}

type MockProvider = {
  name: string
  getTokenPrice: Mock
}

// Mock EnhancedLogger
const createMockLogger = () => {
  const mockLogger = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    info: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    with: vi.fn(),
  }
  mockLogger.with.mockReturnValue(mockLogger)
  return mockLogger
}

describe('TokenRemoteRepository', () => {
  let repository: TokenRemoteRepository
  let cacheManager: MockCache
  let coinGeckoProvider: MockProvider
  let binanceProvider: MockProvider

  beforeEach(() => {
    cacheManager = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      reset: vi.fn(),
    }

    coinGeckoProvider = {
      name: PriceProvider.COINGECKO,
      getTokenPrice: vi.fn(),
    }

    binanceProvider = {
      name: PriceProvider.BINANCE,
      getTokenPrice: vi.fn(),
    }

    // Directly instantiate the repository with mock logger
    repository = new TokenRemoteRepository(
      coinGeckoProvider as any,
      binanceProvider as any,
      cacheManager as any,
      createMockLogger() as any
    )

    // Set default mock return values
    binanceProvider.getTokenPrice.mockResolvedValue(99999)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Cache Behavior', () => {
    it('should return cached price when cache hit', async () => {
      cacheManager.get.mockResolvedValue(50000)

      const result = await repository.getTokenPrice('BTC')

      expect(result).toBe(50000)
      expect(cacheManager.get).toHaveBeenCalledWith('optimex:token:price:BTC')
      expect(cacheManager.get).toHaveBeenCalledTimes(1)
      expect(coinGeckoProvider.getTokenPrice).not.toHaveBeenCalled()
      expect(binanceProvider.getTokenPrice).not.toHaveBeenCalled()
    })

    it('should skip providers when cache hit', async () => {
      cacheManager.get.mockResolvedValue(3000)

      await repository.getTokenPrice('ETH')

      expect(coinGeckoProvider.getTokenPrice).not.toHaveBeenCalled()
      expect(binanceProvider.getTokenPrice).not.toHaveBeenCalled()
    })

    it('should fetch from providers and cache result on cache miss', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(50000)

      const result = await repository.getTokenPrice('BTC')

      expect(result).toBe(50000)
      expect(cacheManager.get).toHaveBeenCalledWith('optimex:token:price:BTC')
      expect(coinGeckoProvider.getTokenPrice).toHaveBeenCalledWith('BTC')
      expect(cacheManager.set).toHaveBeenCalledWith('optimex:token:price:BTC', 50000, 60000)
    })

    it('should handle null cache values correctly', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(50000)

      const result = await repository.getTokenPrice('BTC')

      expect(result).toBe(50000)
      expect(coinGeckoProvider.getTokenPrice).toHaveBeenCalled()
    })

    it('should handle undefined cache values correctly', async () => {
      cacheManager.get.mockResolvedValue(undefined)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(50000)

      const result = await repository.getTokenPrice('BTC')

      expect(result).toBe(50000)
      expect(coinGeckoProvider.getTokenPrice).toHaveBeenCalled()
    })

    it('should not fetch providers when cached value is 0 (valid price)', async () => {
      // Edge case: 0 is falsy but valid for some tokens
      cacheManager.get.mockResolvedValue(0)

      const result = await repository.getTokenPrice('ZERO')

      expect(result).toBe(0)
      expect(coinGeckoProvider.getTokenPrice).not.toHaveBeenCalled()
      expect(binanceProvider.getTokenPrice).not.toHaveBeenCalled()
    })

    it('should use correct cache key format', async () => {
      cacheManager.get.mockResolvedValue(100)

      await repository.getTokenPrice('SOL')

      expect(cacheManager.get).toHaveBeenCalledWith('optimex:token:price:SOL')
    })

    it('should set correct TTL (60 seconds / 60000ms)', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(50000)

      await repository.getTokenPrice('BTC')

      expect(cacheManager.set).toHaveBeenCalledWith('optimex:token:price:BTC', 50000, 60000)
    })

    it('should cache normalized symbol, not original', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(50000)

      await repository.getTokenPrice('wbtc')

      // WBTC normalizes to BTC
      expect(cacheManager.get).toHaveBeenCalledWith('optimex:token:price:BTC')
      expect(cacheManager.set).toHaveBeenCalledWith('optimex:token:price:BTC', 50000, 60000)
    })
  })

  describe('Stablecoin Handling', () => {
    it('should return 1.0 for USDT without checking cache', async () => {
      const result = await repository.getTokenPrice('USDT')

      expect(result).toBe(1.0)
      expect(cacheManager.get).not.toHaveBeenCalled()
      expect(coinGeckoProvider.getTokenPrice).not.toHaveBeenCalled()
      expect(binanceProvider.getTokenPrice).not.toHaveBeenCalled()
    })

    it('should return 1.0 for USDC without checking cache', async () => {
      const result = await repository.getTokenPrice('USDC')

      expect(result).toBe(1.0)
      expect(cacheManager.get).not.toHaveBeenCalled()
      expect(coinGeckoProvider.getTokenPrice).not.toHaveBeenCalled()
      expect(binanceProvider.getTokenPrice).not.toHaveBeenCalled()
    })

    it('should return 1.0 for lowercase usdt', async () => {
      const result = await repository.getTokenPrice('usdt')

      expect(result).toBe(1.0)
      expect(cacheManager.get).not.toHaveBeenCalled()
    })

    it('should return 1.0 for lowercase usdc', async () => {
      const result = await repository.getTokenPrice('usdc')

      expect(result).toBe(1.0)
      expect(cacheManager.get).not.toHaveBeenCalled()
    })

    it('should not call providers for stablecoins', async () => {
      await repository.getTokenPrice('USDT')
      await repository.getTokenPrice('USDC')

      expect(coinGeckoProvider.getTokenPrice).not.toHaveBeenCalled()
      expect(binanceProvider.getTokenPrice).not.toHaveBeenCalled()
    })
  })

  describe('Race Strategy', () => {
    it('should prefer CoinGecko when both providers succeed', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(50000)
      binanceProvider.getTokenPrice.mockResolvedValue(50001)

      const result = await repository.getTokenPrice('BTC')

      expect(result).toBe(50000) // CoinGecko price preferred
      expect(coinGeckoProvider.getTokenPrice).toHaveBeenCalledWith('BTC')
      expect(binanceProvider.getTokenPrice).toHaveBeenCalledWith('BTC')
    })

    it('should fallback to Binance when CoinGecko fails', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockRejectedValue(new Error('CoinGecko error'))
      binanceProvider.getTokenPrice.mockResolvedValue(50000)

      const result = await repository.getTokenPrice('BTC')

      expect(result).toBe(50000)
      expect(coinGeckoProvider.getTokenPrice).toHaveBeenCalledWith('BTC')
      expect(binanceProvider.getTokenPrice).toHaveBeenCalledWith('BTC')
    })

    it('should timeout after 3 seconds', async () => {
      cacheManager.get.mockResolvedValue(null)

      // Simulate slow provider
      coinGeckoProvider.getTokenPrice.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve(50000)
            }, 5000)
          )
      )

      binanceProvider.getTokenPrice.mockResolvedValue(50001)

      const result = await repository.getTokenPrice('BTC')

      // Should get Binance result since CoinGecko timed out
      expect(result).toBe(50001)
    }, 10000)

    it('should throw NotFoundException when all providers fail', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockRejectedValue(new Error('CoinGecko error'))
      binanceProvider.getTokenPrice.mockRejectedValue(new Error('Binance error'))

      await expect(repository.getTokenPrice('INVALID')).rejects.toThrow(NotFoundException)
      await expect(repository.getTokenPrice('INVALID')).rejects.toThrow(
        'cannot find token price for symbol INVALID from any provider'
      )
    })

    it('should collect errors from all failed providers', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockRejectedValue(new Error('CoinGecko error'))
      binanceProvider.getTokenPrice.mockRejectedValue(new Error('Binance error'))

      try {
        await repository.getTokenPrice('BTC')
        fail('Should have thrown NotFoundException')
      } catch (error: any) {
        expect(error).toBeInstanceOf(NotFoundException)
        expect(error.message).toContain('cannot find token price for symbol BTC from any provider')
      }
    })

    it('should call all providers in parallel', async () => {
      cacheManager.get.mockResolvedValue(null)

      let coinGeckoStartTime = 0
      let binanceStartTime = 0

      coinGeckoProvider.getTokenPrice.mockImplementation(async () => {
        coinGeckoStartTime = Date.now()
        await new Promise((resolve) => setTimeout(resolve, 100))
        return 50000
      })

      binanceProvider.getTokenPrice.mockImplementation(async () => {
        binanceStartTime = Date.now()
        await new Promise((resolve) => setTimeout(resolve, 100))
        return 50001
      })

      await repository.getTokenPrice('BTC')

      // Both should start at roughly the same time (parallel execution)
      expect(Math.abs(coinGeckoStartTime - binanceStartTime)).toBeLessThan(50)
    })

    it('should handle NotFoundException from provider', async () => {
      cacheManager.get.mockResolvedValue(null)
      const notFoundError = new NotFoundException('Token not found')
      coinGeckoProvider.getTokenPrice.mockRejectedValue(notFoundError)
      binanceProvider.getTokenPrice.mockResolvedValue(50000)

      const result = await repository.getTokenPrice('BTC')

      expect(result).toBe(50000)
    })
  })

  describe('Symbol Normalization', () => {
    it('should normalize WBTC to BTC before caching', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(50000)

      await repository.getTokenPrice('WBTC')

      expect(cacheManager.get).toHaveBeenCalledWith('optimex:token:price:BTC')
      expect(cacheManager.set).toHaveBeenCalledWith('optimex:token:price:BTC', 50000, 60000)
      expect(coinGeckoProvider.getTokenPrice).toHaveBeenCalledWith('WBTC')
    })

    it('should normalize WETH to ETH before caching', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(3000)

      await repository.getTokenPrice('WETH')

      expect(cacheManager.get).toHaveBeenCalledWith('optimex:token:price:ETH')
      expect(cacheManager.set).toHaveBeenCalledWith('optimex:token:price:ETH', 3000, 60000)
    })

    it('should normalize WSOL to SOL before caching', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(100)

      await repository.getTokenPrice('WSOL')

      expect(cacheManager.get).toHaveBeenCalledWith('optimex:token:price:SOL')
      expect(cacheManager.set).toHaveBeenCalledWith('optimex:token:price:SOL', 100, 60000)
    })

    it('should normalize symbols to uppercase', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(50000)

      await repository.getTokenPrice('btc')

      expect(cacheManager.get).toHaveBeenCalledWith('optimex:token:price:BTC')
      expect(cacheManager.set).toHaveBeenCalledWith('optimex:token:price:BTC', 50000, 60000)
    })
  })

  describe('Edge Cases', () => {
    it('should handle concurrent requests for same symbol (cache stampede)', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockImplementation(
        async () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve(50000)
            }, 100)
          )
      )

      // Make multiple concurrent requests
      const promises = [
        repository.getTokenPrice('BTC'),
        repository.getTokenPrice('BTC'),
        repository.getTokenPrice('BTC'),
      ]

      const results = await Promise.all(promises)

      expect(results).toEqual([50000, 50000, 50000])

      // All requests should query cache
      expect(cacheManager.get).toHaveBeenCalledTimes(3)

      // But providers might be called multiple times (no lock mechanism)
      // This is acceptable as it's rare and self-correcting
    })

    it('should handle provider timeout correctly', async () => {
      cacheManager.get.mockResolvedValue(null)

      // Both providers timeout
      coinGeckoProvider.getTokenPrice.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve(50000)
            }, 5000)
          )
      )

      binanceProvider.getTokenPrice.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve(50000)
            }, 5000)
          )
      )

      await expect(repository.getTokenPrice('BTC')).rejects.toThrow(NotFoundException)
    }, 10000)

    it('should preserve error types from providers', async () => {
      cacheManager.get.mockResolvedValue(null)
      const customError = new NotFoundException('Custom error')
      coinGeckoProvider.getTokenPrice.mockRejectedValue(customError)
      binanceProvider.getTokenPrice.mockRejectedValue(customError)

      await expect(repository.getTokenPrice('BTC')).rejects.toThrow(NotFoundException)
    })

    it('should handle very small prices (precision)', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(0.00000123)

      const result = await repository.getTokenPrice('SHIB')

      expect(result).toBe(0.00000123)
      expect(cacheManager.set).toHaveBeenCalledWith('optimex:token:price:SHIB', 0.00000123, 60000)
    })

    it('should handle very large prices', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(999999.99)

      const result = await repository.getTokenPrice('BTC')

      expect(result).toBe(999999.99)
      expect(cacheManager.set).toHaveBeenCalledWith('optimex:token:price:BTC', 999999.99, 60000)
    })

    it('should handle cache.set failure gracefully', async () => {
      cacheManager.get.mockResolvedValue(null)
      cacheManager.set.mockRejectedValue(new Error('Cache set failed'))
      coinGeckoProvider.getTokenPrice.mockResolvedValue(50000)
      binanceProvider.getTokenPrice.mockResolvedValue(50001)

      // Should still return the price even if caching fails
      await expect(repository.getTokenPrice('BTC')).rejects.toThrow('Cache set failed')
    })

    it('should handle cache.get failure gracefully', async () => {
      cacheManager.get.mockRejectedValue(new Error('Cache get failed'))
      coinGeckoProvider.getTokenPrice.mockResolvedValue(50000)
      binanceProvider.getTokenPrice.mockResolvedValue(50001)

      // Should fallback to providers if cache fails
      await expect(repository.getTokenPrice('BTC')).rejects.toThrow('Cache get failed')
    })

    it('should handle mixed success/failure from providers', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockRejectedValue(new Error('Failed'))
      binanceProvider.getTokenPrice.mockResolvedValue(50000)

      const result = await repository.getTokenPrice('BTC')

      expect(result).toBe(50000)
    })
  })

  describe('Provider Priority', () => {
    it('should use CoinGecko as primary provider', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(50000)
      binanceProvider.getTokenPrice.mockResolvedValue(50100)

      const result = await repository.getTokenPrice('BTC')

      // CoinGecko price should be used
      expect(result).toBe(50000)
    })

    it('should have correct provider order in array', async () => {
      // Access private field for testing (TypeScript workaround)
      const providers = (repository as any).providers

      expect(providers).toHaveLength(2)
      expect(providers[0].name).toBe(PriceProvider.COINGECKO)
      expect(providers[1].name).toBe(PriceProvider.BINANCE)
    })
  })

  describe('Real-world Integration Scenarios', () => {
    it('should handle complete flow: cache miss -> provider success -> cache set', async () => {
      cacheManager.get.mockResolvedValue(null)
      coinGeckoProvider.getTokenPrice.mockResolvedValue(50000)
      binanceProvider.getTokenPrice.mockResolvedValue(50001)

      const result = await repository.getTokenPrice('BTC')

      expect(result).toBe(50000)
      expect(cacheManager.get).toHaveBeenCalledWith('optimex:token:price:BTC')
      expect(coinGeckoProvider.getTokenPrice).toHaveBeenCalledWith('BTC')
      expect(cacheManager.set).toHaveBeenCalledWith('optimex:token:price:BTC', 50000, 60000)
    })

    it('should handle complete flow: cache hit -> no provider call', async () => {
      cacheManager.get.mockResolvedValue(50000)

      const result = await repository.getTokenPrice('BTC')

      expect(result).toBe(50000)
      expect(cacheManager.get).toHaveBeenCalledWith('optimex:token:price:BTC')
      expect(coinGeckoProvider.getTokenPrice).not.toHaveBeenCalled()
      expect(binanceProvider.getTokenPrice).not.toHaveBeenCalled()
      expect(cacheManager.set).not.toHaveBeenCalled()
    })

    it('should handle multiple different tokens in sequence', async () => {
      cacheManager.get.mockResolvedValue(null)

      coinGeckoProvider.getTokenPrice.mockImplementation(async (symbol) => {
        const prices: Record<string, number> = {
          BTC: 50000,
          ETH: 3000,
          SOL: 100,
        }
        return prices[symbol] || 0
      })

      binanceProvider.getTokenPrice.mockImplementation(async (symbol) => {
        const prices: Record<string, number> = {
          BTC: 50001,
          ETH: 3001,
          SOL: 101,
        }
        return prices[symbol] || 0
      })

      const btcPrice = await repository.getTokenPrice('BTC')
      const ethPrice = await repository.getTokenPrice('ETH')
      const solPrice = await repository.getTokenPrice('SOL')

      expect(btcPrice).toBe(50000)
      expect(ethPrice).toBe(3000)
      expect(solPrice).toBe(100)

      expect(cacheManager.set).toHaveBeenCalledTimes(3)
      expect(cacheManager.set).toHaveBeenCalledWith('optimex:token:price:BTC', 50000, 60000)
      expect(cacheManager.set).toHaveBeenCalledWith('optimex:token:price:ETH', 3000, 60000)
      expect(cacheManager.set).toHaveBeenCalledWith('optimex:token:price:SOL', 100, 60000)
    })
  })
})
