import { SnakeToCamelInterceptor } from '@bitfi-mock-pmm/shared';
import { TradeExistsGuard } from '@bitfi-mock-pmm/trade';
import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { AckSettlementDto, GetSettlementSignatureDto } from './settlement.dto';
import { SettlementService } from './settlement.service';

@Controller()
@UseInterceptors(SnakeToCamelInterceptor)
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get('settlement-signature')
  @UseGuards(TradeExistsGuard)
  getSettlementSignature(
    @Query() query: GetSettlementSignatureDto,
    @Req() req: any
  ) {
    // trade đã được gắn vào req bởi guard
    return this.settlementService.getSettlementSignature(query, req.trade);
  }

  @Get('ack-settlement')
  @UseGuards(TradeExistsGuard)
  ackSettlement(@Query() query: AckSettlementDto, @Req() req: any) {
    return this.settlementService.ackSettlement(query, req.trade);
  }
}
