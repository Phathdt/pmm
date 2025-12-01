import { BaseContract, ethers } from 'ethers'

import {
  TransactionData,
  TransactionOptions,
  TransactionReceipt,
  TransactionResult,
  TransactionStatus,
} from '../schemas'

// Type helpers for TypeChain integration
export type ExtractPopulateTransactionParams<T> = T extends {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  populateTransaction: (...args: infer P) => Promise<any>
}
  ? P
  : never

export type ExtractContract<T> = T extends { connect: (address: string, runner: ethers.ContractRunner) => infer C }
  ? C extends BaseContract
    ? C
    : never
  : never

export interface ITransactionService {
  /**
   * Execute transaction with automatic gas handling
   */
  executeTransaction(
    networkId: string,
    txData: TransactionData,
    options?: TransactionOptions
  ): Promise<TransactionResult>

  /**
   * Execute contract method with automatic gas handling and full type safety
   */
  executeContractMethod<
    TFactory extends { connect: (address: string, runner: ethers.ContractRunner) => BaseContract },
    TContract extends ExtractContract<TFactory>,
    TMethodName extends keyof TContract,
  >(
    contractFactory: TFactory,
    contractAddress: string,
    methodName: TMethodName,
    args: ExtractPopulateTransactionParams<TContract[TMethodName]>,
    networkId: string,
    options?: TransactionOptions
  ): Promise<TransactionResult>

  /**
   * Handle ERC20 token approval with allowance checking
   */
  handleTokenApproval(
    networkId: string,
    tokenAddress: string,
    spenderAddress: string,
    requiredAmount: bigint,
    options?: TransactionOptions
  ): Promise<void>

  /**
   * Get transaction status from blockchain
   */
  getTransactionStatus(networkId: string, txHash: string): Promise<TransactionStatus>

  /**
   * Get transaction receipt directly
   */
  getTransactionReceipt(networkId: string, txHash: string): Promise<TransactionReceipt | null>

  /**
   * Get ethers provider for advanced queries
   */
  getProvider(networkId: string): ethers.Provider

  /**
   * Get account nonce for monitoring purposes
   */
  getAccountNonce(networkId: string, address: string): Promise<number>

  /**
   * Get current gas price information
   */
  getCurrentGasPrice(
    networkId: string
  ): Promise<{ gasPrice: string; maxFeePerGas?: string; maxPriorityFeePerGas?: string }>
}
