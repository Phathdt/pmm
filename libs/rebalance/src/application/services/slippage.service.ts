import { Inject, Injectable } from '@nestjs/common'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { ITokenService, TOKEN_SERVICE } from '@optimex-pmm/token'

import { ISlippageService, SlippageCheckResult } from '../../domain'

@Injectable()
export class SlippageService implements ISlippageService {
  private readonly logger: EnhancedLogger

  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    private readonly configService: CustomConfigService,
    logger: EnhancedLogger
  ) {
    this.logger = logger.with({ context: SlippageService.name })
  }

  async getBtcPrice(): Promise<number> {
    return this.tokenService.getTokenPrice('BTC')
  }

  async checkSlippage(btcAmountSats: bigint, quoteUsdcAmount: string): Promise<SlippageCheckResult> {
    const btcPrice = await this.getBtcPrice()

    // Use BigInt arithmetic for precision
    // Convert BTC price to micro-USD (6 decimals) to avoid floating point
    const btcPriceMicroUsd = BigInt(Math.round(btcPrice * 1_000_000))

    // expectedUsd in micro-USD = (satoshis * btcPriceMicroUsd) / 100_000_000
    // This gives us: (sats / 1e8) * (price * 1e6) = sats * price / 100
    const expectedUsdMicro = (btcAmountSats * btcPriceMicroUsd) / 100_000_000n

    // Parse actual USDC amount - already in micro-USD (6 decimals)
    // quoteUsdcAmount is in USDC smallest unit (e.g., "91997378" = $91.997378)
    const actualUsdMicro = BigInt(quoteUsdcAmount)

    // Calculate slippage in basis points using BigInt
    // slippageBps = ((expected - actual) * 10000) / expected
    let slippageBps = 0
    if (expectedUsdMicro > 0n) {
      const slippageBpsBigInt = ((expectedUsdMicro - actualUsdMicro) * 10000n) / expectedUsdMicro
      slippageBps = Number(slippageBpsBigInt)
    }

    const slippageConfig = this.configService.rebalance.slippage
    const thresholdBps = slippageConfig.thresholdBps
    const highWarningBps = slippageConfig.highWarningBps

    const isAcceptable = slippageBps <= thresholdBps
    const isHighWarning = slippageBps > highWarningBps && slippageBps <= thresholdBps

    // Convert back to USD for result (for logging/display purposes)
    const expectedUsd = Number(expectedUsdMicro) / 1_000_000
    const actualUsd = Number(actualUsdMicro) / 1_000_000

    if (isHighWarning) {
      this.logger.warn(`High slippage warning: ${slippageBps} bps (threshold: ${thresholdBps} bps)`)
    }

    return {
      isAcceptable,
      slippageBps,
      expectedUsd,
      actualUsd,
      thresholdBps,
      isHighWarning,
    }
  }
}
