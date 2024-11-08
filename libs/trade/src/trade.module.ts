import { DatabaseModule } from '@bitfi-mock-pmm/database';
import { Module } from '@nestjs/common';

import { TradeService } from './trade.service';

@Module({
  imports: [DatabaseModule],
  providers: [TradeService],
  exports: [TradeService],
})
export class TradeModule {}
