/* eslint-disable @typescript-eslint/no-explicit-any */
import { Inject, Injectable } from '@nestjs/common'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { ERC20__factory } from '@optimex-xyz/market-maker-sdk'

import {
  BaseContract,
  ethers,
  TransactionRequest as EthersTransactionRequest,
  MaxUint256,
  TransactionResponse,
} from 'ethers'

import {
  ExtractContract,
  ExtractPopulateTransactionParams,
  INonceManagerService,
  ITransactionService,
  TransactionData,
  TransactionOptions,
  TransactionReceipt,
  TransactionResult,
  TransactionStatus,
} from '../../domain'
import { NONCE_MANAGER_SERVICE } from '../../infras'

/**
 * Service for executing transactions with TypeChain integration
 * Works with populateTransaction for type safety and automatic gas management
 */
@Injectable()
export class TransactionService implements ITransactionService {
  private readonly DEFAULT_GAS_BUFFER_PERCENTAGE = 20 // 20% buffer for gas limit (Ethereum/Sepolia have reliable estimation)
  private readonly DEFAULT_MIN_GAS_BUFFER = 21000 // Minimum gas for a simple transfer
  private readonly DEFAULT_GAS_PRICE_BUFFER_PERCENTAGE = 15 // 15% buffer for gas price (reduced for stable networks)
  private readonly DEFAULT_MAX_GAS_PRICE_MULTIPLIER = 3 // Max 3x base fee
  private readonly DEFAULT_MAX_NONCE_RETRIES = 1 // Default retry count for nonce errors
  private readonly logger: EnhancedLogger

  constructor(
    @Inject(NONCE_MANAGER_SERVICE) private nonceManagerService: INonceManagerService,
    logger: EnhancedLogger
  ) {
    this.logger = logger.with({ context: TransactionService.name })
  }

