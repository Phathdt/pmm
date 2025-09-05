import { Module } from '@nestjs/common'

import { LoggerModule } from 'nestjs-pino'
/* eslint-disable @typescript-eslint/no-unused-vars, unused-imports/no-unused-imports */
// @ts-expect-error - keeping import for future use
import pretty from 'pino-pretty'

/* eslint-enable @typescript-eslint/no-unused-vars, unused-imports/no-unused-imports */

interface ExtendedRequest {
  traceId?: string
  userId?: string
  sessionId?: string
  headers: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string }
  connection?: { remoteAddress?: string }
}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env['ENABLE_JSON_LOG'] !== 'false'
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                },
              },
        level: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(process.env['LOG_LEVEL'] || '')
          ? process.env['LOG_LEVEL'] || ''
          : 'info',
        timestamp: () => `,"time":"${new Date().toISOString()}"`,
        formatters: {
          level: (label) => {
            return { level: label }
          },
        },
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            query: req.query,
            params: req.params,
            headers: {
              host: req.headers.host,
            },
            remoteAddress: req.remoteAddress,
            remotePort: req.remotePort,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
            headers: res.getHeaders ? res.getHeaders() : {},
          }),
        },
        customProps: (req: ExtendedRequest) => {
          return {
            traceId: req.traceId,
            userId: req.userId,
            sessionId: req.sessionId,
            userAgent: req.headers['user-agent'],
            ip: req.socket?.remoteAddress || req.connection?.remoteAddress,
            timestamp: new Date().toISOString(),
          }
        },
      },
    }),
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class CustomLoggerModule {}
