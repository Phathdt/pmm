import { z } from 'zod'

// Base notification options schema
export const NotificationOptionsSchema = z.object({
  silent: z.boolean().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
})

export type NotificationOptions = z.infer<typeof NotificationOptionsSchema>
