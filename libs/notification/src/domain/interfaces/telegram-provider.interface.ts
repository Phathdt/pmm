import { INotificationProvider } from './notification-provider.interface'

import { TelegramMessageOptions } from '../schemas'

export interface ITelegramProvider extends INotificationProvider {
  /**
   * Send a message with Telegram-specific options
   * @param message The message content
   * @param options Telegram-specific message options
   */
  sendMessage(message: string, options?: TelegramMessageOptions): Promise<void>
}
