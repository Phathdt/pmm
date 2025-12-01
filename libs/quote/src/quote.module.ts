import KeyvRedis from '@keyv/redis'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { CustomConfigModule, CustomConfigService } from '@optimex-pmm/custom-config'
import { TokenModule } from '@optimex-pmm/token'
import { TradeModule } from '@optimex-pmm/trade'

import { QuoteService } from './application'
import { QUOTE_SERVICE, QUOTE_SESSION_REPOSITORY, QuoteSessionCacheRepository } from './infras'

export const providers = [
  {
    provide: QUOTE_SESSION_REPOSITORY,
    useClass: QuoteSessionCacheRepository,
  },
  {
    provide: QUOTE_SERVICE,
    useClass: QuoteService,
  },
]

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [CustomConfigModule],
      useFactory: async (configService: CustomConfigService) => {
        return {
          ttl: configService.quote.sessionTimeout,
          stores: [new KeyvRedis(configService.redis.url)],
        }
      },
      inject: [CustomConfigService],
    }),
    TokenModule,
    TradeModule,
  ],
  providers: [...providers],
  exports: [QUOTE_SERVICE],
})
export class QuoteModule {}
