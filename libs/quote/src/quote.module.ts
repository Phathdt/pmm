import { TokenModule } from '@bitfi-mock-pmm/token';
import { TradeModule } from '@bitfi-mock-pmm/trade';
import { Module } from '@nestjs/common';

import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';

@Module({
  imports: [TokenModule, TradeModule],
  controllers: [QuoteController],
  providers: [QuoteService],
  exports: [QuoteService],
})
export class QuoteModule {}