  /**
   * Execute transaction with automatic gas handling and nonce retry
   * Works with TypeChain populated transactions for type safety
   * @param networkId Network to execute on
   * @param txData Transaction data (from populateTransaction)
   * @param options Gas and execution options
   * @returns Transaction result
   */
  async executeTransaction(
    networkId: string,
    txData: TransactionData,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    const maxRetries = options.maxNonceRetries ?? this.DEFAULT_MAX_NONCE_RETRIES
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeTransactionInternal(networkId, txData, options, attempt)
      } catch (error: unknown) {
        lastError = error

        // Only retry on nonce errors and if we have retries left
        if (this.isNonceRelatedError(error) && attempt < maxRetries) {
          this.logger.warn({
            message: 'Nonce error detected - syncing nonce and retrying',
            networkId,
            attempt: attempt + 1,
            maxRetries,
            operation: 'execute_transaction',
            errorType: 'nonce',
            timestamp: new Date().toISOString(),
          })

          // Reset and sync nonce from network
          const newNonce = await this.nonceManagerService.handleNonceError(networkId)
          this.logger.log({
            message: 'Nonce synced, retrying transaction',
            networkId,
            newNonce,
            nextAttempt: attempt + 2,
            operation: 'execute_transaction',
            timestamp: new Date().toISOString(),
          })

          continue // Retry the transaction
        }

        // Log non-retryable errors
        this.logTransactionError(error, networkId)
        throw error
      }
    }

    // Should not reach here, but throw last error if it does
    throw lastError
  }

  /**
   * Internal transaction execution logic
   */
  private async executeTransactionInternal(
    networkId: string,
    txData: TransactionData,
    options: TransactionOptions,
    attempt: number
  ): Promise<TransactionResult> {
    const wallet = this.nonceManagerService.getNonceManager(networkId)

    this.logger.log({
      message: 'Executing blockchain transaction',
      networkId,
      description: options.description || 'Unknown',
      attempt: attempt + 1,
      operation: 'execute_transaction',
      timestamp: new Date().toISOString(),
    })

    // Gas limit handling (existing logic)
    let gasLimit = options.gasLimit || txData.gasLimit

    if (!gasLimit) {
      gasLimit = await this.estimateGasWithBuffer(txData, wallet, options)
    }

    // Enhanced gas price handling
    const gasConfig = await this.getOptimalGasPrice(wallet, options)

    // Prepare final transaction with enhanced gas handling
    const finalTxData: EthersTransactionRequest = {
      ...txData,
      gasLimit,
      value: options.value || txData.value,
      ...gasConfig,
    }

    // Execute transaction
    const tx: TransactionResponse = await wallet.sendTransaction(finalTxData)

    // Enhanced logging with gas price information
    const gasType = gasConfig.maxFeePerGas ? 'EIP-1559' : 'Legacy'
    const gasValue = gasConfig.maxFeePerGas || gasConfig.gasPrice

    this.logger.log({
      message: 'Transaction executed successfully',
      txHash: tx.hash,
      gasLimit: gasLimit.toString(),
      gasType,
      gasValue: gasValue?.toString(),
      nonce: tx.nonce,
      networkId,
      attempt: attempt + 1,
      operation: 'execute_transaction',
      status: 'success',
      timestamp: new Date().toISOString(),
    })

    // Return comprehensive transaction result with gas details
    return {
      hash: tx.hash,
      nonce: tx.nonce,
      gasLimit: tx.gasLimit,
      gasPrice: tx.gasPrice,
      maxFeePerGas: tx.maxFeePerGas || undefined,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas || undefined,
    }
  }

  /**
   * Log transaction errors with appropriate categorization
   */
  private logTransactionError(error: unknown, networkId: string): void {
    this.logger.error({
      message: 'Transaction execution failed',
      error: error instanceof Error ? error.message : String(error),
      networkId,
      operation: 'execute_transaction',
      status: 'failed',
      timestamp: new Date().toISOString(),
    })

    // Enhanced error handling for gas-related issues
    if (this.isGasRelatedError(error)) {
      this.logger.error({
        message: 'Gas limit related error detected',
        networkId,
        operation: 'execute_transaction',
        errorType: 'gas_limit',
        timestamp: new Date().toISOString(),
      })
    }

    if (this.isGasPriceRelatedError(error)) {
      this.logger.error({
        message: 'Gas price related error detected',
        networkId,
        operation: 'execute_transaction',
        errorType: 'gas_price',
        recommendation: 'consider increasing gas price or buffer',
        timestamp: new Date().toISOString(),
      })
    }
  }

  /**
   * Execute contract method with automatic gas handling and full type safety
   * Combines populateTransaction and executeTransaction into one call
   * @param contractFactory TypeChain contract factory class
   * @param contractAddress Contract address to connect to
   * @param methodName Method name to call
   * @param args Method arguments (type-checked by TypeChain)
   * @param networkId Network to execute on
   * @param options Gas and execution options
   * @returns Transaction result
   */
  async executeContractMethod<
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
  ): Promise<TransactionResult> {
    const contract = contractFactory.connect(
      contractAddress,
      this.nonceManagerService.getNonceManager(networkId)
    ) as TContract
    // Step 1: Validate method exists
    const method = contract[methodName] as any
    if (!method || typeof method.populateTransaction !== 'function') {
      throw new Error(`Method ${String(methodName)} not found on contract or not callable`)
    }

    this.logger.log({
      message: 'Executing contract method',
      contractAddress,
      methodName: String(methodName),
      networkId,
      operation: 'execute_contract_method',
      timestamp: new Date().toISOString(),
    })

    // Step 2: Try contract-specific gas estimation if not provided
    let gasLimit = options?.gasLimit
    if (!gasLimit) {
      gasLimit = await this.estimateContractGas(contract, methodName as any, args as any, options || {})
    }

    // Step 3: Use TypeChain to validate and populate transaction
    const txData = await method.populateTransaction(...(args as any[]))

    // Step 4: Pass validated transaction with gas limit to executeTransaction
    return await this.executeTransaction(networkId, txData, { ...options, gasLimit })
  }

  /**
   * Handle ERC20 token approval with allowance checking
   * @param networkId Network to execute on
   * @param tokenAddress ERC20 token contract address
   * @param spenderAddress Address to approve (usually contract address)
   * @param requiredAmount Amount that needs to be approved
   * @param options Transaction options
   */
  async handleTokenApproval(
    networkId: string,
    tokenAddress: string,
    spenderAddress: string,
    requiredAmount: bigint,
    options: TransactionOptions = {}
  ): Promise<void> {
    const wallet = this.nonceManagerService.getNonceManager(networkId)

    this.logger.log({
      message: 'Checking token approval',
      tokenAddress,
      spenderAddress,
      networkId,
      operation: 'token_approval_check',
      timestamp: new Date().toISOString(),
    })

    try {
      // Create ERC20 contract interface
      const erc20Contract = ERC20__factory.connect(tokenAddress, wallet.provider)
      const walletAddress = await wallet.getAddress()

      // Check current allowance
      const currentAllowance = await erc20Contract.allowance(walletAddress, spenderAddress)

      this.logger.log({
        message: 'Token allowance checked',
        tokenAddress,
        currentAllowance: currentAllowance.toString(),
        requiredAmount: requiredAmount.toString(),
        operation: 'token_approval_check',
        timestamp: new Date().toISOString(),
      })

      // If current allowance is sufficient, no action needed
      if (currentAllowance >= requiredAmount) {
        this.logger.log({
          message: 'Token allowance is sufficient',
          tokenAddress,
          currentAllowance: currentAllowance.toString(),
          requiredAmount: requiredAmount.toString(),
          operation: 'token_approval_check',
          status: 'sufficient',
          timestamp: new Date().toISOString(),
        })
        return
      }

      // If current allowance exists and is less than required, reset to 0 first
      // (Some tokens like USDT require this)
      if (currentAllowance > BigInt(0)) {
        this.logger.log({
          message: 'Resetting existing token allowance to zero',
          tokenAddress,
          spenderAddress,
          currentAllowance: currentAllowance.toString(),
          operation: 'token_approval_reset',
          timestamp: new Date().toISOString(),
        })
        await this.executeContractMethod(
          ERC20__factory,
          tokenAddress,
          'approve',
          [spenderAddress, BigInt(0)],
          networkId,
          {
            ...options,
            description: `Reset token approval to 0 for ${tokenAddress}`,
            fallbackGasLimit: options.fallbackGasLimit || BigInt(100000),
          }
        )
      }

      // Set new approval to maximum
      this.logger.log({
        message: 'Setting token approval to maximum',
        tokenAddress,
        spenderAddress,
        operation: 'token_approval_set',
        timestamp: new Date().toISOString(),
      })
      await this.executeContractMethod(
        ERC20__factory,
        tokenAddress,
        'approve',
        [spenderAddress, MaxUint256],
        networkId,
        {
          ...options,
          description: `Set token approval to max for ${tokenAddress}`,
          fallbackGasLimit: options.fallbackGasLimit || BigInt(100000),
        }
      )

      this.logger.log({
        message: 'Token approval completed successfully',
        tokenAddress,
        spenderAddress,
        operation: 'token_approval_set',
        status: 'success',
        timestamp: new Date().toISOString(),
      })
    } catch (error: unknown) {
      this.logger.error({
        message: 'Token approval failed',
        tokenAddress,
        spenderAddress,
        error: error instanceof Error ? error.message : String(error),
        operation: 'token_approval_set',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }

  // Private helper methods for gas limit (existing)
  private applyGasBuffer(estimatedGas: bigint, options: TransactionOptions): bigint {
    const bufferPercentage = options.gasBufferPercentage ?? this.DEFAULT_GAS_BUFFER_PERCENTAGE
    const minBuffer = BigInt(options.minGasBuffer ?? this.DEFAULT_MIN_GAS_BUFFER)

    const bufferAmount = (estimatedGas * BigInt(bufferPercentage)) / BigInt(100)
    const actualBuffer = bufferAmount > minBuffer ? bufferAmount : minBuffer
    const gasWithBuffer = estimatedGas + actualBuffer

    // Apply max gas limit if specified
    const maxGas = options.maxGasLimit
    const finalGas = maxGas && gasWithBuffer > maxGas ? maxGas : gasWithBuffer

    this.logger.log({
      message: 'Gas calculation completed',
      estimatedGas: estimatedGas.toString(),
      bufferAmount: actualBuffer.toString(),
      finalGas: finalGas.toString(),
      operation: 'gas_calculation',
      timestamp: new Date().toISOString(),
    })

    return finalGas
  }

  /**
   * Estimate gas for contract method calls using contract-specific estimation
   * This method uses contract.estimateGas.methodName() for accurate gas estimation
   * that accounts for contract state changes, allowances, and complex logic
   * @param contract TypeChain contract instance
   * @param methodName Contract method name
   * @param args Method arguments
   * @param options Transaction options
   * @returns Estimated gas limit with buffer applied
   */
  private async estimateContractGas<T extends BaseContract, M extends keyof T>(
    contract: T,
    methodName: M,
    args: ExtractPopulateTransactionParams<T[M]>,
    options: TransactionOptions
  ): Promise<bigint> {
    this.logger.log({
      message: 'Estimating gas for contract method',
      methodName: String(methodName),
      operation: 'gas_estimation',
      timestamp: new Date().toISOString(),
    })

    try {
      // Step 1: Try contract-specific gas estimation
      const method = contract[methodName] as any
      if (method && typeof method.estimateGas === 'function') {
        this.logger.log({
          message: 'Using contract.estimateGas for accurate estimation',
          methodName: String(methodName),
          operation: 'gas_estimation',
          estimationType: 'contract_estimate',
          timestamp: new Date().toISOString(),
        })
        const estimatedGas = await method.estimateGas(...(args as any[]))
        const gasWithBuffer = this.applyGasBuffer(estimatedGas, options)
        this.logger.log({
          message: 'Contract gas estimation successful',
          methodName: String(methodName),
          estimatedGas: estimatedGas.toString(),
          gasWithBuffer: gasWithBuffer.toString(),
          operation: 'gas_estimation',
          estimationType: 'contract_estimate',
          status: 'success',
          timestamp: new Date().toISOString(),
        })
        return gasWithBuffer
      }

      throw new Error('Contract method does not support gas estimation')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.warn({
        message: 'Contract gas estimation failed',
        methodName: String(methodName),
        error: errorMessage,
        operation: 'gas_estimation',
        estimationType: 'contract_estimate',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })

      // Step 2: Fallback to provider-based estimation with contract data
      return await this.fallbackContractGasEstimation(contract, methodName, args, options)
    }
  }

  /**
   * Fallback gas estimation using provider with properly encoded contract call data
   * This method is used when contract.estimateGas fails
   * @param contract TypeChain contract instance
   * @param methodName Contract method name
   * @param args Method arguments
   * @param options Transaction options
   * @returns Estimated gas limit with buffer applied
   */
  private async fallbackContractGasEstimation<T extends BaseContract, M extends keyof T>(
    contract: T,
    methodName: M,
    args: ExtractPopulateTransactionParams<T[M]>,
    options: TransactionOptions
  ): Promise<bigint> {
    try {
      this.logger.log({
        message: 'Using fallback provider estimation with contract data',
        methodName: String(methodName),
        operation: 'gas_estimation',
        estimationType: 'fallback_provider',
        timestamp: new Date().toISOString(),
      })
      const method = contract[methodName] as any
      const txData = await method.populateTransaction(...(args as any[]))

      // Get the signer address for proper estimation context
      const signer = contract.runner
      let from: string | undefined = undefined

      // Check if runner has getAddress method (like a Signer)
      if (signer && typeof (signer as any).getAddress === 'function') {
        try {
          from = await (signer as any).getAddress()
        } catch {
          this.logger.log({
            message: 'Could not get signer address for gas estimation',
            operation: 'gas_estimation',
            estimationType: 'fallback_provider',
            timestamp: new Date().toISOString(),
          })
        }
      }

      const estimationRequest: EthersTransactionRequest = {
        ...txData,
        from,
      }

      // Get provider from contract or runner
      let provider = (contract as any).provider
      if (!provider && signer && typeof (signer as any).provider !== 'undefined') {
        provider = (signer as any).provider
      }

      if (!provider) {
        throw new Error('Provider not available for fallback estimation')
      }

      const estimatedGas = await provider.estimateGas(estimationRequest)
      const gasWithBuffer = this.applyGasBuffer(estimatedGas, options)
      this.logger.log({
        message: 'Fallback provider estimation successful',
        methodName: String(methodName),
        estimatedGas: estimatedGas.toString(),
        gasWithBuffer: gasWithBuffer.toString(),
        operation: 'gas_estimation',
        estimationType: 'fallback_provider',
        status: 'success',
        timestamp: new Date().toISOString(),
      })
      return gasWithBuffer
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.warn({
        message: 'Fallback provider gas estimation failed',
        methodName: String(methodName),
        error: errorMessage,
        operation: 'gas_estimation',
        estimationType: 'fallback_provider',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })

      // Step 3: Use fallback gas limit as last resort
      const fallbackGas = options.fallbackGasLimit || BigInt(500000)
      const gasWithBuffer = this.applyGasBuffer(fallbackGas, options)
      this.logger.warn({
        message: 'Using fallback gas limit',
        methodName: String(methodName),
        fallbackGas: fallbackGas.toString(),
        gasWithBuffer: gasWithBuffer.toString(),
        operation: 'gas_estimation',
        estimationType: 'fallback_limit',
        timestamp: new Date().toISOString(),
      })
      return gasWithBuffer
    }
  }

  private async estimateGasWithBuffer(
    txData: TransactionData,
    wallet: ethers.NonceManager,
    options: TransactionOptions
  ): Promise<bigint> {
    try {
      const provider = wallet.provider
      if (!provider) {
        throw new Error('Provider not available')
      }
      const estimatedGas = await provider.estimateGas(txData as EthersTransactionRequest)
      return this.applyGasBuffer(estimatedGas, options)
    } catch (error: unknown) {
      this.logger.warn({
        message: 'Gas estimation failed, using fallback',
        error: error instanceof Error ? error.message : String(error),
        operation: 'gas_estimation',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })
      const fallbackGas = options.fallbackGasLimit || BigInt(500000)
      return this.applyGasBuffer(fallbackGas, options)
    }
  }

  // Private helper methods for gas price (new)

  /**
   * Retrieve base fee information from the provider
   * Used for multiplier-based gas price protection
   * @param provider Ethereum provider instance
   * @returns Base fee per gas in wei, or undefined if unavailable
   */
  private async getBaseFeePerGas(provider: ethers.Provider): Promise<bigint | undefined> {
    try {
      const block = await provider.getBlock('latest')

      if (block?.baseFeePerGas) {
        // EIP-1559 network - have base fee
        return block.baseFeePerGas
      }

      // Legacy network
      const feeData = await provider.getFeeData()
      return feeData.gasPrice || undefined
    } catch (error: unknown) {
      this.logger.warn({
        message: 'Failed to get base fee from provider',
        error: error instanceof Error ? error.message : String(error),
        operation: 'gas_price_estimation',
        timestamp: new Date().toISOString(),
      })
      return undefined
    }
  }

  /**
   * Apply buffer to gas price to handle network volatility
   * @param gasPrice Base gas price to buffer
   * @param bufferPercentage Percentage buffer to apply (default: 10%)
   * @returns Buffered gas price
   */
  private applyGasPriceBuffer(gasPrice: bigint, bufferPercentage = this.DEFAULT_GAS_PRICE_BUFFER_PERCENTAGE): bigint {
    const buffer = (gasPrice * BigInt(bufferPercentage)) / BigInt(100)
    const bufferedPrice = gasPrice + buffer

    this.logger.log({
      message: 'Gas price buffering applied',
      originalPrice: gasPrice.toString(),
      bufferAmount: buffer.toString(),
      bufferedPrice: bufferedPrice.toString(),
      operation: 'gas_price_buffering',
      timestamp: new Date().toISOString(),
    })
    return bufferedPrice
  }

  /**
   * Get optimal gas price for the network
   * Supports both legacy and EIP-1559 transactions with multiplier-based protection
   * Calculates maxFeePerGas from base fee instead of using provider's estimate for better cost control
   * @param wallet NonceManager instance with provider
   * @param options Transaction options with gas price preferences
   * @returns Gas price configuration object
   */
  private async getOptimalGasPrice(
    wallet: ethers.NonceManager,
    options: TransactionOptions
  ): Promise<{
    gasPrice?: bigint
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
  }> {
    const provider = wallet.provider
    if (!provider) {
      throw new Error('Provider not available for gas price estimation')
    }

    // Get base fee for multiplier-based protection and calculation
    const baseFeePerGas = await this.getBaseFeePerGas(provider)

    // Step 1: Check if EIP-1559 values provided explicitly
    if (options.maxFeePerGas && options.maxPriorityFeePerGas) {
      this.logger.log({
        message: 'Using provided EIP-1559 gas price values',
        maxFeePerGas: options.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: options.maxPriorityFeePerGas?.toString(),
        operation: 'gas_price_estimation',
        gasType: 'EIP-1559-provided',
        timestamp: new Date().toISOString(),
      })
      const bufferedMaxFee = this.applyGasPriceBuffer(options.maxFeePerGas, options.gasPriceBufferPercentage)
      const finalMaxFeePerGas = await this.enforceMaxGasPrice(bufferedMaxFee, options, baseFeePerGas)

      // CRITICAL: Ensure maxPriorityFeePerGas <= maxFeePerGas (EIP-1559 requirement)
      let finalPriorityFee = options.maxPriorityFeePerGas
      if (finalPriorityFee > finalMaxFeePerGas) {
        this.logger.warn({
          message: 'Priority fee exceeds max fee, capping to max fee',
          originalPriorityFee: finalPriorityFee.toString(),
          maxFeePerGas: finalMaxFeePerGas.toString(),
          cappedPriorityFee: finalMaxFeePerGas.toString(),
          operation: 'gas_price_estimation',
          timestamp: new Date().toISOString(),
        })
        finalPriorityFee = finalMaxFeePerGas
      }

      return {
        maxFeePerGas: finalMaxFeePerGas,
        maxPriorityFeePerGas: finalPriorityFee,
      }
    }

    // Step 2: Check if legacy gas price provided explicitly
    if (options.gasPrice) {
      this.logger.log({
        message: 'Using provided legacy gas price',
        gasPrice: options.gasPrice?.toString(),
        operation: 'gas_price_estimation',
        gasType: 'legacy-provided',
        timestamp: new Date().toISOString(),
      })
      const bufferedPrice = this.applyGasPriceBuffer(options.gasPrice, options.gasPriceBufferPercentage)

      return {
        gasPrice: await this.enforceMaxGasPrice(bufferedPrice, options, baseFeePerGas),
      }
    }

    // Step 3: Fetch from provider and calculate optimal gas price
    try {
      this.logger.log({
        message: 'Fetching gas price from provider',
        operation: 'gas_price_estimation',
        timestamp: new Date().toISOString(),
      })
      const feeData = await provider.getFeeData()

      // Prefer EIP-1559 if supported and base fee is available
      // Calculate maxFeePerGas from base fee instead of using provider's estimate
      if (feeData.maxPriorityFeePerGas && baseFeePerGas) {
        // Calculate maxFeePerGas as 2x base fee for reasonable buffer
        // This prevents using provider's inflated estimates (which can be 2000x+ higher)
        const calculatedMaxFee = baseFeePerGas * BigInt(2)

        this.logger.log({
          message: 'Calculated EIP-1559 gas price from base fee',
          baseFeePerGas: baseFeePerGas.toString(),
          calculatedMaxFee: calculatedMaxFee.toString(),
          providerMaxFeePerGas: feeData.maxFeePerGas?.toString(), // Log for comparison
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
          operation: 'gas_price_estimation',
          gasType: 'EIP-1559-calculated',
          timestamp: new Date().toISOString(),
        })

        // Apply buffer to calculated max fee
        const bufferedMaxFee = this.applyGasPriceBuffer(calculatedMaxFee, options.gasPriceBufferPercentage)
        const finalMaxFeePerGas = await this.enforceMaxGasPrice(bufferedMaxFee, options, baseFeePerGas)

        // CRITICAL: Ensure maxPriorityFeePerGas <= maxFeePerGas (EIP-1559 requirement)
        let finalPriorityFee = feeData.maxPriorityFeePerGas
        if (finalPriorityFee > finalMaxFeePerGas) {
          this.logger.warn({
            message: 'Priority fee exceeds max fee, capping to max fee',
            originalPriorityFee: finalPriorityFee.toString(),
            maxFeePerGas: finalMaxFeePerGas.toString(),
            cappedPriorityFee: finalMaxFeePerGas.toString(),
            operation: 'gas_price_estimation',
            timestamp: new Date().toISOString(),
          })
          finalPriorityFee = finalMaxFeePerGas
        }

        return {
          maxFeePerGas: finalMaxFeePerGas,
          maxPriorityFeePerGas: finalPriorityFee,
        }
      }

      // Fallback: Use provider's EIP-1559 estimate if base fee unavailable
      // This should rarely happen on modern networks
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        this.logger.warn({
          message: 'Using provider EIP-1559 gas price (base fee unavailable)',
          maxFeePerGas: feeData.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
          operation: 'gas_price_estimation',
          gasType: 'EIP-1559-provider',
          timestamp: new Date().toISOString(),
        })
        const bufferedMaxFee = this.applyGasPriceBuffer(feeData.maxFeePerGas, options.gasPriceBufferPercentage)
        const finalMaxFeePerGas = await this.enforceMaxGasPrice(bufferedMaxFee, options, baseFeePerGas)

        // CRITICAL: Ensure maxPriorityFeePerGas <= maxFeePerGas (EIP-1559 requirement)
        let finalPriorityFee = feeData.maxPriorityFeePerGas
        if (finalPriorityFee > finalMaxFeePerGas) {
          this.logger.warn({
            message: 'Priority fee exceeds max fee, capping to max fee',
            originalPriorityFee: finalPriorityFee.toString(),
            maxFeePerGas: finalMaxFeePerGas.toString(),
            cappedPriorityFee: finalMaxFeePerGas.toString(),
            operation: 'gas_price_estimation',
            timestamp: new Date().toISOString(),
          })
          finalPriorityFee = finalMaxFeePerGas
        }

        return {
          maxFeePerGas: finalMaxFeePerGas,
          maxPriorityFeePerGas: finalPriorityFee,
        }
      }

      // Fallback to legacy gas price for non-EIP-1559 networks
      if (feeData.gasPrice) {
        this.logger.log({
          message: 'Using legacy gas price from provider',
          gasPrice: feeData.gasPrice?.toString(),
          operation: 'gas_price_estimation',
          gasType: 'legacy',
          timestamp: new Date().toISOString(),
        })
        const bufferedPrice = this.applyGasPriceBuffer(feeData.gasPrice, options.gasPriceBufferPercentage)

        return {
          gasPrice: await this.enforceMaxGasPrice(bufferedPrice, options, baseFeePerGas),
        }
      }

      throw new Error('No gas price data available from provider')
    } catch (error: unknown) {
      this.logger.warn({
        message: 'Gas price estimation from provider failed',
        error: error instanceof Error ? error.message : String(error),
        operation: 'gas_price_estimation',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })

      // Use fallback gas price if provided
      if (options.fallbackGasPrice) {
        this.logger.log({
          message: 'Using fallback gas price',
          fallbackGasPrice: options.fallbackGasPrice?.toString(),
          operation: 'gas_price_estimation',
          gasType: 'fallback',
          timestamp: new Date().toISOString(),
        })
        const bufferedPrice = this.applyGasPriceBuffer(options.fallbackGasPrice, options.gasPriceBufferPercentage)

        return {
          gasPrice: await this.enforceMaxGasPrice(bufferedPrice, options, baseFeePerGas),
        }
      }

      throw new Error('Unable to determine gas price and no fallback provided')
    }
  }

  /**
   * Enforce maximum gas price limits to prevent excessive costs
   * Applies both user-provided limits and multiplier-based protection
   * @param gasPrice Gas price to check
   * @param options Transaction options with max gas price limit
   * @param baseFeePerGas Base fee for multiplier-based protection (optional)
   * @returns Gas price within limits
   */
  private async enforceMaxGasPrice(
    gasPrice: bigint,
    options: TransactionOptions,
    baseFeePerGas?: bigint
  ): Promise<bigint> {
    let cappedPrice = gasPrice

    // First apply user-provided max gas price limit
    if (options.maxGasPrice && cappedPrice > options.maxGasPrice) {
      this.handleGasPriceCapError(cappedPrice, options.maxGasPrice, 'user-max')
      cappedPrice = options.maxGasPrice
    }

    // Then apply multiplier-based protection if base fee is available
    if (baseFeePerGas) {
      const maxAllowedGasPrice = baseFeePerGas * BigInt(this.DEFAULT_MAX_GAS_PRICE_MULTIPLIER)
      if (cappedPrice > maxAllowedGasPrice) {
        this.handleGasPriceCapError(cappedPrice, maxAllowedGasPrice, 'multiplier-max', baseFeePerGas)
        cappedPrice = maxAllowedGasPrice
      }
    }

    return cappedPrice
  }

  /**
   * Handle gas price capping scenarios with detailed logging
   * @param originalPrice Original gas price before capping
   * @param cappedPrice Gas price after capping
   * @param reason Reason for capping (user-max or multiplier-max)
   * @param baseFee Base fee (optional, for multiplier-max context)
   */
  private handleGasPriceCapError(
    originalPrice: bigint,
    cappedPrice: bigint,
    reason: 'user-max' | 'multiplier-max',
    baseFee?: bigint
  ): void {
    const reduction = originalPrice - cappedPrice
    const percentageReduction = (reduction * BigInt(100)) / originalPrice

    this.logger.warn({
      message: 'Gas price reduced due to limit',
      originalPrice: originalPrice.toString(),
      cappedPrice: cappedPrice.toString(),
      reduction: reduction.toString(),
      percentageReduction: percentageReduction.toString(),
      reason,
      baseFee: baseFee?.toString(),
      multiplier: reason === 'multiplier-max' ? this.DEFAULT_MAX_GAS_PRICE_MULTIPLIER : undefined,
      operation: 'gas_price_capping',
      timestamp: new Date().toISOString(),
    })
  }

  private isGasRelatedError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || ''
    const errorCode = error?.code

    const gasErrorPatterns = [
      'out of gas',
      'gas limit',
      'gas required exceeds allowance',
      'intrinsic gas too low',
      'insufficient gas',
    ]

    const hasGasKeyword = gasErrorPatterns.some((pattern) => errorMessage.includes(pattern))

    const gasErrorCodes = ['INSUFFICIENT_FUNDS', 'UNPREDICTABLE_GAS_LIMIT']

    const hasGasErrorCode = gasErrorCodes.includes(errorCode)

    return hasGasKeyword || hasGasErrorCode
  }

  /**
   * Check if error is related to nonce issues (expired, too low, already used)
   * @param error Error object to analyze
   * @returns True if error is nonce related
   */
  private isNonceRelatedError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || ''
    const errorCode = error?.code

    const nonceErrorPatterns = [
      'nonce too low',
      'nonce has already been used',
      'nonce expired',
      'replacement transaction underpriced', // Can also indicate nonce issues
      'known transaction', // Transaction with same nonce already exists
      'already known', // Same as above
    ]

    const hasNonceKeyword = nonceErrorPatterns.some((pattern) => errorMessage.includes(pattern))

    const nonceErrorCodes = ['NONCE_EXPIRED', 'REPLACEMENT_UNDERPRICED']

    const hasNonceErrorCode = nonceErrorCodes.includes(errorCode)

    return hasNonceKeyword || hasNonceErrorCode
  }

  /**
   * Check if error is specifically related to gas price issues
   * @param error Error object to analyze
   * @returns True if error is gas price related
   */
  private isGasPriceRelatedError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || ''

    const gasPriceErrorPatterns = [
      'gas price too low',
      'replacement transaction underpriced',
      'transaction underpriced',
      'max fee per gas less than block base fee',
      'max priority fee per gas higher than max fee per gas',
      'underpriced',
    ]

    return gasPriceErrorPatterns.some((pattern) => errorMessage.includes(pattern))
  }

  // ===== MONITORING METHODS =====
  // These methods provide transaction monitoring capabilities
  // previously handled by EVMRPCQueryService

  /**
   * Get transaction status from blockchain
   * @param networkId Network identifier (ETHEREUM or ETHEREUM_SEPOLIA)
   * @param txHash Transaction hash
   * @returns Transaction status with confirmation details
   */
  async getTransactionStatus(networkId: string, txHash: string): Promise<TransactionStatus> {
    try {
      const provider = this.getProvider(networkId)

      this.logger.log({
        message: 'Checking transaction status',
        networkId,
        txHash,
        operation: 'get_transaction_status',
        timestamp: new Date().toISOString(),
      })

      // Get transaction from provider
      const tx = await provider.getTransaction(txHash)

      if (!tx) {
        return {
          exists: false,
          inMempool: false,
          confirmed: false,
          receipt: null,
        }
      }

      // Check if transaction is mined
      if (tx.blockNumber === null) {
        return {
          exists: true,
          inMempool: true,
          confirmed: false,
          receipt: null,
        }
      }

      // Get receipt for confirmed transaction
      const receipt = await provider.getTransactionReceipt(txHash)
      if (!receipt) {
        return {
          exists: true,
          inMempool: false,
          confirmed: false,
          receipt: null,
        }
      }

      // Get current block for confirmation count
      const currentBlock = await provider.getBlockNumber()
      const confirmations = currentBlock - receipt.blockNumber + 1

      return {
        exists: true,
        inMempool: false,
        confirmed: true,
        receipt: {
          hash: receipt.hash,
          status: receipt.status || 0,
          blockNumber: receipt.blockNumber,
          confirmations,
          gasUsed: receipt.gasUsed.toString(),
        },
      }
    } catch (error: unknown) {
      this.logger.error({
        message: 'Error checking transaction status',
        networkId,
        txHash,
        error: error instanceof Error ? error.message : String(error),
        operation: 'get_transaction_status',
        timestamp: new Date().toISOString(),
      })

      return {
        exists: false,
        inMempool: false,
        confirmed: false,
        receipt: null,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Get transaction receipt directly
   * @param networkId Network identifier
   * @param txHash Transaction hash
   * @returns Transaction receipt or null if not found
   */
  async getTransactionReceipt(networkId: string, txHash: string): Promise<TransactionReceipt | null> {
    try {
      const provider = this.getProvider(networkId)
      const receipt = await provider.getTransactionReceipt(txHash)

      if (!receipt) {
        return null
      }

      const currentBlock = await provider.getBlockNumber()
      const confirmations = currentBlock - receipt.blockNumber + 1

      return {
        hash: receipt.hash,
        status: receipt.status || 0,
        blockNumber: receipt.blockNumber,
        confirmations,
        gasUsed: receipt.gasUsed.toString(),
      }
    } catch (error: unknown) {
      this.logger.error({
        message: 'Error getting transaction receipt',
        networkId,
        txHash,
        error: error instanceof Error ? error.message : String(error),
        operation: 'get_transaction_receipt',
        timestamp: new Date().toISOString(),
      })
      return null
    }
  }

  /**
   * Get ethers provider for advanced queries
   * @param networkId Network identifier
   * @returns Ethers provider instance
   */
  getProvider(networkId: string): ethers.Provider {
    const wallet = this.nonceManagerService.getNonceManager(networkId)
    const provider = wallet.provider

    if (!provider) {
      throw new Error(`No provider available for network ${networkId}`)
    }

    return provider
  }

  /**
   * Get account nonce for monitoring purposes
   * @param networkId Network identifier
   * @param address Address to check
   * @returns Current nonce
   */
  async getAccountNonce(networkId: string, address: string): Promise<number> {
    try {
      const provider = this.getProvider(networkId)
      const nonce = await provider.getTransactionCount(address, 'pending')

      this.logger.log({
        message: 'Account nonce retrieved',
        networkId,
        address,
        nonce,
        operation: 'get_account_nonce',
        timestamp: new Date().toISOString(),
      })

      return nonce
    } catch (error: unknown) {
      this.logger.error({
        message: 'Error getting account nonce',
        networkId,
        address,
        error: error instanceof Error ? error.message : String(error),
        operation: 'get_account_nonce',
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }

  /**
   * Get current gas price information
   * @param networkId Network identifier
   * @returns Gas price information
   */
  async getCurrentGasPrice(
    networkId: string
  ): Promise<{ gasPrice: string; maxFeePerGas?: string; maxPriorityFeePerGas?: string }> {
    try {
      const provider = this.getProvider(networkId)

      // Try to get EIP-1559 fee data first
      try {
        const feeData = await provider.getFeeData()
        return {
          gasPrice: feeData.gasPrice?.toString() || '0',
          maxFeePerGas: feeData.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
        }
      } catch {
        // Fallback to legacy gas price from fee data
        const feeData = await provider.getFeeData()
        return {
          gasPrice: feeData.gasPrice?.toString() || '0',
        }
      }
    } catch (error: unknown) {
      this.logger.error({
        message: 'Error getting gas price',
        networkId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'get_gas_price',
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }
}
