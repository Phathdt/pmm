import { Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common'
import { Trade } from '@optimex-pmm/database'
import {
  AckSettlementDto,
  GetSettlementSignatureDto,
  ISettlementService,
  SETTLEMENT_SERVICE,
  SignalPaymentDto,
  SignalPaymentResponseDto,
} from '@optimex-pmm/settlement'
import { TransformedBody, TransformedQuery } from '@optimex-pmm/shared'

import { Request } from 'express'

import { TradeExistsGuard } from '../guards'

interface RequestWithTrade extends Request {
  trade: Trade
}

@Controller()
export class SettlementController {
  constructor(@Inject(SETTLEMENT_SERVICE) private readonly settlementService: ISettlementService) {}

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
  signalPayment(
    @TransformedBody() body: SignalPaymentDto,
    @Req() req: RequestWithTrade
  ): Promise<SignalPaymentResponseDto> {
    return this.settlementService.signalPayment(body, req.trade)
  }
}
