import { redisStore } from 'cache-manager-redis-yet';
import { RedisClientOptions } from 'redis';

import { ReqModule } from '@bitfi-mock-pmm/req';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TokenRepository } from './token.repository';

@Module({
  imports: [
    ReqModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        baseUrl: configService.getOrThrow<string>('DAPP_BACKEND_URL'),
        timeout: 30000,
      }),
      inject: [ConfigService],
      serviceKey: 'TOKEN_REQ_SERVICE',
    }),
    CacheModule.registerAsync<RedisClientOptions>({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          url: configService.getOrThrow<string>('REDIS_URL'),
          ttl: 0,
        }),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [],
  providers: [TokenRepository],
  exports: [TokenRepository],
})
export class TokenModule {}
