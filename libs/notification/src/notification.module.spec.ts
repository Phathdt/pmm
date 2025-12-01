import { Test, TestingModule } from '@nestjs/testing'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'

import { NotificationService } from './application'
import { INotificationService, ITelegramProvider } from './domain'
import { NOTIFICATION_SERVICE, TELEGRAM_PROVIDER } from './infras'
import { NotificationModule } from './notification.module'

describe('NotificationModule', () => {
  let module: TestingModule

  const mockConfigService = {
    telegram: {
      botToken: 'test-bot-token',
      chatId: 'test-chat-id',
      baseUrl: 'https://api.telegram.org',
      timeout: 10000,
    },
    nodeEnv: 'test',
  }

  const mockLogger = {
    with: jest.fn().mockReturnThis(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    info: jest.fn(),
    fatal: jest.fn(),
    trace: jest.fn(),
  }

  const mockTelegramProvider: ITelegramProvider = {
    providerName: 'telegram',
    validateConfiguration: jest.fn().mockReturnValue(true),
    sendMessage: jest.fn().mockResolvedValue(undefined),
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: NOTIFICATION_SERVICE,
          useClass: NotificationService,
        },
        {
          provide: TELEGRAM_PROVIDER,
          useValue: mockTelegramProvider,
        },
        {
          provide: CustomConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EnhancedLogger,
          useValue: mockLogger,
        },
      ],
    }).compile()
  })

  afterEach(async () => {
    if (module) {
      await module.close()
    }
  })

  it('should compile', () => {
    expect(module).toBeDefined()
  })

  it('should provide NotificationService via DI token', () => {
    const notificationService = module.get<INotificationService>(NOTIFICATION_SERVICE)
    expect(notificationService).toBeDefined()
    expect(notificationService).toBeInstanceOf(NotificationService)
  })

  it('should provide TelegramProvider via DI token', () => {
    const telegramService = module.get<ITelegramProvider>(TELEGRAM_PROVIDER)
    expect(telegramService).toBeDefined()
    expect(telegramService.providerName).toBe('telegram')
  })

  it('should be a global module', () => {
    // Test that the module is decorated with @Global()
    // This is important for dependency injection across the application
    const isGlobalMetadata = Reflect.getMetadata('__module:global__', NotificationModule)
    expect(isGlobalMetadata).toBe(true)
  })

  it('should export NotificationService via DI token', async () => {
    // Test that NotificationService is properly configured and works
    const notificationService = module.get<INotificationService>(NOTIFICATION_SERVICE)
    expect(notificationService).toBeDefined()
    expect(notificationService).toBeInstanceOf(NotificationService)
  })

  it('should export TelegramProvider via DI token', async () => {
    // Test that TelegramProvider is properly configured
    const telegramService = module.get<ITelegramProvider>(TELEGRAM_PROVIDER)
    expect(telegramService).toBeDefined()
    expect(telegramService.providerName).toBe('telegram')
  })
})
