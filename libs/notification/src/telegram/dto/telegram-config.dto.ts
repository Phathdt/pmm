export interface TelegramMessageOptions {
  /**
   * Override default chat ID for this message
   */
  chatId?: string

  /**
   * Parse mode for the message
   */
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'

  /**
   * Send message silently
   */
  silent?: boolean

  /**
   * Protect content from forwarding
   */
  protectContent?: boolean

  /**
   * Reply to a specific message
   */
  replyToMessageId?: number
}
