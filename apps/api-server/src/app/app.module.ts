import { LoggerModule } from 'nestjs-pino';
import { PrismaModule, PrismaServiceOptions } from 'nestjs-prisma';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import pretty from 'pino-pretty';

import { TokenModule } from '@bitfi-mock-pmm/token';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { QuoteModule } from '@bitfi-mock-pmm/quote';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [],
      envFilePath: ['.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            colorize: true,
          },
        },
      },
    }),
    PrismaModule.forRootAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory(configService: ConfigService): PrismaServiceOptions {
        return {
          prismaOptions: {
            log: [configService.getOrThrow('LOG_LEVEL')],
            datasourceUrl: configService.getOrThrow('DATABASE_URL'),
          },
        };
      },
      inject: [ConfigService],
    }),
    TokenModule,
    QuoteModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
