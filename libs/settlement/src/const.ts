export const SETTLEMENT_QUEUE = {
  // Platform-specific transfer queues (Bull queues)
  EVM_TRANSFER: {
    NAME: 'evm_transfer_settlement_queue',
    JOBS: {
      PROCESS: 'process_transfer',
    },
  },
  BTC_TRANSFER: {
    NAME: 'btc_transfer_settlement_queue',
    JOBS: {
      PROCESS: 'process_transfer',
    },
  },
  SOLANA_TRANSFER: {
    NAME: 'solana_transfer_settlement_queue',
    JOBS: {
      PROCESS: 'process_transfer',
    },
  },
  SUBMIT: {
    NAME: 'submit_settlement_queue',
    JOBS: {
      PROCESS: 'process_submit',
    },
  },
} as const

// Redis queue names (separate from Bull queues to avoid conflicts)
export const SETTLEMENT_REDIS_QUEUE = {
  EVM_TRANSFER: {
    NAME: 'evm_transfer_settlement_redis_queue',
  },
  BTC_TRANSFER: {
    NAME: 'btc_transfer_settlement_redis_queue',
  },
  SOLANA_TRANSFER: {
    NAME: 'solana_transfer_settlement_redis_queue',
  },
  SUBMIT: {
    NAME: 'submit_settlement_redis_queue',
  },
} as const

export const SETTLEMENT_QUEUE_NAMES = [
  SETTLEMENT_QUEUE.EVM_TRANSFER.NAME,
  SETTLEMENT_QUEUE.BTC_TRANSFER.NAME,
  SETTLEMENT_QUEUE.SOLANA_TRANSFER.NAME,
  SETTLEMENT_QUEUE.SUBMIT.NAME,
] as const
