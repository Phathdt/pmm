import { z } from 'zod'

import { TradeTypeEnum } from '../entities'

// Pure Zod Schema Definitions
export const CreateTradeDataSchema = z.object({
  tradeId: z.string(),
  fromTokenId: z.string(),
  fromNetworkId: z.string(),
  toTokenId: z.string(),
  toNetworkId: z.string(),
  fromUser: z.string(),
  toUser: z.string(),
  amount: z.string(),
  userDepositTx: z.string(),
  userDepositVault: z.string(),
  tradeDeadline: z.string(),
  scriptDeadline: z.string(),
  isLiquid: z.boolean().optional(),
  positionId: z.string().optional(),
  liquidationId: z.string().optional(),
  apm: z.string().optional(),
  validatorSignature: z.string().optional(),
  tradeType: z.nativeEnum(TradeTypeEnum).optional(),
})

export const UpdateTradeQuoteDataSchema = z.object({
  indicativeQuote: z.string().optional(),
  commitmentQuote: z.string().optional(),
})

// TypeScript Types inferred from Schemas
export type CreateTradeData = z.infer<typeof CreateTradeDataSchema>
export type UpdateTradeQuoteData = z.infer<typeof UpdateTradeQuoteDataSchema>
