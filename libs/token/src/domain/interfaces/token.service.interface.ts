import { Token } from '@optimex-xyz/market-maker-sdk'

import { TokenPrice } from '../entities'
import { TokenQuoteCalculationData, TokenValidationData } from '../schemas'

export interface ITokenService {
  validateIndicativeAmount(validationData: TokenValidationData): Promise<void>
  validateCommitmentAmount(validationData: TokenValidationData): Promise<void>
  calculateBestQuote(calculationData: TokenQuoteCalculationData): Promise<string>
  getTokenByTokenId(tokenId: string): Promise<Token | null>
  getTokenPrice(symbol: string): Promise<TokenPrice>
}
