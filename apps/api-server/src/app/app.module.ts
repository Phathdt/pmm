import { BullAdapter } from '@bull-board/api/bullAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { BullBoardModule } from '@bull-board/nestjs'
import { BullModule } from '@nestjs/bull'
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { CustomLoggerModule } from '@optimex-pmm/custom-logger'
import { DatabaseService } from '@optimex-pmm/database'
import { QueueModule } from '@optimex-pmm/queue'
import { QuoteModule } from '@optimex-pmm/quote'
import { SETTLEMENT_QUEUE, SETTLEMENT_QUEUE_NAMES, SettlementModule } from '@optimex-pmm/settlement'
import { TokenModule } from '@optimex-pmm/token'
import { TradeModule } from '@optimex-pmm/trade'

import { PrismaModule, PrismaServiceOptions } from 'nestjs-prisma'

import { AppController } from './app.controller'

import { QuoteController, SettlementController } from '../controllers'
import { IpWhitelistMiddleware } from '../middlewares'
import { BtcMonitorService, EvmMonitorService, SolanaMonitorService } from '../monitors'
import {
  BtcTransferSettlementProcessor,
  EvmTransferSettlementProcessor,
  SolanaTransferSettlementProcessor,
  SubmitSettlementProcessor,
} from '../processors'
import { BalanceMonitorScheduler } from '../schedulers'

const controllers = [QuoteController, SettlementController]
const processors = [
  EvmTransferSettlementProcessor,
  BtcTransferSettlementProcessor,
  SolanaTransferSettlementProcessor,
  SubmitSettlementProcessor,
]
const monitors = [BtcMonitorService, EvmMonitorService, SolanaMonitorService]

const schedulers = [BalanceMonitorScheduler]

const QUEUE_BOARDS = Object.values(SETTLEMENT_QUEUE).map((queue) => ({
  name: queue.NAME,
  adapter: BullAdapter,
}))

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [],
      envFilePath: ['.env'],
    }),
    CustomLoggerModule, // Add this early in the imports array
    PrismaModule.forRootAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory(configService: ConfigService): PrismaServiceOptions {
        const logLevel = configService.getOrThrow('LOG_LEVEL')
        return {
          prismaOptions: {
            log: DatabaseService.mapLogLevelToPrisma(logLevel),
            datasourceUrl: configService.getOrThrow('DATABASE_URL'),
          },
        }
      },
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: configService.getOrThrow('REDIS_URL'),
      }),
      inject: [ConfigService],
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    BullModule.registerQueue(...SETTLEMENT_QUEUE_NAMES.map((name) => ({ name }))),
    BullBoardModule.forFeature(...QUEUE_BOARDS),
    ScheduleModule.forRoot(),
    QueueModule,
    TokenModule,
    QuoteModule,
    TradeModule,
    SettlementModule,
  ],
  controllers: [AppController, ...controllers],
  providers: [...processors, ...schedulers, ...monitors],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IpWhitelistMiddleware).forRoutes(QuoteController, SettlementController)
  }
}
