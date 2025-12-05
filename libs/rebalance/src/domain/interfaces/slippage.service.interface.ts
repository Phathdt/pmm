import { SlippageCheckResult } from '../schemas'

export interface ISlippageService {
  getBtcPrice(): Promise<number>
  /**
   * Check slippage using satoshi amounts (BigInt for precision)
   * @param btcAmountSats - BTC amount in satoshis (bigint)
   * @param quoteUsdcAmount - USDC amount from quote (string, will be parsed)
   */
  checkSlippage(btcAmountSats: bigint, quoteUsdcAmount: string): Promise<SlippageCheckResult>
}
