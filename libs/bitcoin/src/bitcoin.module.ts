import { Module } from '@nestjs/common'
import { CustomConfigModule } from '@optimex-pmm/custom-config'
import { CustomLoggerModule } from '@optimex-pmm/custom-logger'

import { BitcoinService } from './application'
import { BITCOIN_SERVICE, BlockstreamProvider, MempoolProvider } from './infras'

const providers = [
  BlockstreamProvider,
  MempoolProvider,
  {
    provide: BITCOIN_SERVICE,
    useClass: BitcoinService,
  },
]

@Module({
  imports: [CustomConfigModule, CustomLoggerModule],
  providers: [...providers],
  exports: [BITCOIN_SERVICE],
})
export class BitcoinModule {}
