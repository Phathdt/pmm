import { NotificationProvider } from '../../interfaces'
import { TelegramMessageOptions } from '../dto'

export interface TelegramProvider extends NotificationProvider {
  /**
   * Send a message with Telegram-specific options
   * @param message The message content
   * @param options Telegram-specific message options
   */
  sendMessage(message: string, options?: TelegramMessageOptions): Promise<void>
}
