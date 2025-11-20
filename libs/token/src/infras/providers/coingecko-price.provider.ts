import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ReqService } from '@optimex-pmm/req'

import { ITokenPriceProvider, PriceProvider } from '../../domain'
import { normalizeSymbol } from '../../utils'

// Symbol to CoinGecko ID mapping for common tokens
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
}

@Injectable()
export class CoinGeckoPriceProvider implements ITokenPriceProvider {
  readonly name = PriceProvider.COINGECKO
  private readonly logger = new Logger(CoinGeckoPriceProvider.name)

  constructor(@Inject('COINGECKO_REQ_SERVICE') private readonly reqService: ReqService) {}

  async getTokenPrice(symbol: string): Promise<number> {
    // Validate input
    if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
      throw new BadRequestException('Token symbol must be a non-empty string')
    }

    const normalizedSymbol = normalizeSymbol(symbol.trim())
    const coinId = SYMBOL_TO_COINGECKO_ID[normalizedSymbol] || normalizedSymbol.toLowerCase()

    try {
      // Use /simple/price endpoint for single token lookup
      const response = await this.reqService.get<{ [key: string]: { usd: number } }>({
        url: '/simple/price',
        params: {
          ids: coinId,
          vsCurrencies: 'usd',
        },
      })

      const priceData = response[coinId]
      if (!priceData || typeof priceData.usd !== 'number') {
        throw new NotFoundException(`Token ${symbol} not found on CoinGecko`)
      }

      const price = priceData.usd

      // Validate price is valid number
      if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price received from CoinGecko: ${price}`)
      }

      this.logger.debug({
        message: 'Successfully fetched price from CoinGecko',
        symbol,
        normalizedSymbol,
        coinId,
        price,
        provider: this.name,
      })

      return price
    } catch (error: unknown) {
      // Preserve original error type if it's already an HTTP exception
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        this.logger.error({
          message: 'Error fetching price from CoinGecko API',
          symbol,
          normalizedSymbol,
          error: error.message,
          provider: this.name,
        })
        throw error
      }

      // Log and wrap unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error({
        message: 'Unexpected error fetching price from CoinGecko API',
        symbol,
        normalizedSymbol,
        error: errorMessage,
        provider: this.name,
      })

      throw new NotFoundException(`Cannot find price for symbol ${symbol} on CoinGecko: ${errorMessage}`)
    }
  }
}
