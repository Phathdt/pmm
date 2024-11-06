import { LoggerModule } from 'nestjs-pino';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import pretty from 'pino-pretty';

import { ReqModule } from '@bitfi-mock-pmm/req';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
    ReqModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        timeout: 30000,
      }),
      inject: [ConfigService],
      serviceKey: 'APP_REQ_SERVICE',
    }),
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
