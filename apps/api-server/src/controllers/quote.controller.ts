import { Controller, Get, Inject } from '@nestjs/common'
import {
  GetCommitmentQuoteDto,
  GetIndicativeQuoteDto,
  GetLiquidationQuoteDto,
  IQuoteService,
  QUOTE_SERVICE,
} from '@optimex-pmm/quote'
import { TransformedQuery } from '@optimex-pmm/shared'

@Controller()
export class QuoteController {
  constructor(@Inject(QUOTE_SERVICE) private readonly quoteService: IQuoteService) {}

  @Get('indicative-quote')
  getIndicativeQuote(@TransformedQuery() query: GetIndicativeQuoteDto) {
    return this.quoteService.getIndicativeQuote(query)
  }

  @Get('commitment-quote')
  getCommitmentQuote(@TransformedQuery() query: GetCommitmentQuoteDto) {
    return this.quoteService.getCommitmentQuote(query)
  }

  @Get('liquidation-quote')
  getLiquidationQuote(@TransformedQuery() query: GetLiquidationQuoteDto) {
    return this.quoteService.getLiquidationQuote(query)
  }
}
