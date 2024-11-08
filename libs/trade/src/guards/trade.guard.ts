import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { TradeService } from '../trade.service';

@Injectable()
export class TradeExistsGuard implements CanActivate {
  constructor(private tradeService: TradeService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tradeId = request.params.tradeId;

    const trade = await this.tradeService.findTradeById(tradeId);
    if (!trade) {
      throw new NotFoundException(`Trade with ID ${tradeId} not found`);
    }

    request.trade = trade;
    return true;
  }
}
