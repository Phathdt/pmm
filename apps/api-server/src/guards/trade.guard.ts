import { CanActivate, ExecutionContext, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { ITradeService, TRADE_SERVICE } from '@optimex-pmm/trade'

@Injectable()
export class TradeExistsGuard implements CanActivate {
  constructor(@Inject(TRADE_SERVICE) private tradeService: ITradeService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const tradeId = request.params.trade_id || request.query.trade_id

    const trade = await this.tradeService.findTradeById(tradeId)
    if (!trade) {
      throw new NotFoundException(`Trade with ID ${tradeId} not found`)
    }

    request.trade = trade

    return true
  }
}
