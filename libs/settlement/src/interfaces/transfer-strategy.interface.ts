import { Token } from '@optimex-xyz/market-maker-sdk'

export interface PaymentLiquidMetadata {
  paymentMetadata?: string
}

export interface TransferParams {
  toAddress: string
  amount: bigint
  token: Token
  tradeId: string
}

export interface TransferResult {
  hash: string
  // Gas details for record keeping
  nonce?: number
  gasLimit?: bigint
  gasPrice?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}

export interface ITransferStrategy {
  transfer(params: TransferParams): Promise<TransferResult>
}
