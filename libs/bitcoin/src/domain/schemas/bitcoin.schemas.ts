import { z } from 'zod'

export const TransactionStatusSchema = z.object({
  confirmed: z.boolean(),
  block_height: z.number().optional().nullable(),
  block_hash: z.string().optional().nullable(),
  block_time: z.number().optional().nullable(),
})
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>

export const TransactionVoutSchema = z.object({
  scriptpubkey: z.string().optional(),
  scriptpubkey_asm: z.string().optional(),
  scriptpubkey_type: z.string().optional(),
  scriptpubkey_address: z.string().optional(),
  value: z.number(),
})
export type TransactionVout = z.infer<typeof TransactionVoutSchema>

export const TransactionResponseSchema = z.object({
  txid: z.string(),
  status: TransactionStatusSchema,
  vout: z.array(TransactionVoutSchema).optional(),
})
export type TransactionResponse = z.infer<typeof TransactionResponseSchema>

export const UtxoSchema = z.object({
  txid: z.string(),
  vout: z.number(),
  value: z.number(),
  status: z.object({
    confirmed: z.boolean(),
    block_height: z.number().optional(),
    block_hash: z.string().optional(),
    block_time: z.number().optional(),
  }),
})
export type Utxo = z.infer<typeof UtxoSchema>

export const FeeEstimatesSchema = z.record(z.string(), z.number())
export type FeeEstimates = z.infer<typeof FeeEstimatesSchema>
