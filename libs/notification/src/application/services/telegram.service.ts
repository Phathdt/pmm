import { Inject, Injectable } from '@nestjs/common'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { ReqService } from '@optimex-pmm/req'

import { ITelegramProvider, SendMessageDto, TelegramMessageOptions } from '../../domain'
import { TELEGRAM_REQ_SERVICE } from '../../infras'

interface TelegramApiResponse {
  ok: boolean
  description?: string
}

@Injectable()
export class TelegramService implements ITelegramProvider {
  private readonly logger: EnhancedLogger
  private readonly botToken: string
  private readonly chatId: string

  readonly providerName = 'telegram'

  constructor(
    private readonly configService: CustomConfigService,
    @Inject(TELEGRAM_REQ_SERVICE) private readonly reqService: ReqService,
    logger: EnhancedLogger
  ) {
    this.logger = logger.with({ context: TelegramService.name })
    this.botToken = this.configService.telegram.botToken
    this.chatId = this.configService.telegram.chatId

    this.logger.debug({
      message: 'Telegram service initialized',
      chatId: this.chatId,
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
        chatId: options?.chatId || this.chatId,
        text: message,
        parseMode: options?.parseMode || 'HTML',
        disableNotification: options?.silent || false,
        protectContent: options?.protectContent || false,
        replyToMessageId: options?.replyToMessageId,
        allowSendingWithoutReply: true,
      }

      const response = await this.reqService.post<TelegramApiResponse>({
        url: `/bot${this.botToken}/sendMessage`,
        payload,
      })

      if (response?.ok) {
        this.logger.debug({
          message: 'Telegram message sent successfully',
          chatId: payload.chatId,
          messageLength: message.length,
          parseMode: payload.parseMode,
          operation: 'telegram_send_message',
          status: 'success',
          timestamp: new Date().toISOString(),
        })
      } else {
        this.logger.error({
          message: 'Telegram API returned error',
          responseData: JSON.stringify(response),
          chatId: payload.chatId,
          operation: 'telegram_send_message',
          status: 'api_error',
          timestamp: new Date().toISOString(),
        })
        throw new Error(`Telegram API error: ${response?.description || 'Unknown error'}`)
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
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
      if (this.configService.nodeEnv === 'development') {
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
}
