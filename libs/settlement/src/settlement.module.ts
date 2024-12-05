import { redisStore } from 'cache-manager-redis-yet';
import { RedisClientOptions } from 'redis';

import { ReqModule } from '@bitfi-mock-pmm/req';
import { TokenModule } from '@bitfi-mock-pmm/token';
import { TradeModule } from '@bitfi-mock-pmm/trade';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TransferFactory } from './factories';
import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';
import { BTCTransferStrategy, EVMTransferStrategy } from './strategies';
import { SubmitSettlementProcessor } from './submit-settlement.processor';

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
    ReqModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        baseUrl: configService.getOrThrow<string>('SOLVER_URL'),
        timeout: 30000,
      }),
      inject: [ConfigService],
      serviceKey: 'SOLVER_REQ_SERVICE',
    }),
    BullModule.registerQueue({ name: 'router-select-pmm-events' }),
    TradeModule,
    TokenModule,
  ],
  controllers: [SettlementController],
  providers: [
    SettlementService,
    SubmitSettlementProcessor,

    TransferFactory,
    EVMTransferStrategy,
    BTCTransferStrategy,
  ],
})
export class SettlementModule {}
