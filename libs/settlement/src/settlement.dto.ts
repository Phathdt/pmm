import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GetSettlementSignatureSchema = z.object({
  tradeId: z.string(),
  committedQuote: z.string(),
  settlementQuote: z.string(),
});

export class GetSettlementSignatureDto extends createZodDto(
  GetSettlementSignatureSchema
) {}

export const SettlementSignatureResponseSchema = z.object({
  tradeId: z.string(),
  signature: z.string(),
  error: z.string().optional(),
});

export class SettlementSignatureResponseDto extends createZodDto(
  SettlementSignatureResponseSchema
) {}

export const AckSettlementSchema = z.object({
  tradeId: z.string(),
});

export class AckSettlementDto extends createZodDto(AckSettlementSchema) {}

export const AckSettlementResponseSchema = z.object({
  tradeId: z.string(),
  status: z.literal('acknowledged'),
  error: z.string().optional(),
});

export class AckSettlementResponseDto extends createZodDto(
  AckSettlementResponseSchema
) {}
