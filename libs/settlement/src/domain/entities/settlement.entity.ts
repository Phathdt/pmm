import { Token } from '@optimex-xyz/market-maker-sdk'

/**
 * Payment metadata for liquidation trades
 */
export interface PaymentLiquidMetadata {
  paymentMetadata?: string
}

/**
 * Parameters required for executing a transfer
 */
export interface TransferParams {
  toAddress: string
  amount: bigint
  token: Token
  tradeId: string
}

/**
 * Result of a transfer operation
 */
export interface TransferResult {
  hash: string
  // Gas details for record keeping (EVM specific)
  nonce?: number
  gasLimit?: bigint
  gasPrice?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}
