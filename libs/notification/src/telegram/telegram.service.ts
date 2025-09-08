import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AxiosResponse } from 'axios'
import { firstValueFrom } from 'rxjs'

import { SendMessageDto, TelegramMessageOptions } from './dto'
import { TelegramProvider } from './interfaces'

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

    this.logger.debug({
      message: 'Telegram service initialized',
      chatId: this.chatId,
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      operation: 'telegram_service_init',
      timestamp: new Date().toISOString(),
    })
  }

  async sendMessage(message: string, options?: TelegramMessageOptions): Promise<void> {
    try {
      if (!this.validateConfiguration()) {
        this.logger.warn({
          message: 'Telegram service not properly configured, skipping message',
          operation: 'telegram_send_message',
          status: 'skipped',
          timestamp: new Date().toISOString(),
        })
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
        this.logger.debug({
          message: 'Telegram message sent successfully',
          chatId: payload.chat_id,
          messageLength: message.length,
          parseMode: payload.parse_mode,
          operation: 'telegram_send_message',
          status: 'success',
          timestamp: new Date().toISOString(),
        })
      } else {
        this.logger.error({
          message: 'Telegram API returned error',
          responseData: JSON.stringify(response.data),
          chatId: payload.chat_id,
          operation: 'telegram_send_message',
          status: 'api_error',
          timestamp: new Date().toISOString(),
        })
        throw new Error(`Telegram API error: ${response.data?.description || 'Unknown error'}`)
      }
    } catch (error: unknown) {
      // Handle axios error with response
      let errorMessage = 'Unknown error'
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { description?: string } } }
        errorMessage = axiosError.response?.data?.description || 'Unknown error'
      } else if (error instanceof Error) {
        errorMessage = error.message
      }

      const errorStack = error instanceof Error ? error.stack : undefined

      this.logger.error({
        message: 'Failed to send telegram message',
        error: errorMessage,
        stack: errorStack,
        operation: 'telegram_send_message',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })

      // Don't throw in production to avoid breaking the main flow
      if (this.configService.get<string>('NODE_ENV') === 'development') {
        throw new Error(`Telegram notification failed: ${errorMessage}`)
      }
    }
  }

  validateConfiguration(): boolean {
    const isValid = !!(this.botToken && this.chatId)

    if (!isValid) {
      this.logger.warn({
        message: 'Telegram configuration invalid',
        hasToken: !!this.botToken,
        hasChatId: !!this.chatId,
        operation: 'telegram_config_validation',
        status: 'invalid',
        timestamp: new Date().toISOString(),
      })
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
