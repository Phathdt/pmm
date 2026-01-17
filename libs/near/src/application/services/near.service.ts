import { Inject, Injectable } from '@nestjs/common'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { ReqService } from '@optimex-pmm/req'

import { v7 as uuidv7 } from 'uuid'

import {
  INearService,
  NearQuoteRequestInput,
  NearQuoteResponse,
  NearStatusResponse,
  NearSubmitDepositRequest,
  NearSubmitDepositResponse,
} from '../../domain'
import { NEAR_REQ_SERVICE } from '../../infras'

@Injectable()
export class NearService implements INearService {
  private readonly logger: EnhancedLogger

  constructor(
    @Inject(NEAR_REQ_SERVICE) private readonly reqService: ReqService,
    logger: EnhancedLogger
  ) {
    this.logger = logger.with({ context: NearService.name })
  }

  async requestQuote(request: NearQuoteRequestInput): Promise<NearQuoteResponse> {
    const requestWithSessionId = {
      ...request,
      sessionId: request.sessionId ?? uuidv7(),
    }

    this.logger.debug({
      message: 'NEAR quote request',
      endpoint: '/v0/quote',
      payload: JSON.stringify(requestWithSessionId, null, 2),
    })

    // NEAR API expects camelCase, skip snake_case conversion
    return this.reqService.post<NearQuoteResponse>({
      endpoint: '/v0/quote',
      payload: requestWithSessionId,
      skipCaseConversion: true,
    })
  }

  async getStatus(depositAddress: string, depositMemo?: string): Promise<NearStatusResponse> {
    const params: Record<string, string> = { depositAddress }
    if (depositMemo) {
      params.depositMemo = depositMemo
    }

    // NEAR API expects camelCase, skip snake_case conversion
    return this.reqService.get<NearStatusResponse>({
      endpoint: '/v0/status',
      params,
      skipCaseConversion: true,
    })
  }

  async submitDeposit(request: NearSubmitDepositRequest): Promise<NearSubmitDepositResponse> {
    // NEAR API expects camelCase, skip snake_case conversion
    return this.reqService.post<NearSubmitDepositResponse>({
      endpoint: '/v0/deposit/submit',
      payload: request,
      skipCaseConversion: true,
    })
  }
}
