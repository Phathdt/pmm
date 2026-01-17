import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ReqService } from '@optimex-pmm/req'

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { BinancePriceProvider } from './binance-price.provider'

import { BinancePriceTicker, PriceProvider } from '../../domain'

type Mocked<T> = {
  [P in keyof T]: T[P] extends (...args: infer A) => infer R ? Mock<(...args: A) => R> & T[P] : T[P]
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

describe('BinancePriceProvider', () => {
  let provider: BinancePriceProvider
  let reqService: Mocked<ReqService>

  beforeEach(async () => {
    const mockReqService = {
      get: vi.fn(),
    }

    const mockLogger = createMockLogger()

    // Directly instantiate provider instead of using NestJS testing module
    provider = new BinancePriceProvider(mockReqService as any, mockLogger as any)
    reqService = mockReqService as Mocked<ReqService>
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Provider metadata', () => {
    it('should have correct provider name', () => {
      expect(provider.name).toBe(PriceProvider.BINANCE)
    })
  })

  describe('API Integration', () => {
    it('should fetch price from Binance API successfully', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'BTCUSDT',
        price: '50000.50',
      }

      reqService.get.mockResolvedValue(mockResponse)

      const result = await provider.getTokenPrice('BTC')

      expect(result).toBe(50000.5)
      expect(reqService.get).toHaveBeenCalledWith({
        url: '/ticker/price?symbol=BTCUSDT',
        skipCaseConversion: true,
      })
      expect(reqService.get).toHaveBeenCalledTimes(1)
    })

    it('should construct correct symbol pair (BTC -> BTCUSDT)', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'BTCUSDT',
        price: '50000.00',
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('BTC')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/ticker/price?symbol=BTCUSDT',
        skipCaseConversion: true,
      })
    })

    it('should construct correct symbol pair for lowercase input', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'ETHUSDT',
        price: '3000.00',
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('eth')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/ticker/price?symbol=ETHUSDT',
        skipCaseConversion: true,
      })
    })

    it('should parse price from string to number', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'ETHUSDT',
        price: '3456.789',
      }

      reqService.get.mockResolvedValue(mockResponse)

      const result = await provider.getTokenPrice('ETH')

      expect(result).toBe(3456.789)
      expect(typeof result).toBe('number')
    })

    it('should handle wrapped token symbols (WBTC -> BTC -> BTCUSDT)', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'BTCUSDT',
        price: '50000.00',
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('WBTC')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/ticker/price?symbol=BTCUSDT',
        skipCaseConversion: true,
      })
    })

    it('should validate price is a positive number', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'BTCUSDT',
        price: '50000.50',
      }

      reqService.get.mockResolvedValue(mockResponse)

      const result = await provider.getTokenPrice('BTC')

      expect(result).toBeGreaterThan(0)
      expect(isNaN(result)).toBe(false)
    })

    it('should throw error for invalid price (negative)', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'BTCUSDT',
        price: '-100.00',
      }

      reqService.get.mockResolvedValue(mockResponse)

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow('Invalid price received from Binance: -100.00')
    })

    it('should throw error for invalid price (zero)', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'BTCUSDT',
        price: '0',
      }

      reqService.get.mockResolvedValue(mockResponse)

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow('Invalid price received from Binance: 0')
    })

    it('should throw error for invalid price (NaN)', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'BTCUSDT',
        price: 'invalid',
      }

      reqService.get.mockResolvedValue(mockResponse)

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow('Invalid price received from Binance: invalid')
    })
  })

  describe('Input Validation', () => {
    it('should throw BadRequestException for empty string', async () => {
      await expect(provider.getTokenPrice('')).rejects.toThrow(BadRequestException)
      await expect(provider.getTokenPrice('')).rejects.toThrow('Token symbol must be a non-empty string')
      expect(reqService.get).not.toHaveBeenCalled()
    })

    it('should throw BadRequestException for whitespace only', async () => {
      await expect(provider.getTokenPrice('   ')).rejects.toThrow(BadRequestException)
      await expect(provider.getTokenPrice('   ')).rejects.toThrow('Token symbol must be a non-empty string')
      expect(reqService.get).not.toHaveBeenCalled()
    })

    it('should throw BadRequestException for null', async () => {
      await expect(provider.getTokenPrice(null as any)).rejects.toThrow(BadRequestException)
      await expect(provider.getTokenPrice(null as any)).rejects.toThrow('Token symbol must be a non-empty string')
      expect(reqService.get).not.toHaveBeenCalled()
    })

    it('should throw BadRequestException for undefined', async () => {
      await expect(provider.getTokenPrice(undefined as any)).rejects.toThrow(BadRequestException)
      await expect(provider.getTokenPrice(undefined as any)).rejects.toThrow('Token symbol must be a non-empty string')
      expect(reqService.get).not.toHaveBeenCalled()
    })

    it('should throw BadRequestException for non-string types (number)', async () => {
      await expect(provider.getTokenPrice(123 as any)).rejects.toThrow(BadRequestException)
      expect(reqService.get).not.toHaveBeenCalled()
    })

    it('should throw BadRequestException for non-string types (object)', async () => {
      await expect(provider.getTokenPrice({} as any)).rejects.toThrow(BadRequestException)
      expect(reqService.get).not.toHaveBeenCalled()
    })

    it('should trim whitespace from valid symbols', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'BTCUSDT',
        price: '50000.00',
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('  BTC  ')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/ticker/price?symbol=BTCUSDT',
        skipCaseConversion: true,
      })
    })
  })

  describe('Error Handling', () => {
    it('should preserve NotFoundException from API', async () => {
      const notFoundError = new NotFoundException('Symbol not found')
      reqService.get.mockRejectedValue(notFoundError)

      await expect(provider.getTokenPrice('INVALID')).rejects.toThrow(NotFoundException)
      await expect(provider.getTokenPrice('INVALID')).rejects.toThrow('Symbol not found')
    })

    it('should preserve BadRequestException from API', async () => {
      const badRequestError = new BadRequestException('Invalid request')
      reqService.get.mockRejectedValue(badRequestError)

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow(BadRequestException)
      await expect(provider.getTokenPrice('BTC')).rejects.toThrow('Invalid request')
    })

    it('should wrap generic errors in NotFoundException', async () => {
      const genericError = new Error('Network error')
      reqService.get.mockRejectedValue(genericError)

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow(NotFoundException)
      await expect(provider.getTokenPrice('BTC')).rejects.toThrow(
        'Cannot find price for symbol BTC on Binance: Network error'
      )
    })

    it('should wrap non-Error exceptions in NotFoundException', async () => {
      reqService.get.mockRejectedValue('String error')

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow(NotFoundException)
      await expect(provider.getTokenPrice('BTC')).rejects.toThrow(
        'Cannot find price for symbol BTC on Binance: String error'
      )
    })

    it('should include original symbol in error message', async () => {
      const error = new Error('API Error')
      reqService.get.mockRejectedValue(error)

      await expect(provider.getTokenPrice('XYZ')).rejects.toThrow(
        'Cannot find price for symbol XYZ on Binance: API Error'
      )
    })

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout')
      reqService.get.mockRejectedValue(timeoutError)

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow(NotFoundException)
      await expect(provider.getTokenPrice('BTC')).rejects.toThrow('Request timeout')
    })

    it('should handle network errors', async () => {
      const networkError = new Error('ECONNREFUSED')
      reqService.get.mockRejectedValue(networkError)

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow(NotFoundException)
      await expect(provider.getTokenPrice('BTC')).rejects.toThrow('ECONNREFUSED')
    })
  })

  describe('Symbol Normalization', () => {
    it('should normalize WBTC to BTC before constructing pair', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'BTCUSDT',
        price: '50000.00',
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('WBTC')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/ticker/price?symbol=BTCUSDT',
        skipCaseConversion: true,
      })
    })

    it('should normalize WETH to ETH before constructing pair', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'ETHUSDT',
        price: '3000.00',
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('WETH')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/ticker/price?symbol=ETHUSDT',
        skipCaseConversion: true,
      })
    })

    it('should normalize WSOL to SOL before constructing pair', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'SOLUSDT',
        price: '100.00',
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('WSOL')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/ticker/price?symbol=SOLUSDT',
        skipCaseConversion: true,
      })
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle popular tokens correctly', async () => {
      const tokens = [
        { symbol: 'BTC', price: '50000.00' },
        { symbol: 'ETH', price: '3000.00' },
        { symbol: 'SOL', price: '100.00' },
        { symbol: 'BNB', price: '400.00' },
      ]

      for (const token of tokens) {
        reqService.get.mockResolvedValue({
          symbol: `${token.symbol}USDT`,
          price: token.price,
        })

        const result = await provider.getTokenPrice(token.symbol)
        expect(result).toBe(parseFloat(token.price))
      }
    })

    it('should handle very small prices (decimal precision)', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'PEPEUSDT',
        price: '0.00000123',
      }

      reqService.get.mockResolvedValue(mockResponse)

      const result = await provider.getTokenPrice('PEPE')

      expect(result).toBe(0.00000123)
    })

    it('should handle very large prices', async () => {
      const mockResponse: BinancePriceTicker = {
        symbol: 'BTCUSDT',
        price: '999999.99',
      }

      reqService.get.mockResolvedValue(mockResponse)

      const result = await provider.getTokenPrice('BTC')

      expect(result).toBe(999999.99)
    })
  })
})
