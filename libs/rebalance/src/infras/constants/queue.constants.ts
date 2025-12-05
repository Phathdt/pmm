export const REBALANCE_QUEUE = {
  BTC_USDC: {
    NAME: 'rebalance_btc_usdc_queue',
    JOBS: {
      PROCESS: 'process_rebalance',
      TRANSFER: 'transfer_to_near', // BTC transfer to NEAR vault
      POLL_STATUS: 'poll_swap_status',
    },
  },
} as const

export const REBALANCE_QUEUE_NAMES = [REBALANCE_QUEUE.BTC_USDC.NAME] as const
