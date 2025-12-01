import { Global, Module } from '@nestjs/common'
import { CustomConfigModule, CustomConfigService } from '@optimex-pmm/custom-config'
import { CustomLoggerModule } from '@optimex-pmm/custom-logger'
import { ReqModule } from '@optimex-pmm/req'

import { NotificationService, TelegramService } from './application'
import { NOTIFICATION_SERVICE, TELEGRAM_PROVIDER, TELEGRAM_REQ_SERVICE } from './infras'

@Global()
@Module({
  imports: [
    CustomConfigModule,
    CustomLoggerModule,
    ReqModule.registerAsync({
      imports: [CustomConfigModule],
      useFactory: (configService: CustomConfigService) => ({
        baseUrl: configService.telegram.baseUrl,
        timeout: configService.telegram.timeout,
      }),
      inject: [CustomConfigService],
      serviceKey: TELEGRAM_REQ_SERVICE,
    }),
  ],
  providers: [
    {
      provide: TELEGRAM_PROVIDER,
      useClass: TelegramService,
    },
    {
      provide: NOTIFICATION_SERVICE,
      useClass: NotificationService,
    },
  ],
  exports: [NOTIFICATION_SERVICE, TELEGRAM_PROVIDER],
})
export class NotificationModule {}
