import { TradeModule } from '@bitfi-mock-pmm/trade';
import { Module } from '@nestjs/common';

import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';

@Module({
  imports: [TradeModule],
  controllers: [SettlementController],
  providers: [SettlementService],
})
export class SettlementModule {}
