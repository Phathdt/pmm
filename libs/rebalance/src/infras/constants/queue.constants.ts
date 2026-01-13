export const REBALANCE_QUEUE = {
  /** Queue for processing rebalance quotes */
  QUOTE: {
    NAME: 'rebalance_quote_queue',
  },
  /** Queue for BTC transfers to NEAR vault */
  TRANSFER: {
    NAME: 'rebalance_transfer_queue',
  },
} as const

export const REBALANCE_QUEUE_NAMES = [REBALANCE_QUEUE.QUOTE.NAME, REBALANCE_QUEUE.TRANSFER.NAME] as const
