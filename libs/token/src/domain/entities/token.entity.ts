import { z } from 'zod'

export const TokenPriceSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.string(),
  currentPrice: z.number(),
  marketCap: z.number(),
})

export const CoinGeckoTokenSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.string(),
  currentPrice: z.number(),
  marketCap: z.number(),
  marketCapRank: z.number(),
  fullyDilutedValuation: z.number().nullable(),
  totalVolume: z.number(),
  high24h: z.number(),
  low24h: z.number(),
  priceChange24h: z.number(),
  priceChangePercentage24h: z.number(),
  marketCapChange24h: z.number(),
  marketCapChangePercentage24h: z.number(),
  circulatingSupply: z.number(),
  totalSupply: z.number().nullable(),
  maxSupply: z.number().nullable(),
  ath: z.number(),
  athChangePercentage: z.number(),
  athDate: z.string(),
  atl: z.number(),
  atlChangePercentage: z.number(),
  atlDate: z.string(),
  roi: z
    .object({
      times: z.number(),
      currency: z.string(),
      percentage: z.number(),
    })
    .nullable(),
  lastUpdated: z.string(),
})

export type TokenPrice = z.infer<typeof TokenPriceSchema>
export type CoinGeckoToken = z.infer<typeof CoinGeckoTokenSchema>
