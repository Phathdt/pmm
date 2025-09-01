import { Injectable, Logger } from '@nestjs/common'

import { TelegramMessageOptions, TelegramService } from './telegram'

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)

  constructor(private readonly telegramService: TelegramService) {
    this.logger.debug('Notification service initialized')
  }

  /**
   * Send a telegram message
   * @param message The message content
   * @param options Telegram-specific options
   */
  async sendTelegramMessage(message: string, options?: TelegramMessageOptions): Promise<void> {
    try {
      if (!this.telegramService.validateConfiguration()) {
        this.logger.warn('Telegram service not configured, skipping notification')
        return
      }

      await this.telegramService.sendMessage(message, options)
      this.logger.debug('Telegram notification sent successfully')
    } catch (error: any) {
      this.logger.error(`Failed to send telegram notification: ${error.message}`, error.stack)

      // Don't throw to avoid breaking the main business flow
      // The TelegramService already handles error logging
    }
  }

  /**
   * Send a formatted telegram message (HTML or Markdown)
   * @param message The formatted message content
   * @param parseMode The parse mode to use
   * @param options Additional options
   */
  async sendFormattedTelegramMessage(
    message: string,
    parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
    options?: TelegramMessageOptions
  ): Promise<void> {
    await this.sendTelegramMessage(message, {
      ...options,
      parseMode,
    })
  }

  /**
   * Send a silent telegram notification
   * @param message The message content
   * @param options Additional options
   */
  async sendSilentTelegramMessage(message: string, options?: TelegramMessageOptions): Promise<void> {
    await this.sendTelegramMessage(message, {
      ...options,
      silent: true,
    })
  }

  /**
   * Get all notification providers status
   */
  getProvidersStatus(): {
    telegram: ReturnType<TelegramService['getConfigurationStatus']>
  } {
    return {
      telegram: this.telegramService.getConfigurationStatus(),
    }
  }

  /**
   * Check if any notification provider is configured
   */
  hasAnyProviderConfigured(): boolean {
    return this.telegramService.validateConfiguration()
  }

  // Future: Add email, SMS, push notification methods
  // async sendEmail(to: string, subject: string, content: string, options?: EmailOptions): Promise<void>
  // async sendSms(to: string, message: string, options?: SmsOptions): Promise<void>
  // async sendPushNotification(deviceId: string, title: string, message: string, options?: PushOptions): Promise<void>
}
