import { Module } from '@nestjs/common'
import { CustomConfigModule } from '@optimex-pmm/custom-config'
import { CustomLoggerModule } from '@optimex-pmm/custom-logger'

import { NonceManagerService, TransactionService } from './application'
import { NONCE_MANAGER_SERVICE, NonceRefreshScheduler, TRANSACTION_SERVICE } from './infras'

export const providers = [
  {
    provide: NONCE_MANAGER_SERVICE,
    useClass: NonceManagerService,
  },
  {
    provide: TRANSACTION_SERVICE,
    useClass: TransactionService,
  },
  NonceRefreshScheduler,
]

@Module({
  imports: [CustomConfigModule, CustomLoggerModule],
  controllers: [],
  providers: [...providers],
  exports: [NONCE_MANAGER_SERVICE, TRANSACTION_SERVICE],
})
export class BlockchainModule {}
