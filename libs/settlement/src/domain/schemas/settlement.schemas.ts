import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// ============================================
// Settlement Signature Schemas
// ============================================

export const GetSettlementSignatureSchema = z.object({
  tradeId: z.string(),
  committedQuote: z.string(),
  tradeDeadline: z.string(),
  scriptDeadline: z.string(),
})

export class GetSettlementSignatureDto extends createZodDto(GetSettlementSignatureSchema) {}
export type GetSettlementSignatureData = z.infer<typeof GetSettlementSignatureSchema>

export const SettlementSignatureResponseSchema = z.object({
  tradeId: z.string(),
  signature: z.string(),
  deadline: z.number(),
  error: z.string().optional(),
})

export class SettlementSignatureResponseDto extends createZodDto(SettlementSignatureResponseSchema) {}
export type SettlementSignatureResponse = z.infer<typeof SettlementSignatureResponseSchema>

// ============================================
// Ack Settlement Schemas
// ============================================

export const AckSettlementSchema = z.object({
  tradeId: z.string(),
  tradeDeadline: z.string(),
  scriptDeadline: z.string(),
  chosen: z.boolean(),
})

export class AckSettlementDto extends createZodDto(AckSettlementSchema) {}
export type AckSettlementData = z.infer<typeof AckSettlementSchema>

export const AckSettlementResponseSchema = z.object({
  tradeId: z.string(),
  status: z.literal('acknowledged'),
  error: z.string().optional(),
})

export class AckSettlementResponseDto extends createZodDto(AckSettlementResponseSchema) {}
export type AckSettlementResponse = z.infer<typeof AckSettlementResponseSchema>

// ============================================
// Signal Payment Schemas
// ============================================

export const SignalPaymentSchema = z.object({
  tradeId: z.string(),
  tradeDeadline: z.string(),
  scriptDeadline: z.string(),
})

export class SignalPaymentDto extends createZodDto(SignalPaymentSchema) {}
export type SignalPaymentData = z.infer<typeof SignalPaymentSchema>

export const SignalPaymentResponseSchema = z.object({
  tradeId: z.string(),
  status: z.literal('acknowledged'),
  error: z.string().optional(),
})

export class SignalPaymentResponseDto extends createZodDto(SignalPaymentResponseSchema) {}
export type SignalPaymentResponse = z.infer<typeof SignalPaymentResponseSchema>

// ============================================
// PMM Info Response Schema
// ============================================

export const PmmInfoResponseSchema = z.object({
  pmmId: z.string(),
  pmmEncodeId: z.string(),
  operatorAddress: z.string(),
  evmReceiverAddress: z.string(),
  btcReceiverAddress: z.string(),
  solanaReceiverAddress: z.string(),
  evmSenderAddress: z.string(),
  btcSenderAddress: z.string(),
  solanaSenderAddress: z.string(),
  contracts: z.object({
    router: z.string(),
    evm: z.record(
      z.string(),
      z.object({
        payment: z.string(),
        liquidation: z.string(),
      })
    ),
    solana: z.object({
      programId: z.string(),
    }),
  }),
})

export class PmmInfoResponseDto extends createZodDto(PmmInfoResponseSchema) {}
export type PmmInfoResponse = z.infer<typeof PmmInfoResponseSchema>
