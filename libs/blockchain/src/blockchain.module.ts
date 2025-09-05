import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { NonceManagerService } from './nonce-manager.service'
import { NonceRefreshScheduler } from './nonce-refresh.scheduler'
import { TransactionService } from './transaction.service'

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [NonceManagerService, NonceRefreshScheduler, TransactionService],
  exports: [NonceManagerService, TransactionService],
})
export class BlockchainModule {}
