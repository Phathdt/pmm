import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { ReqService } from '@optimex-pmm/req'

import { BinancePriceTicker, ITokenPriceProvider, PriceProvider } from '../../domain'
import { normalizeSymbol } from '../../utils'

@Injectable()
export class BinancePriceProvider implements ITokenPriceProvider {
  readonly name = PriceProvider.BINANCE
  private readonly logger: EnhancedLogger

  constructor(
    @Inject('BINANCE_REQ_SERVICE') private readonly reqService: ReqService,
    logger: EnhancedLogger
  ) {
    this.logger = logger.with({ context: BinancePriceProvider.name })
  }

  async getTokenPrice(symbol: string): Promise<number> {
    // Validate input
    if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
      throw new BadRequestException('Token symbol must be a non-empty string')
    }

    const normalizedSymbol = normalizeSymbol(symbol.trim())
    const binanceSymbol = normalizedSymbol.toUpperCase() + 'USDT'

    try {
      const response = await this.reqService.get<BinancePriceTicker>({
        url: `/ticker/price?symbol=${binanceSymbol}`,
        skipCaseConversion: true, // Binance uses uppercase, no snake_case
      })

      const price = parseFloat(response.price)

      // Validate price is valid number
      if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price received from Binance: ${response.price}`)
      }

      this.logger.debug({
        message: 'Successfully fetched price from Binance',
        symbol,
        normalizedSymbol,
        price,
        provider: this.name,
      })

      return price
    } catch (error: unknown) {
      // Preserve original error type if it's already an HTTP exception
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        this.logger.error({
          message: 'Error fetching price from Binance API',
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
        message: 'Unexpected error fetching price from Binance API',
        symbol,
        normalizedSymbol,
        error: errorMessage,
        provider: this.name,
      })

      throw new NotFoundException(`Cannot find price for symbol ${symbol} on Binance: ${errorMessage}`)
    }
  }
}
