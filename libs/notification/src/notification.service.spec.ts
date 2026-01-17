import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { NotificationService } from './application'
import { ITelegramProvider } from './domain'

type Mocked<T> = {
  [P in keyof T]: T[P] extends (...args: infer A) => infer R ? Mock<(...args: A) => R> & T[P] : T[P]
}

describe('NotificationService', () => {
  let service: NotificationService
  let telegramService: Mocked<ITelegramProvider>

  // Create a mock logger that properly implements the with() method
  const createMockLogger = () => {
    const logger: any = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
      info: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
    }
    logger.with = vi.fn().mockReturnValue(logger)
    return logger
  }

  beforeEach(() => {
    telegramService = {
      validateConfiguration: vi.fn(),
      sendMessage: vi.fn(),
      providerName: 'telegram',
    } as Mocked<ITelegramProvider>

    const mockLogger = createMockLogger()

    // Directly instantiate the service with mocks
    service = new NotificationService(telegramService, mockLogger)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('sendTelegramMessage', () => {
    it('should send telegram message when service is configured', async () => {
      telegramService.validateConfiguration.mockReturnValue(true)
      telegramService.sendMessage.mockResolvedValue(undefined)

      await service.sendTelegramMessage('Test message')

      expect(telegramService.validateConfiguration).toHaveBeenCalled()
      expect(telegramService.sendMessage).toHaveBeenCalledWith('Test message', undefined)
    })

    it('should skip sending when telegram service is not configured', async () => {
      telegramService.validateConfiguration.mockReturnValue(false)

      await service.sendTelegramMessage('Test message')

      expect(telegramService.validateConfiguration).toHaveBeenCalled()
      expect(telegramService.sendMessage).not.toHaveBeenCalled()
    })

    it('should handle telegram service errors gracefully', async () => {
      telegramService.validateConfiguration.mockReturnValue(true)
      telegramService.sendMessage.mockRejectedValue(new Error('Telegram API error'))

      // Should not throw - errors are handled internally
      await expect(service.sendTelegramMessage('Test message')).resolves.not.toThrow()

      expect(telegramService.sendMessage).toHaveBeenCalledWith('Test message', undefined)
    })

    it('should pass options to telegram service', async () => {
      telegramService.validateConfiguration.mockReturnValue(true)
      telegramService.sendMessage.mockResolvedValue(undefined)

      const options = { chatId: 'custom-chat', parseMode: 'Markdown' as const }
      await service.sendTelegramMessage('Test message', options)

      expect(telegramService.sendMessage).toHaveBeenCalledWith('Test message', options)
    })
  })
})
