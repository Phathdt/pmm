import { Module } from '@nestjs/common'
import { BitcoinModule } from '@optimex-pmm/bitcoin'
import { CustomConfigModule } from '@optimex-pmm/custom-config'
import { DatabaseModule } from '@optimex-pmm/database'
import { NearModule } from '@optimex-pmm/near'
import { TokenModule } from '@optimex-pmm/token'

import { RebalancingService, SlippageService } from './application'
import { REBALANCING_REPOSITORY, REBALANCING_SERVICE, RebalancingPrismaRepository, SLIPPAGE_SERVICE } from './infras'

const providers = [
  {
    provide: REBALANCING_REPOSITORY,
    useClass: RebalancingPrismaRepository,
  },
  {
    provide: REBALANCING_SERVICE,
    useClass: RebalancingService,
  },
  {
    provide: SLIPPAGE_SERVICE,
    useClass: SlippageService,
  },
]

@Module({
  imports: [CustomConfigModule, DatabaseModule, TokenModule, BitcoinModule, NearModule],
  providers: [...providers],
  exports: [REBALANCING_SERVICE, SLIPPAGE_SERVICE, BitcoinModule, NearModule],
})
export class RebalanceModule {}
