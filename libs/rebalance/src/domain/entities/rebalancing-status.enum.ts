export enum RebalancingStatus {
  // Initial state - trade detected, pending verification
  PENDING = 'PENDING',

  // Verification states
  MEMPOOL_VERIFIED = 'MEMPOOL_VERIFIED',

  // NEAR 1Click states
  QUOTE_REQUESTED = 'QUOTE_REQUESTED',
  QUOTE_ACCEPTED = 'QUOTE_ACCEPTED', // Quote accepted, waiting for BTC transfer to NEAR vault
  DEPOSIT_SUBMITTED = 'DEPOSIT_SUBMITTED',
  SWAP_PROCESSING = 'SWAP_PROCESSING',

  // Terminal states
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  STUCK = 'STUCK',
  REFUNDED = 'REFUNDED',
}

export const RETRYABLE_STATUSES = [RebalancingStatus.PENDING, RebalancingStatus.FAILED] as const
