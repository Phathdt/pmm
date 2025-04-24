import { SnakeToCamelInterceptor } from '@bitfi-mock-pmm/shared'
import { TradeExistsGuard } from '@bitfi-mock-pmm/trade'
import { Body, Controller, Get, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'

import {
  AckSettlementDto,
  GetSettlementSignatureDto,
  SignalPaymentDto,
  SignalPaymentResponseDto,
} from './settlement.dto'
import { SettlementService } from './settlement.service'

@Controller()
@UseInterceptors(SnakeToCamelInterceptor)
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get('settlement-signature')
  @UseGuards(TradeExistsGuard)
  getSettlementSignature(@Query() query: GetSettlementSignatureDto, @Req() req: any) {
    return this.settlementService.getSettlementSignature(query, req.trade)
  }

  @Post('ack-settlement')
  @UseGuards(TradeExistsGuard)
  ackSettlement(@Body() body: AckSettlementDto) {
    return this.settlementService.ackSettlement(body)
  }

  @Post('signal-payment')
  @UseGuards(TradeExistsGuard)
  signalPayment(@Body() body: SignalPaymentDto, @Req() req: any): Promise<SignalPaymentResponseDto> {
    return this.settlementService.signalPayment(body, req.trade)
  }
}
