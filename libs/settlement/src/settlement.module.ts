import KeyvRedis from '@keyv/redis'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { BitcoinModule } from '@optimex-pmm/bitcoin'
import { BlockchainModule } from '@optimex-pmm/blockchain'
import { CustomConfigModule, CustomConfigService } from '@optimex-pmm/custom-config'
import { CustomLoggerModule } from '@optimex-pmm/custom-logger'
import { NotificationModule } from '@optimex-pmm/notification'
import { QueueModule } from '@optimex-pmm/queue'
import { TokenModule } from '@optimex-pmm/token'
import { TradeModule } from '@optimex-pmm/trade'

import { SettlementService } from './application'
import {
  BTCTransferStrategy,
  EVMLiquidationTransferStrategy,
  EVMTransferStrategy,
  SETTLEMENT_SERVICE,
  SolanaTransferStrategy,
  TRANSFER_FACTORY,
  TransferFactory,
} from './infras'

export const providers = [
  // Strategies (concrete implementations)
  EVMTransferStrategy,
  BTCTransferStrategy,
  SolanaTransferStrategy,
  EVMLiquidationTransferStrategy,

  // Factory
  {
    provide: TRANSFER_FACTORY,
    useClass: TransferFactory,
  },

  // Service
  {
    provide: SETTLEMENT_SERVICE,
    useClass: SettlementService,
  },
]

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [CustomConfigModule],
      useFactory: async (configService: CustomConfigService) => {
        return {
          ttl: 0,
          stores: [new KeyvRedis(configService.redis.url)],
        }
      },
      inject: [CustomConfigService],
    }),
    CustomLoggerModule,
    QueueModule,
    BlockchainModule,
    BitcoinModule,
    TradeModule,
    TokenModule,
    NotificationModule,
  ],
  providers: [...providers],
  exports: [TRANSFER_FACTORY, SETTLEMENT_SERVICE],
})
export class SettlementModule {}
