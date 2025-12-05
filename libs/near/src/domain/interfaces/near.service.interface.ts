import {
  NearQuoteRequestInput,
  NearQuoteResponse,
  NearStatusResponse,
  NearSubmitDepositRequest,
  NearSubmitDepositResponse,
} from '../schemas'

export interface INearService {
  /**
   * Request a quote for swap
   */
  requestQuote(request: NearQuoteRequestInput): Promise<NearQuoteResponse>

  /**
   * Get status of a swap by deposit address
   * @param depositAddress The deposit address to check
   * @param depositMemo Optional memo for MEMO deposit mode
   */
  getStatus(depositAddress: string, depositMemo?: string): Promise<NearStatusResponse>

  /**
   * Submit deposit transaction hash to accelerate processing
   * @param request Submit deposit request
   */
  submitDeposit(request: NearSubmitDepositRequest): Promise<NearSubmitDepositResponse>
}
