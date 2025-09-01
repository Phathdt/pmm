import { BullAdapter } from '@bull-board/api/bullAdapter'
import { BullBoardModule } from '@bull-board/nestjs'
import KeyvRedis from '@keyv/redis'
import { BullModule } from '@nestjs/bull'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { BlockchainModule } from '@optimex-pmm/blockchain'
import { TokenModule } from '@optimex-pmm/token'
import { TradeModule } from '@optimex-pmm/trade'

import { SETTLEMENT_QUEUE, SETTLEMENT_QUEUE_NAMES } from './const'
import { TransferFactory } from './factories'
import { SettlementService } from './settlement.service'
import {
  BTCTransferStrategy,
  EVMLiquidationTransferStrategy,
  EVMTransferStrategy,
  SolanaTransferStrategy,
} from './strategies'
import { TelegramHelper } from './utils/telegram.helper'

const QUEUE_BOARDS = Object.values(SETTLEMENT_QUEUE).map((queue) => ({
  name: queue.NAME,
  adapter: BullAdapter,
}))

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        return {
          ttl: 0,
          stores: [new KeyvRedis(configService.getOrThrow<string>('REDIS_URL'))],
        }
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(...SETTLEMENT_QUEUE_NAMES.map((name) => ({ name }))),
    BullBoardModule.forFeature(...QUEUE_BOARDS),
    BlockchainModule,
    TradeModule,
    TokenModule,
  ],
  providers: [
    SettlementService,
    TelegramHelper,

    TransferFactory,
    BTCTransferStrategy,
    EVMTransferStrategy,
    SolanaTransferStrategy,
    EVMLiquidationTransferStrategy,
  ],
  exports: [TransferFactory, SettlementService, TelegramHelper],
})
export class SettlementModule {}
