import { z } from 'zod'

// Pure Zod Schema Definitions
export const TokenQuoteCalculationDataSchema = z.object({
  amountIn: z.string(),
  fromTokenId: z.string(),
  toTokenId: z.string(),
  isCommitment: z.boolean().optional().default(false),
})

export const TokenValidationDataSchema = z.object({
  amount: z.string(),
  tokenId: z.string(),
  validationType: z.enum(['indicative', 'commitment']),
})

export const CoinGeckoApiParamsSchema = z.object({
  vs_currency: z.string().default('usd'),
  order: z.string().default('market_cap_desc'),
  per_page: z.number().default(100),
  page: z.number().default(1),
  sparkline: z.boolean().default(false),
})

// TypeScript Types inferred from Schemas
export type TokenQuoteCalculationData = z.infer<typeof TokenQuoteCalculationDataSchema>
export type TokenValidationData = z.infer<typeof TokenValidationDataSchema>
export type CoinGeckoApiParams = z.infer<typeof CoinGeckoApiParamsSchema>
