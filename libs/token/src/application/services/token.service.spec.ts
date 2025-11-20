import { BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import { Token, tokenService } from '@optimex-xyz/market-maker-sdk'

import { ethers } from 'ethers'

import { TokenService } from './token.service'

import { ITokenRepository, TokenQuoteCalculationData, TokenValidationData } from '../../domain'
import { TOKEN_REPOSITORY } from '../../infras'

// Mock the tokenService from SDK
jest.mock('@optimex-xyz/market-maker-sdk', () => ({
  tokenService: {
    getTokenByTokenId: jest.fn(),
  },
}))

describe('TokenService', () => {
  let service: TokenService
  let tokenRepository: jest.Mocked<ITokenRepository>
  let configService: jest.Mocked<ConfigService>

  // Test configuration values
  const TEST_CONFIG = {
    MIN_TRADE: '100',
    SOFT_CAP: '10000',
    HARD_CAP: '50000',
    COMMITMENT_BPS: '9000',
    INDICATIVE_BPS: '9000',
  }

  // Test token data
  const BTC_TOKEN: Token = {
    networkId: 'bitcoin-mainnet',
    tokenId: 'btc-token-id',
    networkName: 'Bitcoin',
    networkSymbol: 'BTC',
    networkType: 'bitcoin',
    tokenName: 'Bitcoin',
    tokenSymbol: 'BTC',
    tokenAddress: '',
    tokenDecimals: 8,
    tokenLogoUri: 'https://example.com/btc.png',
    networkLogoUri: 'https://example.com/bitcoin.png',
  }

  const ETH_TOKEN: Token = {
    networkId: 'ethereum-mainnet',
    tokenId: 'eth-token-id',
    networkName: 'Ethereum',
    networkSymbol: 'ETH',
    networkType: 'evm',
    tokenName: 'Ethereum',
    tokenSymbol: 'ETH',
    tokenAddress: '0x0000000000000000000000000000000000000000',
    tokenDecimals: 18,
    tokenLogoUri: 'https://example.com/eth.png',
    networkLogoUri: 'https://example.com/ethereum.png',
  }

  const USDT_TOKEN: Token = {
    networkId: 'ethereum-mainnet',
    tokenId: 'usdt-token-id',
    networkName: 'Ethereum',
    networkSymbol: 'ETH',
    networkType: 'evm',
    tokenName: 'Tether USD',
    tokenSymbol: 'USDT',
    tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    tokenDecimals: 6,
    tokenLogoUri: 'https://example.com/usdt.png',
    networkLogoUri: 'https://example.com/ethereum.png',
  }

  beforeEach(async () => {
    // Create mock repository
    tokenRepository = {
      getTokenPrice: jest.fn(),
    }

    // Create mock config service
    configService = {
      getOrThrow: jest.fn((key: string, defaultValue?: string) => {
        if (defaultValue !== undefined && !(key in TEST_CONFIG)) {
          return defaultValue
        }
        return TEST_CONFIG[key as keyof typeof TEST_CONFIG] || defaultValue
      }),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: TOKEN_REPOSITORY, useValue: tokenRepository },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile()

    service = module.get<TokenService>(TokenService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Constructor & Configuration', () => {
    it('should load configuration values from ConfigService', () => {
      // Create a new instance to check config calls
      const mockConfig = {
        getOrThrow: jest.fn((key: string, defaultValue?: string) => {
          if (defaultValue !== undefined && !(key in TEST_CONFIG)) {
            return defaultValue
          }
          return TEST_CONFIG[key as keyof typeof TEST_CONFIG] || defaultValue
        }),
      } as any

      new TokenService(tokenRepository, mockConfig)

      expect(mockConfig.getOrThrow).toHaveBeenCalledWith('MIN_TRADE')
      expect(mockConfig.getOrThrow).toHaveBeenCalledWith('SOFT_CAP')
      expect(mockConfig.getOrThrow).toHaveBeenCalledWith('HARD_CAP')
      expect(mockConfig.getOrThrow).toHaveBeenCalledWith('COMMITMENT_BPS', '9000')
      expect(mockConfig.getOrThrow).toHaveBeenCalledWith('INDICATIVE_BPS', '9000')
    })

    it('should set MIN_TRADE, SOFT_CAP, HARD_CAP from env', () => {
      expect((service as any).MIN_TRADE).toBe(100)
      expect((service as any).SOFT_CAP).toBe(10000)
      expect((service as any).HARD_CAP).toBe(50000)
    })

    it('should use default values for COMMITMENT_BPS (9000) and INDICATIVE_BPS (9000)', () => {
      expect((service as any).COMMITMENT_BPS).toBe(9000)
      expect((service as any).INDICATIVE_BPS).toBe(9000)
    })

    it('should convert string config values to numbers', () => {
      expect(typeof (service as any).MIN_TRADE).toBe('number')
      expect(typeof (service as any).SOFT_CAP).toBe('number')
      expect(typeof (service as any).HARD_CAP).toBe('number')
      expect(typeof (service as any).COMMITMENT_BPS).toBe('number')
      expect(typeof (service as any).INDICATIVE_BPS).toBe('number')
    })
  })

  describe('getTokenPrice()', () => {
    it('should delegate to tokenRepository.getTokenPrice()', async () => {
      tokenRepository.getTokenPrice.mockResolvedValue(50000)

      const result = await service.getTokenPrice('BTC')

      expect(result).toBe(50000)
      expect(tokenRepository.getTokenPrice).toHaveBeenCalledWith('BTC')
      expect(tokenRepository.getTokenPrice).toHaveBeenCalledTimes(1)
    })

    it('should return number directly (not wrapped object)', async () => {
      tokenRepository.getTokenPrice.mockResolvedValue(3000.5)

      const result = await service.getTokenPrice('ETH')

      expect(result).toBe(3000.5)
      expect(typeof result).toBe('number')
    })

    it('should pass symbol correctly to repository', async () => {
      tokenRepository.getTokenPrice.mockResolvedValue(1.0)

      await service.getTokenPrice('USDT')

      expect(tokenRepository.getTokenPrice).toHaveBeenCalledWith('USDT')
    })

    it('should handle repository errors properly', async () => {
      const error = new Error('Price fetch failed')
      tokenRepository.getTokenPrice.mockRejectedValue(error)

      await expect(service.getTokenPrice('INVALID')).rejects.toThrow('Price fetch failed')
    })

    it('should handle very small prices (precision)', async () => {
      tokenRepository.getTokenPrice.mockResolvedValue(0.00000123)

      const result = await service.getTokenPrice('SHIB')

      expect(result).toBe(0.00000123)
    })

    it('should handle very large prices', async () => {
      tokenRepository.getTokenPrice.mockResolvedValue(999999.99)

      const result = await service.getTokenPrice('BTC')

      expect(result).toBe(999999.99)
    })
  })

  describe('getTokenByTokenId()', () => {
    it('should delegate to tokenService.getTokenByTokenId()', async () => {
      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(BTC_TOKEN)

      const result = await service.getTokenByTokenId('btc-token-id')

      expect(result).toEqual(BTC_TOKEN)
      expect(tokenService.getTokenByTokenId).toHaveBeenCalledWith('btc-token-id')
    })

    it('should return Token object when found', async () => {
      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(ETH_TOKEN)

      const result = await service.getTokenByTokenId('eth-token-id')

      expect(result).toBeDefined()
      expect(result?.tokenSymbol).toBe('ETH')
      expect(result?.tokenDecimals).toBe(18)
    })

    it('should return null when token not found', async () => {
      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(null)

      const result = await service.getTokenByTokenId('invalid-token-id')

      expect(result).toBeNull()
    })

    it('should pass tokenId correctly', async () => {
      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(USDT_TOKEN)

      await service.getTokenByTokenId('usdt-token-id')

      expect(tokenService.getTokenByTokenId).toHaveBeenCalledWith('usdt-token-id')
      expect(tokenService.getTokenByTokenId).toHaveBeenCalledTimes(1)
    })
  })

  describe('validateIndicativeAmount()', () => {
    it('should validate against HARD_CAP', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'btc-token-id',
        amount: ethers.parseUnits('1', 8).toString(), // 1 BTC
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(BTC_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(50000) // 1 BTC = $50,000 USD (exactly at HARD_CAP)

      // Should pass when exactly at HARD_CAP
      await expect(service.validateIndicativeAmount(validationData)).resolves.not.toThrow()
    })

    it('should throw BadRequestException when token not found', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'invalid-token-id',
        amount: '1000000',
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(null)

      await expect(service.validateIndicativeAmount(validationData)).rejects.toThrow(BadRequestException)
      await expect(service.validateIndicativeAmount(validationData)).rejects.toThrow(
        'Token with ID invalid-token-id not found'
      )
    })

    it('should throw BadRequestException when amount below MIN_TRADE', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'btc-token-id',
        amount: ethers.parseUnits('0.001', 8).toString(), // 0.001 BTC
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(BTC_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(50000) // 0.001 BTC = $50 USD (below $100 MIN_TRADE)

      await expect(service.validateIndicativeAmount(validationData)).rejects.toThrow(BadRequestException)
      await expect(service.validateIndicativeAmount(validationData)).rejects.toThrow(
        /is below minimum allowed: 100 USD/
      )
    })

    it('should throw BadRequestException when amount exceeds HARD_CAP', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'btc-token-id',
        amount: ethers.parseUnits('1.5', 8).toString(), // 1.5 BTC
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(BTC_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(50000) // 1.5 BTC = $75,000 USD (exceeds $50,000 HARD_CAP)

      await expect(service.validateIndicativeAmount(validationData)).rejects.toThrow(BadRequestException)
      await expect(service.validateIndicativeAmount(validationData)).rejects.toThrow(/exceeds hard cap: 50000 USD/)
    })

    it('should pass when amount is within MIN_TRADE and HARD_CAP range', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'btc-token-id',
        amount: ethers.parseUnits('0.1', 8).toString(), // 0.1 BTC
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(BTC_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(50000) // 0.1 BTC = $5,000 USD (within range)

      await expect(service.validateIndicativeAmount(validationData)).resolves.not.toThrow()
    })

    it('should fetch token price and calculate USD value correctly', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'eth-token-id',
        amount: ethers.parseUnits('1', 18).toString(), // 1 ETH
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(ETH_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(3000) // 1 ETH = $3,000 USD

      await expect(service.validateIndicativeAmount(validationData)).resolves.not.toThrow()
      expect(tokenRepository.getTokenPrice).toHaveBeenCalledWith('ETH')
    })

    it('should handle different token decimals (6, 8, 18)', async () => {
      // Test with 6 decimals (USDT)
      const usdtValidation: TokenValidationData = {
        tokenId: 'usdt-token-id',
        amount: ethers.parseUnits('1000', 6).toString(), // 1000 USDT
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(USDT_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(1.0) // 1000 USDT = $1,000 USD

      await expect(service.validateIndicativeAmount(usdtValidation)).resolves.not.toThrow()

      // Test with 8 decimals (BTC)
      const btcValidation: TokenValidationData = {
        tokenId: 'btc-token-id',
        amount: ethers.parseUnits('0.1', 8).toString(),
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(BTC_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(50000) // 0.1 BTC = $5,000 USD

      await expect(service.validateIndicativeAmount(btcValidation)).resolves.not.toThrow()

      // Test with 18 decimals (ETH)
      const ethValidation: TokenValidationData = {
        tokenId: 'eth-token-id',
        amount: ethers.parseUnits('1', 18).toString(),
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(ETH_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(3000) // 1 ETH = $3,000 USD

      await expect(service.validateIndicativeAmount(ethValidation)).resolves.not.toThrow()
    })

    it('should validate at boundary values (exactly MIN_TRADE)', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'usdt-token-id',
        amount: ethers.parseUnits('100', 6).toString(), // exactly $100
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(USDT_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(1.0)

      await expect(service.validateIndicativeAmount(validationData)).resolves.not.toThrow()
    })

    it('should validate at boundary values (exactly HARD_CAP)', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'usdt-token-id',
        amount: ethers.parseUnits('50000', 6).toString(), // exactly $50,000
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(USDT_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(1.0)

      await expect(service.validateIndicativeAmount(validationData)).resolves.not.toThrow()
    })
  })

  describe('validateCommitmentAmount()', () => {
    it('should validate against SOFT_CAP', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'btc-token-id',
        amount: ethers.parseUnits('0.25', 8).toString(), // 0.25 BTC
        validationType: 'commitment',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(BTC_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(50000) // 0.25 BTC = $12,500 USD (exceeds $10,000 SOFT_CAP)

      await expect(service.validateCommitmentAmount(validationData)).rejects.toThrow(BadRequestException)
      await expect(service.validateCommitmentAmount(validationData)).rejects.toThrow(/exceeds soft cap: 10000 USD/)
    })

    it('should throw BadRequestException when token not found', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'invalid-token-id',
        amount: '1000000',
        validationType: 'commitment',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(null)

      await expect(service.validateCommitmentAmount(validationData)).rejects.toThrow(BadRequestException)
      await expect(service.validateCommitmentAmount(validationData)).rejects.toThrow(
        'Token with ID invalid-token-id not found'
      )
    })

    it('should throw BadRequestException when amount below MIN_TRADE', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'usdt-token-id',
        amount: ethers.parseUnits('50', 6).toString(), // $50 USD (below $100 MIN_TRADE)
        validationType: 'commitment',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(USDT_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(1.0)

      await expect(service.validateCommitmentAmount(validationData)).rejects.toThrow(BadRequestException)
      await expect(service.validateCommitmentAmount(validationData)).rejects.toThrow(
        /is below minimum allowed: 100 USD/
      )
    })

    it('should throw BadRequestException when amount exceeds SOFT_CAP', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'usdt-token-id',
        amount: ethers.parseUnits('15000', 6).toString(), // $15,000 USD (exceeds $10,000 SOFT_CAP)
        validationType: 'commitment',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(USDT_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(1.0)

      await expect(service.validateCommitmentAmount(validationData)).rejects.toThrow(BadRequestException)
      await expect(service.validateCommitmentAmount(validationData)).rejects.toThrow(/exceeds soft cap: 10000 USD/)
    })

    it('should include "Commitment not allowed" message for SOFT_CAP', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'eth-token-id',
        amount: ethers.parseUnits('5', 18).toString(), // 5 ETH
        validationType: 'commitment',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(ETH_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(3000) // 5 ETH = $15,000 USD

      await expect(service.validateCommitmentAmount(validationData)).rejects.toThrow(BadRequestException)
      await expect(service.validateCommitmentAmount(validationData)).rejects.toThrow(/Commitment not allowed/)
    })

    it('should pass when amount is within MIN_TRADE and SOFT_CAP range', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'usdt-token-id',
        amount: ethers.parseUnits('5000', 6).toString(), // $5,000 USD
        validationType: 'commitment',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(USDT_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(1.0)

      await expect(service.validateCommitmentAmount(validationData)).resolves.not.toThrow()
    })

    it('should fetch token price and calculate USD value correctly', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'btc-token-id',
        amount: ethers.parseUnits('0.05', 8).toString(), // 0.05 BTC
        validationType: 'commitment',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(BTC_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(50000) // 0.05 BTC = $2,500 USD

      await expect(service.validateCommitmentAmount(validationData)).resolves.not.toThrow()
      expect(tokenRepository.getTokenPrice).toHaveBeenCalledWith('BTC')
    })

    it('should validate at boundary values (exactly SOFT_CAP)', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'usdt-token-id',
        amount: ethers.parseUnits('10000', 6).toString(), // exactly $10,000
        validationType: 'commitment',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(USDT_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(1.0)

      await expect(service.validateCommitmentAmount(validationData)).resolves.not.toThrow()
    })
  })

  describe('calculateBestQuote()', () => {
    it('should calculate quote for commitment trades (90% of raw quote)', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: ethers.parseUnits('1', 18).toString(), // 1 ETH
        fromTokenId: 'eth-token-id',
        toTokenId: 'usdt-token-id',
        isCommitment: true,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(ETH_TOKEN).mockResolvedValueOnce(USDT_TOKEN)

      tokenRepository.getTokenPrice.mockResolvedValueOnce(3000).mockResolvedValueOnce(1.0)

      const result = await service.calculateBestQuote(calculationData)

      // Expected: 1 ETH * 3000 * 0.9 = 2700 USDT
      const expectedQuote = ethers.parseUnits('2700', 6)
      expect(result).toBe(expectedQuote.toString())
    })

    it('should calculate quote for indicative trades (90% of raw quote)', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: ethers.parseUnits('1000', 6).toString(), // 1000 USDT
        fromTokenId: 'usdt-token-id',
        toTokenId: 'eth-token-id',
        isCommitment: false,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(USDT_TOKEN).mockResolvedValueOnce(ETH_TOKEN)

      tokenRepository.getTokenPrice.mockResolvedValueOnce(1.0).mockResolvedValueOnce(3000)

      const result = await service.calculateBestQuote(calculationData)

      // Expected: 1000 USDT / 3000 * 0.9 = 0.3 ETH
      // Due to BigInt precision, allow 1 wei difference
      const expectedQuote = ethers.parseUnits('0.3', 18)
      const diff = BigInt(result) - expectedQuote
      expect(diff).toBeLessThanOrEqual(1n)
      expect(diff).toBeGreaterThanOrEqual(-1n)
    })

    it('should throw BadRequestException when fromToken not found', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: '1000000',
        fromTokenId: 'invalid-token-id',
        toTokenId: 'eth-token-id',
        isCommitment: false,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(null)

      await expect(service.calculateBestQuote(calculationData)).rejects.toThrow(BadRequestException)
      await expect(service.calculateBestQuote(calculationData)).rejects.toThrow('One or both tokens not found')
    })

    it('should throw BadRequestException when toToken not found', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: '1000000',
        fromTokenId: 'eth-token-id',
        toTokenId: 'invalid-token-id',
        isCommitment: false,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(ETH_TOKEN).mockResolvedValueOnce(null)

      await expect(service.calculateBestQuote(calculationData)).rejects.toThrow(BadRequestException)
      await expect(service.calculateBestQuote(calculationData)).rejects.toThrow('One or both tokens not found')
    })

    it('should fetch prices for both tokens', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: ethers.parseUnits('1', 8).toString(), // 1 BTC
        fromTokenId: 'btc-token-id',
        toTokenId: 'eth-token-id',
        isCommitment: false,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(BTC_TOKEN).mockResolvedValueOnce(ETH_TOKEN)

      tokenRepository.getTokenPrice.mockResolvedValueOnce(50000).mockResolvedValueOnce(3000)

      await service.calculateBestQuote(calculationData)

      expect(tokenRepository.getTokenPrice).toHaveBeenCalledWith('BTC')
      expect(tokenRepository.getTokenPrice).toHaveBeenCalledWith('ETH')
      expect(tokenRepository.getTokenPrice).toHaveBeenCalledTimes(2)
    })

    it('should handle different token decimals correctly', async () => {
      // BTC (8 decimals) -> USDT (6 decimals)
      const calculationData: TokenQuoteCalculationData = {
        amountIn: ethers.parseUnits('0.1', 8).toString(), // 0.1 BTC
        fromTokenId: 'btc-token-id',
        toTokenId: 'usdt-token-id',
        isCommitment: false,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(BTC_TOKEN).mockResolvedValueOnce(USDT_TOKEN)

      tokenRepository.getTokenPrice.mockResolvedValueOnce(50000).mockResolvedValueOnce(1.0)

      const result = await service.calculateBestQuote(calculationData)

      // Expected: 0.1 BTC * 50000 * 0.9 = 4500 USDT
      const expectedQuote = ethers.parseUnits('4500', 6)
      expect(result).toBe(expectedQuote.toString())
    })

    it('should apply BPS multiplier correctly', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: ethers.parseUnits('1', 18).toString(), // 1 ETH
        fromTokenId: 'eth-token-id',
        toTokenId: 'usdt-token-id',
        isCommitment: true,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(ETH_TOKEN).mockResolvedValueOnce(USDT_TOKEN)

      tokenRepository.getTokenPrice.mockResolvedValueOnce(3000).mockResolvedValueOnce(1.0)

      const result = await service.calculateBestQuote(calculationData)

      // BPS = 9000, so multiplier = 9000/10000 = 0.9
      // Expected: 1 ETH * 3000 * 0.9 = 2700 USDT
      const expectedQuote = ethers.parseUnits('2700', 6)
      expect(result).toBe(expectedQuote.toString())
    })

    it('should return quote as string', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: ethers.parseUnits('100', 6).toString(),
        fromTokenId: 'usdt-token-id',
        toTokenId: 'usdt-token-id',
        isCommitment: false,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(USDT_TOKEN).mockResolvedValueOnce(USDT_TOKEN)

      tokenRepository.getTokenPrice.mockResolvedValueOnce(1.0).mockResolvedValueOnce(1.0)

      const result = await service.calculateBestQuote(calculationData)

      expect(typeof result).toBe('string')
    })

    it('should handle large numbers with BigInt correctly', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: ethers.parseUnits('1000', 18).toString(), // 1000 ETH (large amount)
        fromTokenId: 'eth-token-id',
        toTokenId: 'usdt-token-id',
        isCommitment: false,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(ETH_TOKEN).mockResolvedValueOnce(USDT_TOKEN)

      tokenRepository.getTokenPrice.mockResolvedValueOnce(3000).mockResolvedValueOnce(1.0)

      const result = await service.calculateBestQuote(calculationData)

      // Expected: 1000 ETH * 3000 * 0.9 = 2,700,000 USDT
      const expectedQuote = ethers.parseUnits('2700000', 6)
      expect(result).toBe(expectedQuote.toString())
    })

    it('should calculate cross-chain swaps (BTC→ETH)', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: ethers.parseUnits('1', 8).toString(), // 1 BTC
        fromTokenId: 'btc-token-id',
        toTokenId: 'eth-token-id',
        isCommitment: false,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(BTC_TOKEN).mockResolvedValueOnce(ETH_TOKEN)

      tokenRepository.getTokenPrice.mockResolvedValueOnce(50000).mockResolvedValueOnce(3000)

      const result = await service.calculateBestQuote(calculationData)

      // Expected: 1 BTC ($50,000) / $3,000 * 0.9 = 15 ETH
      // Due to BigInt precision, allow 1 wei difference
      const expectedQuote = ethers.parseUnits('15', 18)
      const diff = BigInt(result) - expectedQuote
      expect(diff).toBeLessThanOrEqual(1n)
      expect(diff).toBeGreaterThanOrEqual(-1n)
    })

    it('should calculate cross-chain swaps (ETH→BTC)', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: ethers.parseUnits('15', 18).toString(), // 15 ETH
        fromTokenId: 'eth-token-id',
        toTokenId: 'btc-token-id',
        isCommitment: false,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(ETH_TOKEN).mockResolvedValueOnce(BTC_TOKEN)

      tokenRepository.getTokenPrice.mockResolvedValueOnce(3000).mockResolvedValueOnce(50000)

      const result = await service.calculateBestQuote(calculationData)

      // Expected: 15 ETH ($45,000) / $50,000 * 0.9 = 0.81 BTC
      const expectedQuote = ethers.parseUnits('0.81', 8)
      expect(result).toBe(expectedQuote.toString())
    })

    it('should handle very small token amounts (dust)', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: ethers.parseUnits('0.000001', 8).toString(), // 0.000001 BTC (dust)
        fromTokenId: 'btc-token-id',
        toTokenId: 'usdt-token-id',
        isCommitment: false,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(BTC_TOKEN).mockResolvedValueOnce(USDT_TOKEN)

      tokenRepository.getTokenPrice.mockResolvedValueOnce(50000).mockResolvedValueOnce(1.0)

      const result = await service.calculateBestQuote(calculationData)

      expect(result).toBeDefined()
      expect(BigInt(result)).toBeGreaterThan(0n)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very small token amounts validation', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'btc-token-id',
        amount: ethers.parseUnits('0.002', 8).toString(), // Very small BTC amount
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(BTC_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(50000) // 0.002 BTC = $100 USD (exactly MIN_TRADE)

      await expect(service.validateIndicativeAmount(validationData)).resolves.not.toThrow()
    })

    it('should handle very large token amounts validation', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'usdt-token-id',
        amount: ethers.parseUnits('49999', 6).toString(), // Just below HARD_CAP
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(USDT_TOKEN)
      tokenRepository.getTokenPrice.mockResolvedValue(1.0)

      await expect(service.validateIndicativeAmount(validationData)).resolves.not.toThrow()
    })

    it('should handle price volatility correctly in validation', async () => {
      const validationData: TokenValidationData = {
        tokenId: 'eth-token-id',
        amount: ethers.parseUnits('1', 18).toString(),
        validationType: 'indicative',
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValue(ETH_TOKEN)

      // Simulate volatile price
      tokenRepository.getTokenPrice.mockResolvedValue(2999.99) // Just under $3000

      await expect(service.validateIndicativeAmount(validationData)).resolves.not.toThrow()
    })

    it('should handle price volatility correctly in quote calculation', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: ethers.parseUnits('1', 18).toString(),
        fromTokenId: 'eth-token-id',
        toTokenId: 'usdt-token-id',
        isCommitment: false,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(ETH_TOKEN).mockResolvedValueOnce(USDT_TOKEN)

      // Volatile prices with high precision
      tokenRepository.getTokenPrice.mockResolvedValueOnce(3456.789123).mockResolvedValueOnce(1.000456)

      const result = await service.calculateBestQuote(calculationData)

      expect(result).toBeDefined()
      expect(BigInt(result)).toBeGreaterThan(0n)
    })

    it('should handle same token swap (edge case)', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: ethers.parseUnits('100', 6).toString(),
        fromTokenId: 'usdt-token-id',
        toTokenId: 'usdt-token-id',
        isCommitment: false,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(USDT_TOKEN).mockResolvedValueOnce(USDT_TOKEN)

      tokenRepository.getTokenPrice.mockResolvedValueOnce(1.0).mockResolvedValueOnce(1.0)

      const result = await service.calculateBestQuote(calculationData)

      // Expected: 100 USDT * 1.0 / 1.0 * 0.9 = 90 USDT
      const expectedQuote = ethers.parseUnits('90', 6)
      expect(result).toBe(expectedQuote.toString())
    })

    it('should handle decimal precision edge cases', async () => {
      const calculationData: TokenQuoteCalculationData = {
        amountIn: '1', // 1 wei (smallest unit)
        fromTokenId: 'eth-token-id',
        toTokenId: 'usdt-token-id',
        isCommitment: false,
      }

      ;(tokenService.getTokenByTokenId as jest.Mock).mockResolvedValueOnce(ETH_TOKEN).mockResolvedValueOnce(USDT_TOKEN)

      tokenRepository.getTokenPrice.mockResolvedValueOnce(3000).mockResolvedValueOnce(1.0)

      const result = await service.calculateBestQuote(calculationData)

      expect(result).toBeDefined()
      // Result might be 0 due to rounding, but should not error
    })
  })
})
