import { redisStore } from 'cache-manager-redis-yet';
import { RedisClientOptions } from 'redis';

import { TokenModule } from '@bitfi-mock-pmm/token';
import { TradeModule } from '@bitfi-mock-pmm/trade';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TransferFactory } from './factories';
import { SettlementController } from './settlement.controller';
import { SettlementProcessor } from './settlement.processor';
import { SettlementService } from './settlement.service';
import { SettlementWatcher } from './settlement.watcher';
import { BTCTransferStrategy, EVMTransferStrategy } from './strategies';

@Module({
  imports: [
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
    BullModule.registerQueue({ name: 'router-select-pmm-events' }),
    TradeModule,
    TokenModule,
  ],
  controllers: [SettlementController],
  providers: [
    SettlementService,
    SettlementWatcher,
    SettlementProcessor,

    TransferFactory,
    EVMTransferStrategy,
    BTCTransferStrategy,
  ],
})
export class SettlementModule {}
