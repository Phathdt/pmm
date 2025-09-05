import { z } from 'zod'

export enum TradeTypeEnum {
  SWAP = 'swap',
  LENDING = 'lending',
}

export enum TradeStatus {
  PENDING = 'PENDING',
  QUOTE_PROVIDED = 'QUOTE_PROVIDED',
  COMMITTED = 'COMMITTED',
  SETTLING = 'SETTLING',
  COMPLETED = 'COMPLETED',
  SELECTED = 'SELECTED',
  FAILED = 'FAILED',
}

export const TradeEntitySchema = z.object({
  id: z.number(),
  tradeId: z.string(),
  fromTokenId: z.string(),
  fromNetworkId: z.string(),
  toTokenId: z.string(),
  toNetworkId: z.string(),
  fromUser: z.string(),
  toUser: z.string(),
  amount: z.string(),
  status: z.enum(TradeStatus),
  userDepositTx: z.string().optional(),
  userDepositVault: z.string().optional(),
  tradeDeadline: z.string().optional(),
  scriptDeadline: z.string().optional(),
  isLiquid: z.boolean().optional(),
  positionId: z.string().optional(),
  liquidationId: z.string().optional(),
  apm: z.string().optional(),
  validatorSignature: z.string().optional(),
  tradeType: z.enum(TradeTypeEnum).optional(),
  indicativeQuote: z.string().optional(),
  commitmentQuote: z.string().optional(),
  settlementQuote: z.string().optional(),
  executedPriceUsd: z.number().optional(),
  settlementTx: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type TradeEntity = z.infer<typeof TradeEntitySchema>
