import { TransferParams, TransferResult } from '../entities'

/**
 * Strategy interface for executing transfers across different blockchain networks
 */
export interface ITransferStrategy {
  /**
   * Execute a transfer on the specific blockchain network
   * @param params Transfer parameters including recipient, amount, token, and trade ID
   * @returns Transfer result with transaction hash and optional gas details
   */
  transfer(params: TransferParams): Promise<TransferResult>
}
