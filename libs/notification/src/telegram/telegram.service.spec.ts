import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'

import { AxiosResponse } from 'axios'
import { of, throwError } from 'rxjs'

import { TelegramService } from './telegram.service'

describe('TelegramService', () => {
  let httpService: jest.Mocked<HttpService>

  const mockBotToken = 'test-bot-token'
  const mockChatId = 'test-chat-id'
  const mockBaseUrl = 'https://api.telegram.org'

  beforeEach(async () => {
    const mockHttpService = {
      request: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      head: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      options: jest.fn(),
      postForm: jest.fn(),
      putForm: jest.fn(),
      patchForm: jest.fn(),
      axiosRef: {} as never,
    }

    httpService = mockHttpService as unknown as jest.Mocked<HttpService>
  })

  const createService = (
    config: Partial<{
      botToken?: string | null
      chatId?: string | null
      baseUrl?: string
      timeout?: number
      nodeEnv?: string
    }> = {}
  ) => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'TELEGRAM_BOT_TOKEN':
            return config.botToken !== undefined ? config.botToken : mockBotToken
          case 'TELEGRAM_CHAT_ID':
            return config.chatId !== undefined ? config.chatId : mockChatId
          case 'TELEGRAM_BASE_URL':
            return config.baseUrl || mockBaseUrl
          case 'TELEGRAM_TIMEOUT':
            return config.timeout || 10000
          case 'NODE_ENV':
            return config.nodeEnv || 'test'
          default:
            return undefined
        }
      }),
      getOrThrow: jest.fn((key: string) => {
        switch (key) {
          case 'BOT_TOKEN':
            if (config.botToken === null) throw new Error('Missing BOT_TOKEN')
            return config.botToken !== undefined ? config.botToken : mockBotToken
          case 'CHAT_ID':
            if (config.chatId === null) throw new Error('Missing CHAT_ID')
            return config.chatId !== undefined ? config.chatId : mockChatId
          default:
            throw new Error(`Missing ${key}`)
        }
      }),
    }

    return new TelegramService(mockConfigService as unknown as ConfigService, httpService)
  }

  it('should be defined', () => {
    const service = createService()
    expect(service).toBeDefined()
  })

  describe('validateConfiguration', () => {
    it('should return true when bot token and chat id are present', () => {
      const service = createService()
      expect(service.validateConfiguration()).toBe(true)
    })

    it('should return false when bot token is missing', () => {
      // Service should be created with empty token for validation test
      const service = createService({ botToken: '' })
      expect(service.validateConfiguration()).toBe(false)
    })

    it('should return false when chat id is missing', () => {
      // Service should be created with empty chat id for validation test
      const service = createService({ chatId: '' })
      expect(service.validateConfiguration()).toBe(false)
    })
  })

  describe('sendMessage', () => {
    const mockResponse: AxiosResponse = {
      data: { ok: true, result: { message_id: 123 } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    }

    it('should send message successfully', async () => {
      const service = createService()
      httpService.post.mockReturnValue(of(mockResponse))

      await service.sendMessage('Test message')

      expect(httpService.post).toHaveBeenCalledWith(
        `${mockBaseUrl}/bot${mockBotToken}/sendMessage`,
        {
          chat_id: mockChatId,
          text: 'Test message',
          parse_mode: 'HTML',
          disable_notification: false,
          protect_content: false,
          reply_to_message_id: undefined,
          allow_sending_without_reply: true,
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    })

    it('should send message with custom options', async () => {
      const service = createService()
      httpService.post.mockReturnValue(of(mockResponse))

      await service.sendMessage('Test message', {
        chatId: 'custom-chat',
        parseMode: 'Markdown',
        silent: true,
        protectContent: true,
        replyToMessageId: 456,
      })

      expect(httpService.post).toHaveBeenCalledWith(
        `${mockBaseUrl}/bot${mockBotToken}/sendMessage`,
        {
          chat_id: 'custom-chat',
          text: 'Test message',
          parse_mode: 'Markdown',
          disable_notification: true,
          protect_content: true,
          reply_to_message_id: 456,
          allow_sending_without_reply: true,
        },
        expect.any(Object)
      )
    })

    it('should handle API errors gracefully', async () => {
      const service = createService({ nodeEnv: 'development' }) // Set to development to test error throwing
      const errorResponse = {
        response: {
          data: {
            ok: false,
            description: 'Bad Request: message is empty',
          },
        },
      }

      httpService.post.mockReturnValue(throwError(() => errorResponse))

      // In development environment, it should throw
      await expect(service.sendMessage('Test message')).rejects.toThrow(
        'Telegram notification failed: Bad Request: message is empty'
      )
    })

    it('should not throw in production environment', async () => {
      const service = createService({ nodeEnv: 'production' })
      const errorResponse = {
        response: {
          data: {
            ok: false,
            description: 'Network error',
          },
        },
      }

      httpService.post.mockReturnValue(throwError(() => errorResponse))

      // Should not throw in production
      await expect(service.sendMessage('Test message')).resolves.not.toThrow()
    })

    it('should skip sending when configuration is invalid', async () => {
      const service = createService({ botToken: '' })

      await service.sendMessage('Test message')

      expect(httpService.post).not.toHaveBeenCalled()
    })
  })

  describe('sendFormattedMessage', () => {
    it('should send message with specified parse mode', async () => {
      const service = createService()
      httpService.post.mockReturnValue(
        of({
          data: { ok: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as never,
        })
      )

      await service.sendFormattedMessage('**Bold text**', 'Markdown')

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: '**Bold text**',
          parse_mode: 'Markdown',
        }),
        expect.any(Object)
      )
    })
  })

  describe('sendSilentMessage', () => {
    it('should send silent message', async () => {
      const service = createService()
      httpService.post.mockReturnValue(
        of({
          data: { ok: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as never,
        })
      )

      await service.sendSilentMessage('Silent message')

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: 'Silent message',
          disable_notification: true,
        }),
        expect.any(Object)
      )
    })
  })

  describe('getConfigurationStatus', () => {
    it('should return configuration status', () => {
      const service = createService()
      const status = service.getConfigurationStatus()

      expect(status).toEqual({
        isConfigured: true,
        hasToken: true,
        hasChatId: true,
        providerName: 'telegram',
      })
    })

    it('should return false status when token is missing', () => {
      const service = createService({ botToken: '' })
      const status = service.getConfigurationStatus()

      expect(status).toEqual({
        isConfigured: false,
        hasToken: false,
        hasChatId: true,
        providerName: 'telegram',
      })
    })
  })
})
