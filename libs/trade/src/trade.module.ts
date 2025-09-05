import { Module } from '@nestjs/common'
import { DatabaseModule } from '@optimex-pmm/database'

import { TradeService } from './application'
import { TRADE_REPOSITORY, TRADE_SERVICE, TradePrismaRepository } from './infras'

export const providers = [
  {
    provide: TRADE_REPOSITORY,
    useClass: TradePrismaRepository,
  },
  {
    provide: TRADE_SERVICE,
    useClass: TradeService,
  },
]

@Module({
  imports: [DatabaseModule],
  providers: [...providers],
  exports: [TRADE_SERVICE],
})
export class TradeModule {}
