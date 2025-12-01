import {
  CommitmentQuoteResponse,
  GetCommitmentQuoteDto,
  GetIndicativeQuoteDto,
  GetLiquidationQuoteDto,
  IndicativeQuoteResponse,
  LiquidationQuoteResponse,
} from '../schemas'

export interface IQuoteService {
  /**
   * Get an indicative quote for a token swap
   * Creates or updates a quote session
   * @param dto The indicative quote request parameters
   * @returns Indicative quote response with session ID and quote
   */
  getIndicativeQuote(dto: GetIndicativeQuoteDto): Promise<IndicativeQuoteResponse>

  /**
   * Get a commitment quote for a token swap
   * Validates the session and creates a trade record
   * @param dto The commitment quote request parameters
   * @returns Commitment quote response with trade ID and final quote
   */
  getCommitmentQuote(dto: GetCommitmentQuoteDto): Promise<CommitmentQuoteResponse>

  /**
   * Get a liquidation quote for lending trades
   * Creates a lending trade with payment metadata
   * @param dto The liquidation quote request parameters
   * @returns Liquidation quote response with trade ID and quote
   */
  getLiquidationQuote(dto: GetLiquidationQuoteDto): Promise<LiquidationQuoteResponse>
}
