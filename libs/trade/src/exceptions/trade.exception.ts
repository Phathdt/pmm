import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidTradeStatusException extends HttpException {
  constructor(status: string) {
    super(`Invalid trade status: ${status}`, HttpStatus.BAD_REQUEST);
  }
}

export class TradeAlreadySettledException extends HttpException {
  constructor(tradeId: string) {
    super(`Trade ${tradeId} has already been settled`, HttpStatus.CONFLICT);
  }
}
