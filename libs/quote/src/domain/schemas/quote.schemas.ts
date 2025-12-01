import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// ============================================
// Request Schemas
// ============================================

export const GetIndicativeQuoteSchema = z.object({
  fromTokenId: z.string(),
  toTokenId: z.string(),
  amount: z.string(),
  sessionId: z.string().optional(),
  deposited: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  tradeTimeout: z.coerce.number().optional(),
  scriptTimeout: z.coerce.number().optional(),
})

export class GetIndicativeQuoteDto extends createZodDto(GetIndicativeQuoteSchema) {}
export type GetIndicativeQuoteData = z.infer<typeof GetIndicativeQuoteSchema>

export const GetCommitmentQuoteSchema = z.object({
  sessionId: z.string(),
  tradeId: z.string(),
  fromTokenId: z.string(),
  toTokenId: z.string(),
  amount: z.string(),
  fromUserAddress: z.string(),
  toUserAddress: z.string(),
  userDepositTx: z.string(),
  userDepositVault: z.string(),
  tradeDeadline: z.string(),
  scriptDeadline: z.string(),
})

export class GetCommitmentQuoteDto extends createZodDto(GetCommitmentQuoteSchema) {}
export type GetCommitmentQuoteData = z.infer<typeof GetCommitmentQuoteSchema>

export const GetLiquidationQuoteSchema = z.object({
  sessionId: z.string(),
  tradeId: z.string(),
  fromTokenId: z.string(),
  toTokenId: z.string(),
  amount: z.string(),
  paymentMetadata: z.string(),
  fromUserAddress: z.string(),
  toUserAddress: z.string(),
  userDepositTx: z.string(),
  userDepositVault: z.string(),
  tradeDeadline: z.string(),
  scriptDeadline: z.string(),
})

export class GetLiquidationQuoteDto extends createZodDto(GetLiquidationQuoteSchema) {}
export type GetLiquidationQuoteData = z.infer<typeof GetLiquidationQuoteSchema>

// ============================================
// Response Schemas
// ============================================

export const IndicativeQuoteResponseSchema = z.object({
  sessionId: z.string(),
  pmmReceivingAddress: z.string(),
  indicativeQuote: z.string(),
  error: z.string().optional(),
})

export type IndicativeQuoteResponse = z.infer<typeof IndicativeQuoteResponseSchema>

export const CommitmentQuoteResponseSchema = z.object({
  tradeId: z.string(),
  commitmentQuote: z.string(),
  error: z.string().optional(),
})

export type CommitmentQuoteResponse = z.infer<typeof CommitmentQuoteResponseSchema>

export const LiquidationQuoteResponseSchema = z.object({
  tradeId: z.string(),
  liquidationQuote: z.string(),
  error: z.string().optional(),
})

export type LiquidationQuoteResponse = z.infer<typeof LiquidationQuoteResponseSchema>
