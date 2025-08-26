import { Injectable } from '@nestjs/common'

import { ITransferStrategy } from '../interfaces'
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
    this.strategies.set('EVM-swap', evmTransferStrategy)
    this.strategies.set('TBTC-swap', btcTransferStrategy)
    this.strategies.set('BTC-swap', btcTransferStrategy)
    this.strategies.set('SOLANA-swap', solanaTransferStrategy)
    this.strategies.set('EVM-liquid', evmLiquidationTransferStrategy)
  }

  getStrategy(networkType: string, tradeType: string): ITransferStrategy {
    const strategy = this.strategies.get(`${networkType}-${tradeType}`)
    if (!strategy) {
      throw new Error(`Unsupported network type: ${networkType} with trade type: ${tradeType}`)
    }

    return strategy
  }
}
