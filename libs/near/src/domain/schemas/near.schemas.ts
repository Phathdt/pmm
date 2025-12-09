import { z } from 'zod'

// Enums
export enum NearSwapType {
  EXACT_INPUT = 'EXACT_INPUT',
  EXACT_OUTPUT = 'EXACT_OUTPUT',
  FLEX_INPUT = 'FLEX_INPUT',
  ANY_INPUT = 'ANY_INPUT',
}

export enum NearDepositMode {
  SIMPLE = 'SIMPLE',
  MEMO = 'MEMO',
}

export enum NearDepositType {
  ORIGIN_CHAIN = 'ORIGIN_CHAIN',
  INTENTS = 'INTENTS',
}

export enum NearRecipientType {
  DESTINATION_CHAIN = 'DESTINATION_CHAIN',
  INTENTS = 'INTENTS',
}

export enum NearStatus {
  KNOWN_DEPOSIT_TX = 'KNOWN_DEPOSIT_TX',
  PENDING_DEPOSIT = 'PENDING_DEPOSIT',
  INCOMPLETE_DEPOSIT = 'INCOMPLETE_DEPOSIT',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

// App fee schema
export const NearAppFeeSchema = z.object({
  recipient: z.string(),
  fee: z.number(),
})

export type NearAppFee = z.infer<typeof NearAppFeeSchema>

// Quote request schema (matches actual API)
export const NearQuoteRequestSchema = z.object({
  dry: z.boolean(),
  depositMode: z.enum(NearDepositMode).optional().default(NearDepositMode.SIMPLE),
  swapType: z.enum(NearSwapType),
  slippageTolerance: z.number(), // basis points (e.g., 500 = 5%)
  originAsset: z.string(), // e.g., "nep141:btc.omft.near"
  depositType: z.enum(NearDepositType),
  destinationAsset: z.string(), // e.g., "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near"
  amount: z.string(),
  refundTo: z.string(), // BTC refund address
  refundType: z.enum(NearDepositType),
  recipient: z.string(), // Destination address (e.g., EVM address)
  recipientType: z.enum(NearRecipientType),
  deadline: z.string(), // ISO date string
  referral: z.string().optional(),
  quoteWaitingTimeMs: z.number().optional().default(3000),
  sessionId: z.string().optional(), // Should be unique (uuidv7)
  connectedWallets: z.array(z.string()).optional(),
  virtualChainRecipient: z.string().optional(),
  virtualChainRefundRecipient: z.string().optional(),
  customRecipientMsg: z.string().optional(),
  appFees: z.array(NearAppFeeSchema).optional(),
})

// Input type - what the user passes in (defaults don't need to be provided)
export type NearQuoteRequestInput = z.input<typeof NearQuoteRequestSchema>
// Output type - after parsing with defaults applied
export type NearQuoteRequest = z.output<typeof NearQuoteRequestSchema>

// Quote schema (inner quote object)
export const NearQuoteSchema = z.object({
  depositAddress: z.string(),
  depositMemo: z.string().optional(),
  amountIn: z.string(),
  amountInFormatted: z.string(),
  amountInUsd: z.string(),
  minAmountIn: z.string(),
  amountOut: z.string(),
  amountOutFormatted: z.string(),
  amountOutUsd: z.string(),
  minAmountOut: z.string(),
  deadline: z.string(),
  timeWhenInactive: z.string(),
  timeEstimate: z.number(),
  virtualChainRecipient: z.string().optional(),
  virtualChainRefundRecipient: z.string().optional(),
  customRecipientMsg: z.string().optional(),
})

export type NearQuote = z.infer<typeof NearQuoteSchema>

// Quote response schema
export const NearQuoteResponseSchema = z.object({
  timestamp: z.string(),
  signature: z.string(),
  quoteRequest: NearQuoteRequestSchema,
  quote: NearQuoteSchema,
})

export type NearQuoteResponse = z.infer<typeof NearQuoteResponseSchema>

// Transaction details schema
export const NearTransactionDetailsSchema = z.object({
  hash: z.string(),
  blockchain: z.string().optional(),
})

export type NearTransactionDetails = z.infer<typeof NearTransactionDetailsSchema>

// Swap details schema
export const NearSwapDetailsSchema = z.object({
  intentHashes: z.array(z.string()),
  nearTxHashes: z.array(z.string()),
  amountIn: z.string(),
  amountInFormatted: z.string(),
  amountInUsd: z.string(),
  amountOut: z.string(),
  amountOutFormatted: z.string(),
  amountOutUsd: z.string(),
  slippage: z.number(),
  originChainTxHashes: z.array(NearTransactionDetailsSchema),
  destinationChainTxHashes: z.array(NearTransactionDetailsSchema),
  refundedAmount: z.string().optional(),
  refundedAmountFormatted: z.string().optional(),
  refundedAmountUsd: z.string().optional(),
  depositedAmount: z.string().optional(),
  depositedAmountFormatted: z.string().optional(),
  depositedAmountUsd: z.string().optional(),
  referral: z.string().optional(),
})

export type NearSwapDetails = z.infer<typeof NearSwapDetailsSchema>

// Status response schema
export const NearStatusResponseSchema = z.object({
  quoteResponse: NearQuoteResponseSchema,
  status: z.enum(NearStatus),
  updatedAt: z.string(),
  swapDetails: NearSwapDetailsSchema,
})

export type NearStatusResponse = z.infer<typeof NearStatusResponseSchema>

// Submit deposit request schema
export const NearSubmitDepositRequestSchema = z.object({
  txHash: z.string(),
  depositAddress: z.string(),
  nearSenderAccount: z.string().optional(),
  memo: z.string().optional(),
})

export type NearSubmitDepositRequest = z.infer<typeof NearSubmitDepositRequestSchema>

// Submit deposit response (same as status response)
export const NearSubmitDepositResponseSchema = NearStatusResponseSchema

export type NearSubmitDepositResponse = z.infer<typeof NearSubmitDepositResponseSchema>
