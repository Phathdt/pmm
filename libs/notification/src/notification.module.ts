import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { NotificationService } from './notification.service'
import { TelegramModule } from './telegram'

@Global()
@Module({
  imports: [ConfigModule, TelegramModule],
  providers: [NotificationService],
  exports: [NotificationService, TelegramModule],
})
export class NotificationModule {}
