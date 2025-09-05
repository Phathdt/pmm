import { HttpModule } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'

import { TelegramModule } from './telegram.module'
import { TelegramService } from './telegram.service'

describe('TelegramModule', () => {
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
      imports: [HttpModule, TelegramModule],
      providers: [
        TelegramService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile()
  })

  it('should compile', () => {
    expect(module).toBeDefined()
  })

  it('should provide TelegramService', () => {
    const telegramService = module.get<TelegramService>(TelegramService)
    expect(telegramService).toBeDefined()
  })

  it('should import HttpModule', () => {
    // Test that HttpModule is properly imported and configured
    const httpModule = module.get(HttpModule)
    expect(httpModule).toBeDefined()
  })

  it('should export TelegramService', async () => {
    // Test that TelegramService is properly exported
    const exportedModule = await Test.createTestingModule({
      imports: [HttpModule, TelegramModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile()

    const telegramService = exportedModule.get<TelegramService>(TelegramService)
    expect(telegramService).toBeDefined()
  })
})
