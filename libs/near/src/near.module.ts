import { Module } from '@nestjs/common'
import { CustomConfigModule, CustomConfigService } from '@optimex-pmm/custom-config'
import { ReqModule } from '@optimex-pmm/req'

import { NearService } from './application'
import { NEAR_REQ_SERVICE, NEAR_SERVICE } from './infras'

export const providers = [
  {
    provide: NEAR_SERVICE,
    useClass: NearService,
  },
]

@Module({
  imports: [
    CustomConfigModule,
    // NEAR API client with Bearer token authentication
    ReqModule.registerAsync({
      imports: [CustomConfigModule],
      useFactory: (configService: CustomConfigService) => {
        const near = configService.rebalance.near
        return {
          baseUrl: near.baseUrl,
          defaultHeaders: {
            Authorization: `Bearer ${near.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      },
      inject: [CustomConfigService],
      serviceKey: NEAR_REQ_SERVICE,
    }),
  ],
  providers: [...providers],
  exports: [NEAR_SERVICE],
})
export class NearModule {}
