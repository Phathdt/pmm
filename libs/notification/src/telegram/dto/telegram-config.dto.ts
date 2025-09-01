export interface TelegramConfigDto {
  /**
   * Telegram bot token obtained from BotFather
   */
  botToken: string

  /**
   * Default chat ID where messages will be sent
   */
  chatId: string

  /**
   * Base URL for Telegram Bot API (optional, defaults to https://api.telegram.org)
   */
  baseUrl?: string

  /**
   * HTTP request timeout in milliseconds (optional, defaults to 10000)
   */
  timeout?: number
}

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
