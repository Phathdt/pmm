import { redisStore } from 'cache-manager-redis-yet';
import { RedisClientOptions } from 'redis';

import { ReqModule } from '@bitfi-mock-pmm/req';
import { TokenModule } from '@bitfi-mock-pmm/token';
import { TradeModule } from '@bitfi-mock-pmm/trade';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TransferFactory } from './factories';
import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';
import { BTCTransferStrategy, EVMTransferStrategy } from './strategies';
import { SubmitSettlementProcessor } from './submit-settlement.processor';
import { TransferSettlementProcessor } from './transfer-settlement.processor';
import { SUBMIT_SETTLEMENT_QUEUE, TRANSFER_SETTLEMENT_QUEUE } from './types';

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
        enableLogging: true,
        shouldConvertCase: true,
      }),
      inject: [ConfigService],
      serviceKey: 'SOLVER_REQ_SERVICE',
    }),
    BullModule.registerQueue(
      { name: TRANSFER_SETTLEMENT_QUEUE },
      { name: SUBMIT_SETTLEMENT_QUEUE }
    ),
    BullBoardModule.forFeature(
      {
        name: TRANSFER_SETTLEMENT_QUEUE,
        adapter: BullAdapter,
      },
      {
        name: SUBMIT_SETTLEMENT_QUEUE,
        adapter: BullAdapter,
      }
    ),
    TradeModule,
    TokenModule,
  ],
  controllers: [SettlementController],
  providers: [
    SettlementService,
    TransferSettlementProcessor,
    SubmitSettlementProcessor,

    TransferFactory,
    EVMTransferStrategy,
    BTCTransferStrategy,
  ],
})
export class SettlementModule {}
