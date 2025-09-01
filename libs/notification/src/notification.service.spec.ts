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
      sendFormattedMessage: jest.fn(),
      sendSilentMessage: jest.fn(),
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

  describe('sendFormattedTelegramMessage', () => {
    it('should send formatted telegram message with default HTML parse mode', async () => {
      telegramService.validateConfiguration.mockReturnValue(true)
      telegramService.sendMessage.mockResolvedValue()

      await service.sendFormattedTelegramMessage('<b>Bold text</b>')

      expect(telegramService.sendMessage).toHaveBeenCalledWith('<b>Bold text</b>', {
        parseMode: 'HTML',
      })
    })

    it('should send formatted telegram message with custom parse mode', async () => {
      telegramService.validateConfiguration.mockReturnValue(true)
      telegramService.sendMessage.mockResolvedValue()

      await service.sendFormattedTelegramMessage('**Bold text**', 'Markdown')

      expect(telegramService.sendMessage).toHaveBeenCalledWith('**Bold text**', {
        parseMode: 'Markdown',
      })
    })

    it('should pass additional options correctly', async () => {
      telegramService.validateConfiguration.mockReturnValue(true)
      telegramService.sendMessage.mockResolvedValue()

      const options = { chatId: 'custom-chat', silent: true }
      await service.sendFormattedTelegramMessage('<b>Bold text</b>', 'HTML', options)

      expect(telegramService.sendMessage).toHaveBeenCalledWith('<b>Bold text</b>', {
        ...options,
        parseMode: 'HTML',
      })
    })
  })

  describe('sendSilentTelegramMessage', () => {
    it('should send silent telegram message', async () => {
      telegramService.validateConfiguration.mockReturnValue(true)
      telegramService.sendMessage.mockResolvedValue()

      await service.sendSilentTelegramMessage('Silent message')

      expect(telegramService.sendMessage).toHaveBeenCalledWith('Silent message', {
        silent: true,
      })
    })

    it('should merge silent option with other options', async () => {
      telegramService.validateConfiguration.mockReturnValue(true)
      telegramService.sendMessage.mockResolvedValue()

      const options = { chatId: 'custom-chat', parseMode: 'Markdown' as const }
      await service.sendSilentTelegramMessage('Silent message', options)

      expect(telegramService.sendMessage).toHaveBeenCalledWith('Silent message', {
        ...options,
        silent: true,
      })
    })
  })

  describe('getProvidersStatus', () => {
    it('should return providers status', () => {
      const mockStatus = {
        isConfigured: true,
        hasToken: true,
        hasChatId: true,
        providerName: 'telegram',
      }
      telegramService.getConfigurationStatus.mockReturnValue(mockStatus)

      const result = service.getProvidersStatus()

      expect(result).toEqual({
        telegram: mockStatus,
      })
      expect(telegramService.getConfigurationStatus).toHaveBeenCalled()
    })
  })

  describe('hasAnyProviderConfigured', () => {
    it('should return true when telegram is configured', () => {
      telegramService.validateConfiguration.mockReturnValue(true)

      const result = service.hasAnyProviderConfigured()

      expect(result).toBe(true)
      expect(telegramService.validateConfiguration).toHaveBeenCalled()
    })

    it('should return false when no providers are configured', () => {
      telegramService.validateConfiguration.mockReturnValue(false)

      const result = service.hasAnyProviderConfigured()

      expect(result).toBe(false)
      expect(telegramService.validateConfiguration).toHaveBeenCalled()
    })
  })
})
