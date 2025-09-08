import { Test, TestingModule } from '@nestjs/testing'

import { NotificationService } from './notification.service'
import { TelegramService } from './telegram'

describe('NotificationService', () => {
  let service: NotificationService
  let telegramService: jest.Mocked<TelegramService>

  beforeEach(async () => {
    const mockTelegramService = {
      validateConfiguration: jest.fn(),
      sendMessage: jest.fn(),
      getConfigurationStatus: jest.fn(),
      providerName: 'telegram',
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: TelegramService,
          useValue: mockTelegramService,
        },
      ],
    }).compile()

    service = module.get<NotificationService>(NotificationService)
    telegramService = module.get(TelegramService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('sendTelegramMessage', () => {
    it('should send telegram message when service is configured', async () => {
      telegramService.validateConfiguration.mockReturnValue(true)
      telegramService.sendMessage.mockResolvedValue()

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
      telegramService.sendMessage.mockResolvedValue()

      const options = { chatId: 'custom-chat', parseMode: 'Markdown' as const }
      await service.sendTelegramMessage('Test message', options)

      expect(telegramService.sendMessage).toHaveBeenCalledWith('Test message', options)
    })
  })
})
