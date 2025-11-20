import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ReqService } from '@optimex-pmm/req'

import { CoinGeckoPriceProvider } from './coingecko-price.provider'

import { PriceProvider } from '../../domain'

describe('CoinGeckoPriceProvider', () => {
  let provider: CoinGeckoPriceProvider
  let reqService: jest.Mocked<ReqService>

  beforeEach(async () => {
    const mockReqService = {
      get: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoinGeckoPriceProvider,
        {
          provide: 'COINGECKO_REQ_SERVICE',
          useValue: mockReqService,
        },
      ],
    }).compile()

    provider = module.get<CoinGeckoPriceProvider>(CoinGeckoPriceProvider)
    reqService = module.get('COINGECKO_REQ_SERVICE')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Provider metadata', () => {
    it('should have correct provider name', () => {
      expect(provider.name).toBe(PriceProvider.COINGECKO)
    })
  })

  describe('API Integration', () => {
    it('should fetch price from CoinGecko API successfully', async () => {
      const mockResponse = {
        bitcoin: { usd: 50000.5 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      const result = await provider.getTokenPrice('BTC')

      expect(result).toBe(50000.5)
      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'bitcoin',
          vsCurrencies: 'usd',
        },
      })
      expect(reqService.get).toHaveBeenCalledTimes(1)
    })

    it('should use correct endpoint (/simple/price)', async () => {
      const mockResponse = {
        ethereum: { usd: 3000 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('ETH')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: expect.any(Object),
      })
    })

    it('should map BTC to bitcoin ID', async () => {
      const mockResponse = {
        bitcoin: { usd: 50000 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('BTC')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'bitcoin',
          vsCurrencies: 'usd',
        },
      })
    })

    it('should map ETH to ethereum ID', async () => {
      const mockResponse = {
        ethereum: { usd: 3000 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('ETH')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'ethereum',
          vsCurrencies: 'usd',
        },
      })
    })

    it('should map SOL to solana ID', async () => {
      const mockResponse = {
        solana: { usd: 100 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('SOL')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'solana',
          vsCurrencies: 'usd',
        },
      })
    })

    it('should map USDT to tether ID', async () => {
      const mockResponse = {
        tether: { usd: 1.0 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('USDT')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'tether',
          vsCurrencies: 'usd',
        },
      })
    })

    it('should map USDC to usd-coin ID', async () => {
      const mockResponse = {
        'usd-coin': { usd: 1.0 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('USDC')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'usd-coin',
          vsCurrencies: 'usd',
        },
      })
    })

    it('should map BNB to binancecoin ID', async () => {
      const mockResponse = {
        binancecoin: { usd: 400 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('BNB')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'binancecoin',
          vsCurrencies: 'usd',
        },
      })
    })

    it('should fallback to lowercase symbol for unmapped tokens', async () => {
      const mockResponse = {
        xyz: { usd: 10.5 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('XYZ')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'xyz',
          vsCurrencies: 'usd',
        },
      })
    })

    it('should validate price is a positive number', async () => {
      const mockResponse = {
        bitcoin: { usd: 50000.5 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      const result = await provider.getTokenPrice('BTC')

      expect(result).toBeGreaterThan(0)
      expect(isNaN(result)).toBe(false)
    })

    it('should throw error for missing token in response', async () => {
      const mockResponse = {}

      reqService.get.mockResolvedValue(mockResponse)

      await expect(provider.getTokenPrice('INVALID')).rejects.toThrow(NotFoundException)
      await expect(provider.getTokenPrice('INVALID')).rejects.toThrow('Token INVALID not found on CoinGecko')
    })

    it('should throw error for missing usd price', async () => {
      const mockResponse = {
        bitcoin: {},
      }

      reqService.get.mockResolvedValue(mockResponse)

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow(NotFoundException)
      await expect(provider.getTokenPrice('BTC')).rejects.toThrow('Token BTC not found on CoinGecko')
    })

    it('should throw error for invalid price (negative)', async () => {
      const mockResponse = {
        bitcoin: { usd: -100 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow('Invalid price received from CoinGecko: -100')
    })

    it('should throw error for invalid price (zero)', async () => {
      const mockResponse = {
        bitcoin: { usd: 0 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow('Invalid price received from CoinGecko: 0')
    })

    it('should throw error for invalid price (NaN)', async () => {
      const mockResponse = {
        bitcoin: { usd: NaN },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow('Invalid price received from CoinGecko: NaN')
    })

    it('should throw error for non-numeric price', async () => {
      const mockResponse = {
        bitcoin: { usd: 'invalid' },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow(NotFoundException)
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
      const mockResponse = {
        bitcoin: { usd: 50000 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('  BTC  ')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'bitcoin',
          vsCurrencies: 'usd',
        },
      })
    })

    it('should handle lowercase input', async () => {
      const mockResponse = {
        bitcoin: { usd: 50000 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('btc')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'bitcoin',
          vsCurrencies: 'usd',
        },
      })
    })
  })

  describe('Error Handling', () => {
    it('should preserve NotFoundException from API', async () => {
      const notFoundError = new NotFoundException('Token not found')
      reqService.get.mockRejectedValue(notFoundError)

      await expect(provider.getTokenPrice('INVALID')).rejects.toThrow(NotFoundException)
      await expect(provider.getTokenPrice('INVALID')).rejects.toThrow('Token not found')
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
        'Cannot find price for symbol BTC on CoinGecko: Network error'
      )
    })

    it('should wrap non-Error exceptions in NotFoundException', async () => {
      reqService.get.mockRejectedValue('String error')

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow(NotFoundException)
      await expect(provider.getTokenPrice('BTC')).rejects.toThrow(
        'Cannot find price for symbol BTC on CoinGecko: String error'
      )
    })

    it('should include original symbol in error message', async () => {
      const error = new Error('API Error')
      reqService.get.mockRejectedValue(error)

      await expect(provider.getTokenPrice('XYZ')).rejects.toThrow(
        'Cannot find price for symbol XYZ on CoinGecko: API Error'
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

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded')
      reqService.get.mockRejectedValue(rateLimitError)

      await expect(provider.getTokenPrice('BTC')).rejects.toThrow(NotFoundException)
      await expect(provider.getTokenPrice('BTC')).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('Symbol Normalization', () => {
    it('should normalize WBTC to BTC before lookup', async () => {
      const mockResponse = {
        bitcoin: { usd: 50000 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('WBTC')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'bitcoin',
          vsCurrencies: 'usd',
        },
      })
    })

    it('should normalize TBTC to BTC before lookup', async () => {
      const mockResponse = {
        bitcoin: { usd: 50000 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('TBTC')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'bitcoin',
          vsCurrencies: 'usd',
        },
      })
    })

    it('should normalize WETH to ETH before lookup', async () => {
      const mockResponse = {
        ethereum: { usd: 3000 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('WETH')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'ethereum',
          vsCurrencies: 'usd',
        },
      })
    })

    it('should normalize WSOL to SOL before lookup', async () => {
      const mockResponse = {
        solana: { usd: 100 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      await provider.getTokenPrice('WSOL')

      expect(reqService.get).toHaveBeenCalledWith({
        url: '/simple/price',
        params: {
          ids: 'solana',
          vsCurrencies: 'usd',
        },
      })
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle popular tokens correctly', async () => {
      const tokens = [
        { symbol: 'BTC', id: 'bitcoin', price: 50000 },
        { symbol: 'ETH', id: 'ethereum', price: 3000 },
        { symbol: 'SOL', id: 'solana', price: 100 },
        { symbol: 'BNB', id: 'binancecoin', price: 400 },
      ]

      for (const token of tokens) {
        reqService.get.mockResolvedValue({
          [token.id]: { usd: token.price },
        })

        const result = await provider.getTokenPrice(token.symbol)
        expect(result).toBe(token.price)
      }
    })

    it('should handle very small prices (decimal precision)', async () => {
      const mockResponse = {
        pepe: { usd: 0.00000123 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      const result = await provider.getTokenPrice('PEPE')

      expect(result).toBe(0.00000123)
    })

    it('should handle very large prices', async () => {
      const mockResponse = {
        bitcoin: { usd: 999999.99 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      const result = await provider.getTokenPrice('BTC')

      expect(result).toBe(999999.99)
    })

    it('should handle stablecoin prices close to 1.0', async () => {
      const mockResponse = {
        tether: { usd: 0.9998 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      const result = await provider.getTokenPrice('USDT')

      expect(result).toBeCloseTo(1.0, 3)
    })
  })

  describe('Edge cases', () => {
    it('should handle API response with extra fields', async () => {
      const mockResponse = {
        bitcoin: {
          usd: 50000,
          eur: 45000,
          gbp: 40000,
          extraField: 'ignored',
        },
      }

      reqService.get.mockResolvedValue(mockResponse)

      const result = await provider.getTokenPrice('BTC')

      expect(result).toBe(50000)
    })

    it('should handle float precision correctly', async () => {
      const mockResponse = {
        ethereum: { usd: 3456.789012345 },
      }

      reqService.get.mockResolvedValue(mockResponse)

      const result = await provider.getTokenPrice('ETH')

      expect(result).toBe(3456.789012345)
    })
  })
})
