import { z } from 'zod'

// Parse mode enum
export const ParseModeSchema = z.enum(['HTML', 'Markdown', 'MarkdownV2'])
export type ParseMode = z.infer<typeof ParseModeSchema>

// Telegram Message Options Schema
export const TelegramMessageOptionsSchema = z.object({
  chatId: z.string().optional(),
  parseMode: ParseModeSchema.optional(),
  silent: z.boolean().optional(),
  protectContent: z.boolean().optional(),
  replyToMessageId: z.number().optional(),
})

export type TelegramMessageOptions = z.infer<typeof TelegramMessageOptionsSchema>

// Send Message DTO Schema (for API payload)
export const SendMessageDtoSchema = z.object({
  chatId: z.union([z.string(), z.number()]),
  text: z.string().min(1).max(4096),
  parseMode: ParseModeSchema.optional(),
  disableNotification: z.boolean().optional(),
  protectContent: z.boolean().optional(),
  replyToMessageId: z.number().optional(),
  allowSendingWithoutReply: z.boolean().optional(),
})

export type SendMessageDto = z.infer<typeof SendMessageDtoSchema>

// Telegram Configuration Status Schema
export const TelegramConfigurationStatusSchema = z.object({
  isConfigured: z.boolean(),
  hasToken: z.boolean(),
  hasChatId: z.boolean(),
  providerName: z.string(),
})

export type TelegramConfigurationStatus = z.infer<typeof TelegramConfigurationStatusSchema>
