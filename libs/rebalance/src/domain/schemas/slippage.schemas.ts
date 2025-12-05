import { z } from 'zod'

export const SlippageCheckResultSchema = z.object({
  isAcceptable: z.boolean(),
  slippageBps: z.number(),
  expectedUsd: z.number(),
  actualUsd: z.number(),
  thresholdBps: z.number(),
  isHighWarning: z.boolean(),
})

export type SlippageCheckResult = z.infer<typeof SlippageCheckResultSchema>
