import { Inject, Injectable } from '@nestjs/common'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'

import { INotificationService, ITelegramProvider, TelegramMessageOptions } from '../../domain'
import { TELEGRAM_PROVIDER } from '../../infras'

@Injectable()
export class NotificationService implements INotificationService {
  private readonly logger: EnhancedLogger

  constructor(
    @Inject(TELEGRAM_PROVIDER) private readonly telegramProvider: ITelegramProvider,
    logger: EnhancedLogger
  ) {
    this.logger = logger.with({ context: NotificationService.name })
    this.logger.debug({
      message: 'Notification service initialized',
      operation: 'service_initialization',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Send a telegram message
   * @param message The message content
   * @param options Telegram-specific options
   */
  async sendTelegramMessage(message: string, options?: TelegramMessageOptions): Promise<void> {
    try {
      if (!this.telegramProvider.validateConfiguration()) {
        this.logger.warn({
          message: 'Telegram service not configured, skipping notification',
          operation: 'telegram_notification',
          status: 'skipped',
          timestamp: new Date().toISOString(),
        })
        return
      }

      await this.telegramProvider.sendMessage(message, options)
      this.logger.debug({
        message: 'Telegram notification sent successfully',
        operation: 'telegram_notification',
        status: 'success',
        timestamp: new Date().toISOString(),
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      const errorStack = error instanceof Error ? error.stack : undefined

      this.logger.error({
        message: 'Failed to send telegram notification',
        error: errorMessage,
        stack: errorStack,
        operation: 'telegram_notification',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })

      // Don't throw to avoid breaking the main business flow
      // The TelegramService already handles error logging
    }
  }

  // Future: Add email, SMS, push notification methods
  // async sendEmail(to: string, subject: string, content: string, options?: EmailOptions): Promise<void>
  // async sendSms(to: string, message: string, options?: SmsOptions): Promise<void>
  // async sendPushNotification(deviceId: string, title: string, message: string, options?: PushOptions): Promise<void>
}
