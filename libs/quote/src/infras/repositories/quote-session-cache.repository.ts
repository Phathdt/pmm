import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { CustomConfigService } from '@optimex-pmm/custom-config'

import type { Cache } from 'cache-manager'

import { IQuoteSessionRepository, QuoteSession, QuoteSessionCreateData } from '../../domain'

@Injectable()
export class QuoteSessionCacheRepository implements IQuoteSessionRepository {
  private readonly sessionTimeout: number
  private readonly SESSION_PREFIX = 'quote_session:'

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    configService: CustomConfigService
  ) {
    this.sessionTimeout = configService.quote.sessionTimeout
  }

  private getSessionKey(sessionId: string): string {
    return `${this.SESSION_PREFIX}${sessionId}`
  }

  async save(sessionId: string, data: QuoteSessionCreateData): Promise<void> {
    const sessionData: QuoteSession = {
      ...data,
      timestamp: Date.now(),
    }

    await this.cacheManager.set(this.getSessionKey(sessionId), sessionData, this.sessionTimeout)
  }

  async findById(sessionId: string): Promise<QuoteSession | null> {
    const session = await this.cacheManager.get<QuoteSession>(this.getSessionKey(sessionId))

    if (!session) {
      return null
    }

    if (Date.now() - session.timestamp > this.sessionTimeout) {
      await this.delete(sessionId)
      return null
    }

    return session
  }

  async delete(sessionId: string): Promise<void> {
    await this.cacheManager.del(this.getSessionKey(sessionId))
  }
}
