import { z } from 'zod'

// Transaction Receipt Schema
export const TransactionReceiptSchema = z.object({
  hash: z.string(),
  status: z.number(), // 1 for success, 0 for failure
  blockNumber: z.number(),
  confirmations: z.number(),
  gasUsed: z.string(),
})

export type TransactionReceipt = z.infer<typeof TransactionReceiptSchema>

// Transaction Status Schema
export const TransactionStatusSchema = z.object({
  exists: z.boolean(),
  inMempool: z.boolean(),
  confirmed: z.boolean(),
  receipt: TransactionReceiptSchema.nullable(),
  error: z.string().optional(),
})

export type TransactionStatus = z.infer<typeof TransactionStatusSchema>

// Transaction Data Schema
export const TransactionDataSchema = z.object({
  to: z.string().optional(),
  data: z.string().optional(),
  value: z.bigint().optional(),
  gasLimit: z.bigint().optional(),
  gasPrice: z.bigint().optional(),
  from: z.string().optional(),
})

export type TransactionData = z.infer<typeof TransactionDataSchema>

// Transaction Options Schema
export const TransactionOptionsSchema = z.object({
  // Gas limit options
  gasBufferPercentage: z.number().optional(),
  minGasBuffer: z.number().optional(),
  maxGasLimit: z.bigint().optional(),
  fallbackGasLimit: z.bigint().optional(),
  description: z.string().optional(),
  gasLimit: z.bigint().optional(),
  value: z.bigint().optional(),

  // Enhanced gas price options
  gasPrice: z.bigint().optional(),
  maxFeePerGas: z.bigint().optional(),
  maxPriorityFeePerGas: z.bigint().optional(),
  gasPriceBufferPercentage: z.number().optional(),
  maxGasPrice: z.bigint().optional(),
  fallbackGasPrice: z.bigint().optional(),

  // Nonce retry options
  maxNonceRetries: z.number().int().nonnegative().optional(), // Max retries on nonce errors (default: 1)
})

export type TransactionOptions = z.infer<typeof TransactionOptionsSchema>

// Transaction Result Schema
export const TransactionResultSchema = z.object({
  hash: z.string(),
  gasUsed: z.bigint().optional(),
  effectiveGasPrice: z.bigint().optional(),
  blockNumber: z.number().optional(),
  nonce: z.number().optional(),
  gasLimit: z.bigint().optional(),
  gasPrice: z.bigint().optional(),
  maxFeePerGas: z.bigint().optional(),
  maxPriorityFeePerGas: z.bigint().optional(),
})

export type TransactionResult = z.infer<typeof TransactionResultSchema>
