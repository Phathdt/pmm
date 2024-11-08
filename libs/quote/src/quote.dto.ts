import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Indicative Quote DTOs
export const GetIndicativeQuoteSchema = z.object({
  fromToken: z.string(),
  toToken: z.string(),
  amount: z.string(),
  sessionId: z.string().optional(),
});

export class GetIndicativeQuoteDto extends createZodDto(
  GetIndicativeQuoteSchema
) {}

export const IndicativeQuoteResponseSchema = z.object({
  sessionId: z.string(),
  pmmReceivingAddress: z.string(),
  indicativeQuote: z.string(),
  error: z.string().optional(),
});

export class IndicativeQuoteResponseDto extends createZodDto(
  IndicativeQuoteResponseSchema
) {}

// Commitment Quote DTOs
export const GetCommitmentQuoteSchema = z.object({
  tradeId: z.string(),
  fromToken: z.string(),
  toToken: z.string(),
  amount: z.string(),
  fromUser: z.string(),
  toUser: z.string(),
});

export class GetCommitmentQuoteDto extends createZodDto(
  GetCommitmentQuoteSchema
) {}

export const CommitmentQuoteResponseSchema = z.object({
  tradeId: z.string(),
  commitmentQuote: z.string(),
  error: z.string().optional(),
});

export class CommitmentQuoteResponseDto extends createZodDto(
  CommitmentQuoteResponseSchema
) {}
