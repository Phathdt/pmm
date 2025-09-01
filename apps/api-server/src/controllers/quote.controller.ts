import { Controller, Get } from '@nestjs/common'
import { GetCommitmentQuoteDto, GetIndicativeQuoteDto, GetLiquidationQuoteDto, QuoteService } from '@optimex-pmm/quote'
import { TransformedQuery } from '@optimex-pmm/shared'

@Controller()
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

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
