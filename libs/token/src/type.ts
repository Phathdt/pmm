import { z } from 'zod';

export const TokenSchema = z.object({
  id: z.number(),
  networkId: z.string(),
  tokenId: z.string(),
  networkName: z.string(),
  networkSymbol: z.string(),
  networkType: z.string(),
  tokenName: z.string(),
  tokenSymbol: z.string(),
  tokenAddress: z.string(),
  tokenDecimals: z.number(),
  tokenLogoUri: z.string(),
  networkLogoUri: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TokenPriceSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.string(),
  currentPrice: z.number(),
  marketCap: z.number(),
});

export type TokenPrice = z.infer<typeof TokenPriceSchema>;

export type Token = z.infer<typeof TokenSchema>;
export const ResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    traceId: z.string(),
  });

export type IResponse<T> = z.infer<
  ReturnType<typeof ResponseSchema<z.ZodType<T>>>
>;
