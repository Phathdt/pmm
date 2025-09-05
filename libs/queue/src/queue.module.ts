import { RedisModule } from '@nestjs-modules/ioredis'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { QueueService } from './application'
import { QUEUE_SERVICE_TOKEN } from './infras'

@Module({
  imports: [
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: configService.get<string>('REDIS_URL'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: QUEUE_SERVICE_TOKEN,
      useClass: QueueService,
    },
    QueueService,
  ],
  exports: [QueueService, QUEUE_SERVICE_TOKEN],
})
export class QueueModule {}
