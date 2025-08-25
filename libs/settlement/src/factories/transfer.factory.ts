import { Injectable } from '@nestjs/common'

import { ITransferStrategy } from '../interfaces/transfer-strategy.interface'
import {
  BTCTransferStrategy,
  EVMLiquidationTransferStrategy,
  EVMTransferStrategy,
  SolanaTransferStrategy,
} from '../strategies'

@Injectable()
export class TransferFactory {
  private strategies = new Map<string, ITransferStrategy>()

  constructor(
    private evmTransferStrategy: EVMTransferStrategy,
    private btcTransferStrategy: BTCTransferStrategy,
    private solanaTransferStrategy: SolanaTransferStrategy,
    private evmLiquidationTransferStrategy: EVMLiquidationTransferStrategy
  ) {
    this.strategies.set('EVM-false', evmTransferStrategy)
    this.strategies.set('TBTC-false', btcTransferStrategy)
    this.strategies.set('BTC-false', btcTransferStrategy)
    this.strategies.set('SOLANA-false', solanaTransferStrategy)
    this.strategies.set('EVM-true', evmLiquidationTransferStrategy)
  }

  getStrategy(networkType: string, isLiquid: boolean): ITransferStrategy {
    const strategy = this.strategies.get(`${networkType}-${isLiquid}`)
    if (!strategy) {
      throw new Error(`Unsupported network type: ${networkType}`)
    }

    return strategy
  }
}
