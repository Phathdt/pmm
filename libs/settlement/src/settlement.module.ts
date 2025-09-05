import KeyvRedis from '@keyv/redis'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BlockchainModule } from '@optimex-pmm/blockchain'
import { NotificationModule } from '@optimex-pmm/notification'
import { QueueModule } from '@optimex-pmm/queue'
import { TokenModule } from '@optimex-pmm/token'
import { TradeModule } from '@optimex-pmm/trade'

import { TransferFactory } from './factories'
import { SettlementService } from './settlement.service'
import {
  BTCTransferStrategy,
  EVMLiquidationTransferStrategy,
  EVMTransferStrategy,
  SolanaTransferStrategy,
} from './strategies'

@Module({
  imports: [
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
    QueueModule,
    BlockchainModule,
    TradeModule,
    TokenModule,
    NotificationModule,
  ],
  providers: [
    SettlementService,

    TransferFactory,
    BTCTransferStrategy,
    EVMTransferStrategy,
    SolanaTransferStrategy,
    EVMLiquidationTransferStrategy,
  ],
  exports: [TransferFactory, SettlementService],
})
export class SettlementModule {}
