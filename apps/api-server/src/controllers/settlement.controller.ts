import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import {
  AckSettlementDto,
  GetSettlementSignatureDto,
  SettlementService,
  SignalPaymentDto,
  SignalPaymentResponseDto,
} from '@optimex-pmm/settlement'
import { TransformedBody, TransformedQuery } from '@optimex-pmm/shared'
import { TradeExistsGuard } from '@optimex-pmm/trade'

@Controller()
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get('settlement-signature')
  @UseGuards(TradeExistsGuard)
  getSettlementSignature(@TransformedQuery() query: GetSettlementSignatureDto, @Req() req: any) {
    return this.settlementService.getSettlementSignature(query, req.trade)
  }

  @Post('ack-settlement')
  @UseGuards(TradeExistsGuard)
  ackSettlement(@TransformedBody() body: AckSettlementDto) {
    return this.settlementService.ackSettlement(body)
  }

  @Post('signal-payment')
  @UseGuards(TradeExistsGuard)
  signalPayment(@TransformedBody() body: SignalPaymentDto, @Req() req: any): Promise<SignalPaymentResponseDto> {
    return this.settlementService.signalPayment(body, req.trade)
  }
}
