import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'

import { NotificationModule } from './notification.module'
import { NotificationService } from './notification.service'
import { TelegramService } from './telegram/telegram.service'

describe('NotificationModule', () => {
  let module: TestingModule

  const mockConfigService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'TELEGRAM_BASE_URL':
          return 'https://api.telegram.org'
        case 'TELEGRAM_TIMEOUT':
          return 10000
        case 'NODE_ENV':
          return 'test'
        default:
          return undefined
      }
    }),
    getOrThrow: jest.fn((key: string) => {
      switch (key) {
        case 'BOT_TOKEN':
          return 'test-bot-token'
        case 'CHAT_ID':
          return 'test-chat-id'
        default:
          throw new Error(`Missing ${key}`)
      }
    }),
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [NotificationModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile()
  })

  afterEach(async () => {
    if (module) {
      await module.close()
    }
  })

  it('should compile', () => {
    expect(module).toBeDefined()
  })

  it('should provide NotificationService', () => {
    const notificationService = module.get<NotificationService>(NotificationService)
    expect(notificationService).toBeDefined()
  })

  it('should provide TelegramService through TelegramModule', () => {
    const telegramService = module.get<TelegramService>(TelegramService)
    expect(telegramService).toBeDefined()
  })

  it('should be a global module', () => {
    // Test that the module is decorated with @Global()
    // This is important for dependency injection across the application
    const isGlobalMetadata = Reflect.getMetadata('__module:global__', NotificationModule)
    expect(isGlobalMetadata).toBe(true)
  })

  it('should export NotificationService', async () => {
    // Test that NotificationService is properly exported and can be imported by other modules
    const testModule = await Test.createTestingModule({
      imports: [NotificationModule],
      providers: [
        {
          provide: 'TEST_SERVICE',
          useFactory: (notificationService: NotificationService) => {
            return {
              notificationService,
            }
          },
          inject: [NotificationService],
        },
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile()

    const testService = testModule.get('TEST_SERVICE')
    expect(testService.notificationService).toBeDefined()
    expect(testService.notificationService).toBeInstanceOf(NotificationService)

    await testModule.close()
  })

  it('should export TelegramModule', async () => {
    // Test that TelegramModule is properly exported
    const testModule = await Test.createTestingModule({
      imports: [NotificationModule],
      providers: [
        {
          provide: 'TEST_TELEGRAM_SERVICE',
          useFactory: (telegramService: TelegramService) => {
            return {
              telegramService,
            }
          },
          inject: [TelegramService],
        },
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile()

    const testService = testModule.get('TEST_TELEGRAM_SERVICE')
    expect(testService.telegramService).toBeDefined()
    expect(testService.telegramService).toBeInstanceOf(TelegramService)

    await testModule.close()
  })
})
