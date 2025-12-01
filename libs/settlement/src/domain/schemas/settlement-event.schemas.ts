import { z } from 'zod'

/**
 * Event data for submit settlement queue
 */
export const SubmitSettlementEventSchema = z.object({
  tradeId: z.string(),
  paymentTxId: z.string(),
})

export type SubmitSettlementEvent = z.infer<typeof SubmitSettlementEventSchema>

/**
 * Event data for transfer settlement queues
 */
export const TransferSettlementEventSchema = z.object({
  tradeId: z.string(),
})

export type TransferSettlementEvent = z.infer<typeof TransferSettlementEventSchema>
