import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'

import { NonceManagerService } from './nonce-manager.service'
import { NonceRefreshScheduler } from './nonce-refresh.scheduler'
import { TransactionService } from './transaction.service'

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [],
  providers: [NonceManagerService, NonceRefreshScheduler, TransactionService],
  exports: [NonceManagerService, TransactionService],
})
export class BlockchainModule {}
