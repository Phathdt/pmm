import KeyvRedis from '@keyv/redis'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
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
    // CoinGecko API Configuration
    ReqModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        baseUrl: 'https://api.coingecko.com/api/v3',
        shouldConvertCase: true,
        timeout: 2500, // 2.5s timeout per provider (leave 500ms margin for global 3s timeout)
      }),
      inject: [ConfigService],
      serviceKey: 'COINGECKO_REQ_SERVICE',
    }),
    // Binance API Configuration
    ReqModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        baseUrl: 'https://api.binance.com/api/v3',
        shouldConvertCase: false, // Binance uses uppercase, no snake_case conversion needed
        timeout: 2500, // 2.5s timeout per provider (leave 500ms margin for global 3s timeout)
      }),
      inject: [ConfigService],
      serviceKey: 'BINANCE_REQ_SERVICE',
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        return {
          stores: [new KeyvRedis(configService.getOrThrow<string>('REDIS_URL'))],
        }
      },
      inject: [ConfigService],
    }),
  ],
  providers: [...providers],
  exports: [TOKEN_SERVICE],
})
export class TokenModule {}
