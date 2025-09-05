import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { Trade } from '@prisma/client'
import {
  AckSettlementDto,
  GetSettlementSignatureDto,
  SettlementService,
  SignalPaymentDto,
  SignalPaymentResponseDto,
} from '@optimex-pmm/settlement'
import { TransformedBody, TransformedQuery } from '@optimex-pmm/shared'
import { TradeExistsGuard } from '@optimex-pmm/trade'
import { Request } from 'express'

interface RequestWithTrade extends Request {
  trade: Trade
}

@Controller()
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get('settlement-signature')
  @UseGuards(TradeExistsGuard)
  getSettlementSignature(@TransformedQuery() query: GetSettlementSignatureDto, @Req() req: RequestWithTrade) {
    return this.settlementService.getSettlementSignature(query, req.trade)
  }

  @Post('ack-settlement')
  @UseGuards(TradeExistsGuard)
  ackSettlement(@TransformedBody() body: AckSettlementDto) {
    return this.settlementService.ackSettlement(body)
  }

  @Post('signal-payment')
  @UseGuards(TradeExistsGuard)
  signalPayment(@TransformedBody() body: SignalPaymentDto, @Req() req: RequestWithTrade): Promise<SignalPaymentResponseDto> {
    return this.settlementService.signalPayment(body, req.trade)
  }
}
