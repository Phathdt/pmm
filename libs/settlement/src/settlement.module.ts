import { redisStore } from 'cache-manager-redis-yet';
import { RedisClientOptions } from 'redis';

import { TokenModule } from '@bitfi-mock-pmm/token';
import { TradeModule } from '@bitfi-mock-pmm/trade';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';
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
  ],
})
export class SettlementModule {}
