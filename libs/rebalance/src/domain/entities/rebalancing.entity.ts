import { z } from 'zod'

import { RebalancingStatus } from './rebalancing-status.enum'

export const RebalancingSchema = z.object({
  id: z.number(),
  rebalancingId: z.string(), // Unique hex string for logging/debugging
  tradeHash: z.string(),
  tradeId: z.string().optional().nullable(),
  amount: z.string(),
  realAmount: z.string().optional().nullable(), // Actual amount after fees deducted
  txId: z.string().optional().nullable(),
  vaultAddress: z.string().optional().nullable(),
  optimexStatus: z.string().optional().nullable(),
  mempoolVerified: z.boolean().default(false),
  depositAddress: z.string().optional().nullable(),
  nearVaultTxId: z.string().optional().nullable(), // BTC transfer to NEAR vault
  quoteId: z.string().optional().nullable(),
  oraclePrice: z.string().optional().nullable(),
  quotePrice: z.string().optional().nullable(),
  slippageBps: z.number().optional().nullable(),
  expectedUsdc: z.string().optional().nullable(),
  actualUsdc: z.string().optional().nullable(),
  nearTxId: z.string().optional().nullable(),
  nearDepositId: z.string().optional().nullable(),
  status: z.enum(RebalancingStatus),
  retryCount: z.number().default(0),
  error: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  tradeCompletedAt: z.date(), // When trade became COMPLETED, used for retry time limit
})

export type Rebalancing = z.infer<typeof RebalancingSchema>

export const CreateRebalancingSchema = z.object({
  tradeHash: z.string().min(1),
  tradeId: z.string().optional(),
  amount: z.string().min(1),
  realAmount: z.string().optional(), // Actual amount after fees deducted
  txId: z.string().optional(),
  vaultAddress: z.string().optional(),
  optimexStatus: z.string().optional(),
  tradeCompletedAt: z.date().default(() => new Date()), // When trade became COMPLETED
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateRebalancingInput = z.infer<typeof CreateRebalancingSchema>

export const UpdateRebalancingSchema = z.object({
  txId: z.string().optional(),
  realAmount: z.string().optional(), // Actual amount after fees deducted
  vaultAddress: z.string().optional(),
  optimexStatus: z.string().optional(),
  mempoolVerified: z.boolean().optional(),
  depositAddress: z.string().optional(),
  nearVaultTxId: z.string().optional(), // BTC transfer to NEAR vault
  quoteId: z.string().optional(),
  oraclePrice: z.string().optional(),
  quotePrice: z.string().optional(),
  slippageBps: z.number().optional(),
  expectedUsdc: z.string().optional(),
  actualUsdc: z.string().optional(),
  nearTxId: z.string().optional(),
  nearDepositId: z.string().optional(),
  error: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type UpdateRebalancingInput = z.infer<typeof UpdateRebalancingSchema>
