import { BullAdapter } from '@bull-board/api/bullAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { BullBoardModule } from '@bull-board/nestjs'
import { BullModule } from '@nestjs/bull'
import { CacheModule } from '@nestjs/cache-manager'
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { BitcoinModule } from '@optimex-pmm/bitcoin'
import { CustomConfigModule, CustomConfigService } from '@optimex-pmm/custom-config'
import { CustomLoggerModule } from '@optimex-pmm/custom-logger'
import { DatabaseService } from '@optimex-pmm/database'
import { NotificationModule } from '@optimex-pmm/notification'
import { QueueModule } from '@optimex-pmm/queue'
import { QuoteModule } from '@optimex-pmm/quote'
import { REBALANCE_QUEUE, REBALANCE_QUEUE_NAMES, RebalanceModule } from '@optimex-pmm/rebalance'
import { SETTLEMENT_QUEUE, SETTLEMENT_QUEUE_NAMES, SettlementModule } from '@optimex-pmm/settlement'
import { TokenModule } from '@optimex-pmm/token'
import { TradeModule } from '@optimex-pmm/trade'

import { PrismaModule, PrismaServiceOptions } from 'nestjs-prisma'

import { AppController } from './app.controller'
import { AppService } from './app.service'

import { QuoteController, SettlementController } from '../controllers'
import { TradeExistsGuard } from '../guards'
import { ResponseInterceptor, TraceIdInterceptor } from '../interceptors'
import { IpWhitelistMiddleware } from '../middlewares'
import { BtcMonitorService, EvmMonitorService, SolanaMonitorService } from '../monitors'
import {
  BtcTransferSettlementProcessor,
  EvmTransferSettlementProcessor,
  RebalanceProcessor,
  RebalanceTransferProcessor,
  SolanaTransferSettlementProcessor,
  SubmitSettlementProcessor,
} from '../processors'
import {
  BalanceMonitorScheduler,
  RebalanceNearStatusScheduler,
  RebalancePendingScheduler,
  SettlementMonitorScheduler,
} from '../schedulers'

const controllers = [QuoteController, SettlementController]
const processors = [
  EvmTransferSettlementProcessor,
  BtcTransferSettlementProcessor,
  SolanaTransferSettlementProcessor,
  SubmitSettlementProcessor,
  RebalanceProcessor,
  RebalanceTransferProcessor,
]
const monitors = [BtcMonitorService, EvmMonitorService, SolanaMonitorService]

const schedulers = [
  BalanceMonitorScheduler,
  RebalanceNearStatusScheduler,
  RebalancePendingScheduler,
  SettlementMonitorScheduler,
]

const QUEUE_BOARDS = Object.values({
  ...SETTLEMENT_QUEUE,
  ...REBALANCE_QUEUE,
}).map((queue) => ({
  name: queue.NAME,
  adapter: BullAdapter,
}))

@Module({
  imports: [
    CustomConfigModule,
    CustomLoggerModule,
    CacheModule.register({ isGlobal: true }),
    PrismaModule.forRootAsync({
      isGlobal: true,
      imports: [CustomConfigModule],
      useFactory(configService: CustomConfigService): PrismaServiceOptions {
        return {
          prismaOptions: {
            log: DatabaseService.mapLogLevelToPrisma(configService.log.level),
            datasourceUrl: configService.database.url,
          },
        }
      },
      inject: [CustomConfigService],
    }),
    BullModule.forRootAsync({
      imports: [CustomConfigModule],
      useFactory: async (configService: CustomConfigService) => ({
        redis: configService.redis.url,
      }),
      inject: [CustomConfigService],
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    BullModule.registerQueue(...[...SETTLEMENT_QUEUE_NAMES, ...REBALANCE_QUEUE_NAMES].map((name) => ({ name }))),
    BullBoardModule.forFeature(...QUEUE_BOARDS),
    ScheduleModule.forRoot(),
    QueueModule,
    TokenModule,
    QuoteModule,
    TradeModule,
    SettlementModule,
    RebalanceModule,
    NotificationModule,
    BitcoinModule,
  ],
  controllers: [AppController, ...controllers],
  providers: [
    AppService,
    ...processors,
    ...schedulers,
    ...monitors,
    TradeExistsGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: TraceIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IpWhitelistMiddleware).forRoutes(QuoteController, SettlementController)
  }
}
