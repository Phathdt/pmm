import { RedisModule } from '@nestjs-modules/ioredis'
import { Module } from '@nestjs/common'
import { CustomConfigModule, CustomConfigService } from '@optimex-pmm/custom-config'
import { CustomLoggerModule } from '@optimex-pmm/custom-logger'

import { QueueService } from './application'
import { QUEUE_SERVICE_TOKEN } from './infras'

@Module({
  imports: [
    RedisModule.forRootAsync({
      imports: [CustomConfigModule],
      useFactory: (configService: CustomConfigService) => ({
        type: 'single',
        url: configService.redis.url,
      }),
      inject: [CustomConfigService],
    }),
    CustomLoggerModule,
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
