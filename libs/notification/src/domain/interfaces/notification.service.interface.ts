import { TelegramMessageOptions } from '../schemas'

export interface INotificationService {
  /**
   * Send a telegram message
   * @param message The message content
   * @param options Telegram-specific options
   */
  sendTelegramMessage(message: string, options?: TelegramMessageOptions): Promise<void>

  // Future notification methods
  // sendEmail(to: string, subject: string, content: string, options?: EmailOptions): Promise<void>
  // sendSms(to: string, message: string, options?: SmsOptions): Promise<void>
  // sendPushNotification(deviceId: string, title: string, message: string, options?: PushOptions): Promise<void>
}
