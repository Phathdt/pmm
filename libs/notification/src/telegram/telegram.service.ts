import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AxiosResponse } from 'axios'
import { firstValueFrom } from 'rxjs'

import { SendMessageDto, TelegramMessageOptions } from './dto'
import { TelegramProvider } from './interfaces/telegram.interface'

@Injectable()
export class TelegramService implements TelegramProvider {
  private readonly logger = new Logger(TelegramService.name)
  private readonly botToken: string
  private readonly chatId: string
  private readonly baseUrl: string
  private readonly timeout: number

  readonly providerName = 'telegram'

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    this.botToken = this.configService.getOrThrow<string>('BOT_TOKEN')
    this.chatId = this.configService.getOrThrow<string>('CHAT_ID')
    this.baseUrl = this.configService.get<string>('TELEGRAM_BASE_URL') || 'https://api.telegram.org'
    this.timeout = this.configService.get<number>('TELEGRAM_TIMEOUT') || 10000

    this.logger.debug(`Telegram service initialized with chat ID: ${this.chatId}`)
  }

  async sendMessage(message: string, options?: TelegramMessageOptions): Promise<void> {
    try {
      if (!this.validateConfiguration()) {
        this.logger.warn('Telegram service not properly configured, skipping message')
        return
      }

      const payload: SendMessageDto = {
        chat_id: options?.chatId || this.chatId,
        text: message,
        parse_mode: options?.parseMode || 'HTML',
        disable_notification: options?.silent || false,
        protect_content: options?.protectContent || false,
        reply_to_message_id: options?.replyToMessageId,
        allow_sending_without_reply: true,
      }

      const url = `${this.baseUrl}/bot${this.botToken}/sendMessage`

      const response: AxiosResponse = await firstValueFrom(
        this.httpService.post(url, payload, {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )

      if (response.data?.ok) {
        this.logger.debug(`Message sent successfully to chat ${payload.chat_id}`)
      } else {
        this.logger.error(`Telegram API returned error: ${JSON.stringify(response.data)}`)
        throw new Error(`Telegram API error: ${response.data?.description || 'Unknown error'}`)
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.description || error.message || 'Unknown error'
      this.logger.error(`Failed to send telegram message: ${errorMessage}`, error.stack)

      // Don't throw in production to avoid breaking the main flow
      if (this.configService.get<string>('NODE_ENV') === 'development') {
        throw new Error(`Telegram notification failed: ${errorMessage}`)
      }
    }
  }

  async sendFormattedMessage(
    message: string,
    parseMode: 'HTML' | 'Markdown' | 'MarkdownV2',
    options?: TelegramMessageOptions
  ): Promise<void> {
    await this.sendMessage(message, {
      ...options,
      parseMode,
    })
  }

  async sendSilentMessage(message: string, options?: TelegramMessageOptions): Promise<void> {
    await this.sendMessage(message, {
      ...options,
      silent: true,
    })
  }

  validateConfiguration(): boolean {
    const isValid = !!(this.botToken && this.chatId)

    if (!isValid) {
      this.logger.warn('Telegram configuration invalid: missing botToken or chatId')
    }

    return isValid
  }

  /**
   * Get current configuration status
   */
  getConfigurationStatus(): {
    isConfigured: boolean
    hasToken: boolean
    hasChatId: boolean
    providerName: string
  } {
    return {
      isConfigured: this.validateConfiguration(),
      hasToken: !!this.botToken,
      hasChatId: !!this.chatId,
      providerName: this.providerName,
    }
  }
}
