import KeyvRedis from '@keyv/redis'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { CustomConfigModule, CustomConfigService } from '@optimex-pmm/custom-config'
import { CustomLoggerModule } from '@optimex-pmm/custom-logger'
import { ReqModule } from '@optimex-pmm/req'

import { TokenService } from './application'
import {
  BinancePriceProvider,
  CoinGeckoPriceProvider,
  TOKEN_REPOSITORY,
  TOKEN_SERVICE,
  TokenRemoteRepository,
} from './infras'

export const providers = [
  BinancePriceProvider,
  CoinGeckoPriceProvider,
  {
    provide: TOKEN_REPOSITORY,
    useClass: TokenRemoteRepository,
  },
  {
    provide: TOKEN_SERVICE,
    useClass: TokenService,
  },
]

@Module({
  imports: [
    CustomLoggerModule,
    // CoinGecko API Configuration
    ReqModule.registerAsync({
      imports: [CustomConfigModule],
      useFactory: () => ({
        baseUrl: 'https://api.coingecko.com/api/v3',
        shouldConvertCase: true,
        timeout: 2500, // 2.5s timeout per provider (leave 500ms margin for global 3s timeout)
      }),
      inject: [CustomConfigService],
      serviceKey: 'COINGECKO_REQ_SERVICE',
    }),
    // Binance API Configuration
    ReqModule.registerAsync({
      imports: [CustomConfigModule],
      useFactory: () => ({
        baseUrl: 'https://api.binance.com/api/v3',
        shouldConvertCase: false, // Binance uses uppercase, no snake_case conversion needed
        timeout: 2500, // 2.5s timeout per provider (leave 500ms margin for global 3s timeout)
      }),
      inject: [CustomConfigService],
      serviceKey: 'BINANCE_REQ_SERVICE',
    }),
    CacheModule.registerAsync({
      imports: [CustomConfigModule],
      useFactory: async (configService: CustomConfigService) => {
        return {
          stores: [new KeyvRedis(configService.redis.url)],
        }
      },
      inject: [CustomConfigService],
    }),
  ],
  providers: [...providers],
  exports: [TOKEN_SERVICE],
})
export class TokenModule {}
