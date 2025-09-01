import { NotificationProvider } from '../../interfaces'
import { TelegramMessageOptions } from '../dto'

export interface TelegramProvider extends NotificationProvider {
  /**
   * Send a message with Telegram-specific options
   * @param message The message content
   * @param options Telegram-specific message options
   */
  sendMessage(message: string, options?: TelegramMessageOptions): Promise<void>

  /**
   * Send a formatted message (HTML or Markdown)
   * @param message The formatted message content
   * @param parseMode The parse mode to use
   * @param options Additional options
   */
  sendFormattedMessage(
    message: string,
    parseMode: 'HTML' | 'Markdown' | 'MarkdownV2',
    options?: TelegramMessageOptions
  ): Promise<void>

  /**
   * Send a silent notification
   * @param message The message content
   * @param options Additional options
   */
  sendSilentMessage(message: string, options?: TelegramMessageOptions): Promise<void>
}
