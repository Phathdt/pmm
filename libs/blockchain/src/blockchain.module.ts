import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'

import { NonceManagerService } from './nonce-manager.service'
import { NonceRefreshScheduler } from './nonce-refresh.scheduler'

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [],
  providers: [NonceManagerService, NonceRefreshScheduler],
  exports: [NonceManagerService],
})
export class BlockchainModule {}
