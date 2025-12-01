import { Injectable, Logger, NestMiddleware } from '@nestjs/common'
import { CustomConfigService } from '@optimex-pmm/custom-config'

import { NextFunction, Request, Response } from 'express'

@Injectable()
export class IpWhitelistMiddleware implements NestMiddleware {
  private readonly whitelistedIps: string[] = []
  private readonly enabled: boolean
  private readonly logger = new Logger(IpWhitelistMiddleware.name)

  constructor(configService: CustomConfigService) {
    const whitelistArray = configService.ipWhitelist.list
    this.whitelistedIps = whitelistArray.map((ip: string) => ip.trim()).filter((ip: string) => ip.length > 0)

    this.enabled = configService.ipWhitelist.enabled
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (!this.enabled) {
      return next()
    }

    const clientIp = this.getClientIp(req)

    if (this.whitelistedIps.includes(clientIp)) {
      return next()
    }

    this.logger.warn({
      message: 'Access denied for IP address not in whitelist',
      clientIp,
      whitelistedIps: this.whitelistedIps,
      enabled: this.enabled,
      userAgent: req.headers['user-agent'],
      operation: 'ip_whitelist_check',
      status: 'denied',
      timestamp: new Date().toISOString(),
    })
    return res.status(403).json({
      statusCode: 403,
      message: 'Forbidden: IP address not whitelisted',
      error: 'Forbidden',
    })
  }

  private getClientIp(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'] as string
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim()
    }
    return req.socket.remoteAddress || '0.0.0.0'
  }
}
